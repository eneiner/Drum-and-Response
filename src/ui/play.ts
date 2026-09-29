import { audio } from '../audio/engine';
import { Round, type Phase } from '../game/round';
import { feedback, type RoundScore } from '../game/scoring';
import type { Pattern } from '../game/types';
import { settings, stats } from '../storage';
import { h, vibrate } from './dom';
import { BeatGrid } from './grid';
import { currentOffset } from './input';

const PHASES: { id: Phase | 'result'; label: string }[] = [
  { id: 'countin', label: 'Count-in' },
  { id: 'listen', label: 'Listen' },
  { id: 'respond', label: 'Your turn' },
  { id: 'result', label: 'Result' },
];

/**
 * The shared "stage": phase pills, beat light, timeline grid, tap pad and result card.
 * Challenge and Freedom modes drive it with runRound().
 */
export class PlayView {
  readonly el: HTMLElement;
  private grid = new BeatGrid();
  private pills: Map<string, HTMLElement>;
  private light: HTMLElement;
  private lightText: HTMLElement;
  private result: HTMLElement;
  private round: Round | null = null;
  private raf = 0;

  constructor() {
    this.pills = new Map(PHASES.map((p) => [p.id, h('li', { class: 'pill' }, p.label)]));
    this.lightText = h('span', null, 'Ready');
    this.light = h('div', { class: 'beat-light' }, this.lightText);
    this.result = h('div', { class: 'result-card hidden', 'aria-live': 'polite' });

    const stage = h(
      'div',
      { class: 'stage' },
      h('ol', { class: 'phases' }, ...this.pills.values()),
      this.light,
      h('div', { class: 'grid-wrap' }, this.grid.el),
      this.result,
    );
    stage.addEventListener('pointerdown', (e) => {
      if (!this.round || settings.inputMode !== 'tap') return;
      e.preventDefault();
      this.round.tap(e.timeStamp);
      this.flash();
    });
    this.el = stage;
  }

  preview(p: Pattern): void {
    this.grid.setPattern(p);
    this.grid.clearHits();
    this.setPhase(null);
    this.result.classList.add('hidden');
    this.lightText.textContent = settings.inputMode === 'tap' ? 'Tap along' : 'Ready';
  }

  async runRound(pattern: Pattern, bpm: number): Promise<RoundScore | null> {
    this.preview(pattern);
    this.el.classList.toggle('tap-mode', settings.inputMode === 'tap');
    const round = new Round({
      pattern,
      bpm,
      kit: settings.kit,
      inputMode: settings.inputMode,
      offset: currentOffset(),
      responseClick: settings.responseClick,
    });
    this.round = round;
    const tl = round.timeline;
    const toBeat = (t: number) => (t - tl.respStart) / tl.beatDur;

    round.onHit = (t, grade) => {
      this.grid.addHit(toBeat(t), grade);
      if (grade === 'perfect' && settings.haptics) vibrate(12);
      if (settings.inputMode === 'mic') this.flash();
    };

    let lastBeat = -1;
    const animate = () => {
      const now = audio.now - audio.outputLatency;
      const phase = round.phaseAt(now);
      this.setPhase(phase === 'done' ? 'respond' : phase);
      const beatNow = Math.floor((now - tl.countInStart) / tl.beatDur);
      if (beatNow !== lastBeat && now >= tl.countInStart && now < tl.respEnd) {
        lastBeat = beatNow;
        const inBar = beatNow % pattern.meter.beats;
        this.light.classList.remove('pulse', 'accent');
        void this.light.offsetWidth;
        this.light.classList.add('pulse');
        if (inBar === 0) this.light.classList.add('accent');
        if (phase === 'countin') this.lightText.textContent = String(inBar + 1);
      }
      if (phase === 'listen') {
        this.lightText.textContent = 'Listen';
        this.grid.setPlayhead('call', (now - tl.callStart) / tl.beatDur);
      } else if (phase === 'respond' || phase === 'done') {
        this.lightText.textContent = settings.inputMode === 'tap' ? 'Tap!' : 'Clap!';
        this.grid.setPlayhead('resp', toBeat(now));
      } else {
        this.grid.setPlayhead(null, 0);
      }
      this.raf = requestAnimationFrame(animate);
    };
    this.raf = requestAnimationFrame(animate);

    const score = await round.start();
    cancelAnimationFrame(this.raf);
    this.round = null;
    this.light.classList.remove('pulse', 'accent');
    if (!score) {
      this.preview(pattern);
      return null;
    }

    stats.roundsPlayed++;
    stats.accuracySum += score.accuracy;
    stats.perfectHits += score.counts.perfect;

    this.setPhase('result');
    this.grid.showScore(score, toBeat);
    this.lightText.textContent = `${score.accuracy}%`;
    this.light.classList.toggle('pass', score.passed);
    this.light.classList.toggle('fail', !score.passed);
    this.showResult(score);
    return score;
  }

  private showResult(s: RoundScore): void {
    const c = s.counts;
    this.result.replaceChildren(
      h('p', { class: 'feedback' }, feedback(s)),
      h(
        'ul',
        { class: 'grade-counts' },
        h('li', { class: 'grade-perfect' }, h('b', null, c.perfect), ' Perfect'),
        h('li', { class: 'grade-good' }, h('b', null, c.good), ' Good'),
        h('li', { class: 'grade-off' }, h('b', null, c.off), ' Off'),
        h('li', { class: 'grade-miss' }, h('b', null, c.miss), ' Missed'),
        h('li', { class: 'grade-extra' }, h('b', null, s.extras.length), ' Extra'),
      ),
    );
    this.result.classList.remove('hidden');
  }

  private setPhase(p: Phase | 'result' | null): void {
    if (p !== 'result') this.light.classList.remove('pass', 'fail');
    const order = PHASES.map((x) => x.id);
    const idx = p ? order.indexOf(p) : -1;
    order.forEach((id, i) => {
      const pill = this.pills.get(id)!;
      pill.classList.toggle('active', i === idx);
      pill.classList.toggle('done', idx >= 0 && i < idx);
    });
  }

  private flash(): void {
    this.el.classList.remove('hit-flash');
    void this.el.offsetWidth;
    this.el.classList.add('hit-flash');
  }

  get running(): boolean {
    return this.round !== null;
  }

  stop(): void {
    this.round?.abort();
    cancelAnimationFrame(this.raf);
  }
}
