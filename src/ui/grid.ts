import { svg } from './dom';
import type { Pattern, Grade } from '../game/types';
import { patternBeats } from '../game/types';
import type { RoundScore } from '../game/scoring';

const W = 600;
const PAD_L = 100;
const PAD_R = 18;
const ROW_Y = { call: 34, resp: 96 };
const H = 130;

/**
 * Two-row timeline: top row is the drum pattern (call), bottom row is you (response).
 * Expected beats are circles; your hits are dots placed where they actually landed.
 */
export class BeatGrid {
  readonly el: SVGSVGElement;
  private notes: SVGCircleElement[] = [];
  private targets: SVGCircleElement[] = [];
  private hitLayer: SVGGElement;
  private playhead: SVGLineElement;
  private beats = 4;
  private pattern: Pattern | null = null;

  constructor() {
    this.el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grid', role: 'img', 'aria-label': 'Rhythm timeline' });
    this.hitLayer = svg('g');
    this.playhead = svg('line', { class: 'playhead', x1: -10, x2: -10, y1: 8, y2: H - 8 });
  }

  private x(beat: number): number {
    return PAD_L + (beat / this.beats) * (W - PAD_L - PAD_R);
  }

  setPattern(p: Pattern): void {
    this.pattern = p;
    this.beats = patternBeats(p);
    this.el.replaceChildren();
    this.notes = [];
    this.targets = [];

    for (const [label, y] of [['DRUMS', ROW_Y.call], ['YOU', ROW_Y.resp]] as const) {
      const t = svg('text', { x: 0, y, class: 'row-label', 'dominant-baseline': 'central' });
      t.textContent = label;
      this.el.append(t);
    }
    for (let b = 0; b <= this.beats; b++) {
      const bar = b % p.meter.beats === 0;
      this.el.append(
        svg('line', {
          class: bar ? 'barline' : 'beatline',
          x1: this.x(b),
          x2: this.x(b),
          y1: bar ? 8 : 16,
          y2: bar ? H - 8 : H - 16,
        }),
      );
    }
    for (const n of p.notes) {
      const r = n.role === 'high' ? 8 : 11;
      const c = svg('circle', { cx: this.x(n.beat), cy: ROW_Y.call, r, class: `note role-${n.role}` });
      this.notes.push(c);
      this.el.append(c);
      const t = svg('circle', { cx: this.x(n.beat), cy: ROW_Y.resp, r, class: 'target' });
      this.targets.push(t);
      this.el.append(t);
    }
    this.hitLayer.replaceChildren();
    this.el.append(this.hitLayer, this.playhead);
  }

  /** Hide the pattern dots (for "listen only" difficulty or before a round). */
  setHidden(hidden: boolean): void {
    this.el.classList.toggle('hidden-notes', hidden);
  }

  /** row = which row the playhead is on; beat = position in pattern beats (null hides). */
  setPlayhead(row: 'call' | 'resp' | null, beat: number): void {
    if (row === null || !this.pattern) {
      this.playhead.setAttribute('x1', '-10');
      this.playhead.setAttribute('x2', '-10');
      return;
    }
    const x = this.x(Math.max(0, Math.min(this.beats, beat)));
    const y = ROW_Y[row];
    this.playhead.setAttribute('x1', String(x));
    this.playhead.setAttribute('x2', String(x));
    this.playhead.setAttribute('y1', String(y - 24));
    this.playhead.setAttribute('y2', String(y + 24));
    if (row === 'call' && this.pattern) {
      this.pattern.notes.forEach((n, i) => this.notes[i].classList.toggle('lit', n.beat <= beat && beat - n.beat < 0.35));
    } else {
      this.notes.forEach((c) => c.classList.remove('lit'));
    }
  }

  addHit(beat: number, grade: Grade): void {
    const c = svg('circle', { cx: this.x(beat), cy: ROW_Y.resp, r: 5, class: `hit grade-${grade}` });
    this.hitLayer.append(c);
  }

  clearHits(): void {
    this.hitLayer.replaceChildren();
    this.targets.forEach((t) => t.setAttribute('class', 'target'));
  }

  /** Color targets by grade and redraw hits from the final score. */
  showScore(score: RoundScore, toBeat: (t: number) => number): void {
    this.hitLayer.replaceChildren();
    score.notes.forEach((n, i) => {
      this.targets[i]?.setAttribute('class', `target graded grade-${n.grade}`);
      if (n.hit !== null) this.addHit(toBeat(n.hit), n.grade);
    });
    for (const x of score.extras) {
      const bx = this.x(Math.max(0, Math.min(this.beats, toBeat(x))));
      const g = svg('g', { class: 'extra' });
      g.append(
        svg('line', { x1: bx - 6, y1: ROW_Y.resp - 6, x2: bx + 6, y2: ROW_Y.resp + 6 }),
        svg('line', { x1: bx - 6, y1: ROW_Y.resp + 6, x2: bx + 6, y2: ROW_Y.resp - 6 }),
      );
      this.hitLayer.append(g);
    }
    this.setPlayhead(null, 0);
  }
}
