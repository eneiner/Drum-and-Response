import { audio } from '../audio/engine';
import type { KitId } from '../audio/kits';
import { mic } from '../audio/mic';
import { minGapBeats } from './patterns';
import { gradeFor, scoreRound, windowsFor, type RoundScore, type Windows } from './scoring';
import { patternBeats, type Grade, type Pattern } from './types';
import type { ClickLevel, InputMode } from '../storage';

export type Phase = 'countin' | 'listen' | 'respond' | 'done';

export interface RoundOptions {
  pattern: Pattern;
  bpm: number;
  kit: KitId;
  inputMode: InputMode;
  /** Seconds subtracted from each raw hit (calibration). */
  offset: number;
  responseClick: ClickLevel;
}

export interface Timeline {
  beatDur: number;
  countInStart: number;
  callStart: number;
  respStart: number;
  respEnd: number;
  /** Absolute audio times the player should hit. */
  expected: number[];
  windows: Windows;
}

const CLICK_GAIN: Record<ClickLevel, number> = { off: 0, quiet: 0.12, normal: 0.5 };

/**
 * One call-and-response round:
 *   count-in (1 bar) → LISTEN (pattern plays) → YOUR TURN (same length) → score.
 * All audio is scheduled up front on the AudioContext clock.
 */
export class Round {
  readonly timeline: Timeline;
  readonly hits: number[] = [];
  onHit: ((time: number, grade: Grade) => void) | null = null;

  private bus: GainNode | null = null;
  private unsub: (() => void) | null = null;
  private raf = 0;
  private finished = false;
  private resolve: ((s: RoundScore | null) => void) | null = null;

  constructor(private opts: RoundOptions) {
    const { pattern, bpm } = opts;
    const beatDur = 60 / bpm;
    const barDur = beatDur * pattern.meter.beats;
    const countInStart = audio.now + 0.25 + audio.outputLatency;
    const callStart = countInStart + barDur;
    const respStart = callStart + patternBeats(pattern) * beatDur;
    const respEnd = respStart + patternBeats(pattern) * beatDur;
    this.timeline = {
      beatDur,
      countInStart,
      callStart,
      respStart,
      respEnd,
      expected: pattern.notes.map((n) => respStart + n.beat * beatDur),
      windows: windowsFor(bpm, minGapBeats(pattern) * beatDur),
    };
    // Expose the active round for browser tests in dev builds only.
    if (import.meta.env.DEV) (globalThis as { __drRound?: Round }).__drRound = this;
  }

  phaseAt(t: number): Phase {
    const tl = this.timeline;
    if (t < tl.callStart) return 'countin';
    if (t < tl.respStart) return 'listen';
    if (t < tl.respEnd + tl.windows.off) return 'respond';
    return 'done';
  }

  start(): Promise<RoundScore | null> {
    const { pattern, kit, responseClick } = this.opts;
    const tl = this.timeline;
    const bus = (this.bus = audio.createBus());
    const beats = pattern.meter.beats;

    // Count-in: one full bar, accented on 1.
    for (let b = 0; b < beats; b++) {
      audio.click(tl.countInStart + b * tl.beatDur, b === 0, bus, 0.9);
    }
    // Pattern (call).
    for (const n of pattern.notes) {
      audio.playRole(kit, n.role, tl.callStart + n.beat * tl.beatDur, bus);
    }
    // Soft metronome through the call and response so the pulse never drops.
    const g = CLICK_GAIN[responseClick];
    if (g > 0) {
      const total = patternBeats(pattern) * 2;
      for (let b = 0; b < total; b++) {
        audio.click(tl.callStart + b * tl.beatDur, b % beats === 0, bus, g);
      }
    }

    if (this.opts.inputMode === 'mic') {
      this.unsub = mic.onOnset((time) => this.addHit(time - this.opts.offset));
    }

    return new Promise((resolve) => {
      this.resolve = resolve;
      const tick = () => {
        if (this.finished) return;
        // Mic onsets arrive one round trip late; wait for the last ones before scoring.
        const lag = this.opts.inputMode === 'mic' ? Math.max(0, this.opts.offset) : 0;
        if (audio.now >= tl.respEnd + tl.windows.off + 0.1 + lag) this.finish();
        else this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    });
  }

  /** Screen-tap input. Pass the DOM event's timeStamp. */
  tap(eventTimeStamp: number): void {
    if (this.opts.inputMode !== 'tap') return;
    this.addHit(audio.eventToAudioTime(eventTimeStamp) - this.opts.offset);
  }

  private addHit(t: number): void {
    const tl = this.timeline;
    if (this.finished || t < tl.respStart - tl.windows.off || t > tl.respEnd + tl.windows.off) return;
    this.hits.push(t);
    let best = Infinity;
    for (const e of tl.expected) if (Math.abs(t - e) < Math.abs(best)) best = t - e;
    this.onHit?.(t, gradeFor(best, tl.windows));
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.cleanup(false);
    const hits = [...this.hits].sort((a, b) => a - b);
    this.resolve?.(scoreRound(this.timeline.expected, hits, this.timeline.windows));
  }

  abort(): void {
    if (this.finished) return;
    this.finished = true;
    this.cleanup(true);
    this.resolve?.(null);
  }

  private cleanup(silence: boolean): void {
    cancelAnimationFrame(this.raf);
    this.unsub?.();
    this.unsub = null;
    if (silence && this.bus) {
      const b = this.bus;
      b.gain.setTargetAtTime(0, audio.now, 0.01);
      setTimeout(() => b.disconnect(), 100);
    }
  }
}
