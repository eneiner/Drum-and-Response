import { KIT_ROLES, renderVoice, type KitId, type Voice } from './kits';
import type { Role } from '../game/types';

/**
 * Owns the single AudioContext. Everything is scheduled against
 * ctx.currentTime (never setTimeout) so playback and mic timestamps share one clock.
 */
class AudioEngine {
  ctx: AudioContext | null = null;
  private buffers = new Map<Voice, AudioBuffer>();
  private loading = new Map<Voice, Promise<AudioBuffer>>();

  /** Must be called from a user gesture (iOS won't play audio otherwise). */
  async unlock(): Promise<AudioContext> {
    if (!this.ctx) {
      // Keep playback on the speaker while the mic is open (Safari 16.4+).
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) {
        try {
          nav.audioSession.type = 'play-and-record';
        } catch {
          /* not supported */
        }
      }
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      // Play one silent sample to fully unlock iOS.
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      src.connect(this.ctx.destination);
      src.start();
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    return this.ctx;
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /** Output latency estimate: time from scheduling to hearing. */
  get outputLatency(): number {
    const c = this.ctx;
    if (!c) return 0;
    return (c.outputLatency || 0) + (c.baseLatency || 0);
  }

  async load(voices: Voice[]): Promise<void> {
    const ctx = await this.unlock();
    await Promise.all(
      voices.map((v) => {
        if (this.buffers.has(v)) return undefined;
        let p = this.loading.get(v);
        if (!p) {
          p = renderVoice(v, ctx.sampleRate).then((b) => {
            this.buffers.set(v, b);
            return b;
          });
          this.loading.set(v, p);
        }
        return p;
      }),
    );
  }

  loadKit(kit: KitId): Promise<void> {
    return this.load([...new Set(Object.values(KIT_ROLES[kit])), 'click', 'clickAccent']);
  }

  /** A gain bus for one round. Disconnect it to silence everything scheduled on it. */
  createBus(volume = 1): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = volume;
    g.connect(ctx.destination);
    return g;
  }

  play(voice: Voice, when: number, dest: AudioNode, gain = 1): void {
    const ctx = this.ctx;
    const buf = this.buffers.get(voice);
    if (!ctx || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (gain !== 1) {
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(dest);
    } else {
      src.connect(dest);
    }
    src.start(Math.max(when, ctx.currentTime));
  }

  playRole(kit: KitId, role: Role, when: number, dest: AudioNode): void {
    this.play(KIT_ROLES[kit][role], when, dest, role === 'high' ? 0.8 : 1);
  }

  click(when: number, accent: boolean, dest: AudioNode, gain = 1): void {
    this.play(accent ? 'clickAccent' : 'click', when, dest, gain);
  }

  /**
   * Convert a DOM event timestamp to "the audio time the player was hearing".
   * getOutputTimestamp maps performance.now() to the sample leaving the speaker.
   */
  eventToAudioTime(eventTimeStamp: number): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    if (typeof ctx.getOutputTimestamp === 'function') {
      const ts = ctx.getOutputTimestamp();
      if (ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
        return ts.contextTime + (eventTimeStamp - ts.performanceTime) / 1000;
      }
    }
    return ctx.currentTime - this.outputLatency - (performance.now() - eventTimeStamp) / 1000;
  }
}

export const audio = new AudioEngine();
