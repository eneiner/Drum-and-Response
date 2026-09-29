import { KITS } from '../../audio/kits';
import { freedomCells, type Complexity } from '../../game/levels';
import { generatePattern } from '../../game/patterns';
import { createRng } from '../../game/rng';
import { tapTempo } from '../../game/tempo';
import { METERS, type Pattern } from '../../game/types';
import { saveSettings, saveStats, settings, stats } from '../../storage';
import { h, stat, topBar } from '../dom';
import { prepareInput } from '../input';
import { PlayView } from '../play';
import { go, type Screen } from '../router';
import { segmented, slider, toggle } from '../controls';

const GAP_MS = 1800;
const MIN_BPM = 40;
const MAX_BPM = 220;

export function freedomScreen(): Screen {
  const f = settings.freedom;
  const view = new PlayView();
  let playing = false;
  let runId = 0;
  let destroyed = false;
  let timer = 0;
  let pattern: Pattern | null = null;
  const session = { rounds: 0, sum: 0, streak: 0, best: 0 };
  const rng = createRng();

  const save = () => saveSettings();

  // --- Setup panel ---
  const tempo = slider('Tempo (BPM)', { min: MIN_BPM, max: MAX_BPM, value: f.bpm }, (v) => {
    f.bpm = v;
    save();
    pattern = null;
  });
  const setBpm = (v: number) => {
    f.bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(v)));
    tempo.set(f.bpm);
    save();
  };
  const taps: number[] = [];
  const tapBtn = h('button', { class: 'btn tap-tempo' }, 'Tap tempo');
  tapBtn.addEventListener('pointerdown', (e) => {
    taps.push(e.timeStamp);
    const bpm = tapTempo(taps);
    tapBtn.textContent = bpm ? `Tap tempo · ${bpm}` : `Tap tempo${'.'.repeat(Math.min(3, taps.length))}`;
    if (bpm) setBpm(bpm);
  });

  const setup = h(
    'section',
    { class: 'setup card' },
    tempo.el,
    h(
      'div',
      { class: 'tempo-row' },
      h('button', { class: 'btn small', on: { click: () => setBpm(f.bpm - 5) } }, '−5'),
      h('button', { class: 'btn small', on: { click: () => setBpm(f.bpm - 1) } }, '−1'),
      tapBtn,
      h('button', { class: 'btn small', on: { click: () => setBpm(f.bpm + 1) } }, '+1'),
      h('button', { class: 'btn small', on: { click: () => setBpm(f.bpm + 5) } }, '+5'),
    ),
    segmented('Time signature', ['4/4', '3/4', '6/8', '5/4'].map((m) => ({ value: m, label: m })), f.meter, (v) => {
      f.meter = v;
      pattern = null;
      save();
    }),
    segmented('Pattern length', [1, 2, 4].map((b) => ({ value: b, label: b === 1 ? '1 bar' : `${b} bars` })), f.bars, (v) => {
      f.bars = v as 1 | 2 | 4;
      pattern = null;
      save();
    }),
    segmented<Complexity>(
      'Complexity',
      [
        { value: 'easy', label: 'Easy' },
        { value: 'medium', label: 'Medium' },
        { value: 'hard', label: 'Hard' },
        { value: 'random', label: 'Random' },
      ],
      f.complexity,
      (v) => {
        f.complexity = v;
        pattern = null;
        save();
      },
    ),
    segmented('Drum kit', KITS.map((k) => ({ value: k.id, label: k.name })), settings.kit, (v) => {
      settings.kit = v;
      save();
    }),
    toggle('Loop this pattern', f.loop, (v) => {
      f.loop = v;
      save();
    }, 'Repeat the same pattern until you nail it'),
  );

  // --- Session stats ---
  const sessionEl = h('div', { class: 'hud' });
  const renderSession = () => {
    const avg = session.rounds ? Math.round(session.sum / session.rounds) : 0;
    sessionEl.replaceChildren(
      stat('Tempo', String(f.bpm)),
      stat('Rounds', String(session.rounds)),
      stat('Average', session.rounds ? `${avg}%` : '–'),
      stat('Streak', String(session.streak)),
      stat('Best', String(session.best)),
    );
  };

  const summary = h('p', { class: 'tip' });
  const renderSummary = () => {
    summary.textContent = `${f.bpm} BPM · ${f.meter} · ${f.bars === 1 ? '1 bar' : `${f.bars} bars`} · ${cap(f.complexity)}${f.loop ? ' · Looping' : ''}`;
  };

  const nextPattern = (): Pattern => {
    if (pattern && f.loop) return pattern;
    const meter = METERS[f.meter] ?? METERS['4/4'];
    const c = f.complexity === 'random' ? (['easy', 'medium', 'hard'] as const)[Math.floor(rng() * 3)] : f.complexity;
    pattern = generatePattern({ meter, bars: f.bars, cells: freedomCells(c, meter.unit) }, rng);
    return pattern;
  };

  const startBtn = h('button', { class: 'btn primary big' }, 'Start');
  const stopBtn = h('button', { class: 'btn ghost' }, 'Back');
  const playArea = h('div', { class: 'play-area hidden' }, sessionEl, summary, view.el);

  const loop = async (id: number) => {
    if (id !== runId || destroyed) return;
    const p = nextPattern();
    const result = await view.runRound(p, f.bpm);
    if (id !== runId || destroyed) return;
    if (result) {
      session.rounds++;
      session.sum += result.accuracy;
      session.streak = result.passed ? session.streak + 1 : 0;
      session.best = Math.max(session.best, session.streak);
      if (session.best > stats.freedomBestStreak) stats.freedomBestStreak = session.best;
      saveStats();
      renderSession();
    }
    timer = window.setTimeout(() => loop(id), GAP_MS);
  };

  const start = async () => {
    if (!(await prepareInput())) return;
    playing = true;
    setup.classList.add('hidden');
    playArea.classList.remove('hidden');
    startBtn.classList.add('hidden');
    stopBtn.textContent = 'Stop';
    renderSession();
    renderSummary();
    loop(++runId);
  };

  const stop = () => {
    playing = false;
    runId++;
    clearTimeout(timer);
    view.stop();
    setup.classList.remove('hidden');
    playArea.classList.add('hidden');
    startBtn.classList.remove('hidden');
    stopBtn.textContent = 'Back';
  };

  startBtn.onclick = start;
  stopBtn.onclick = () => (playing ? stop() : go('home'));

  const el = h(
    'main',
    { class: 'screen play-screen' },
    topBar('Freedom', () => go('home')),
    setup,
    playArea,
    h('div', { class: 'controls' }, stopBtn, startBtn),
  );

  return {
    el,
    destroy: () => {
      destroyed = true;
      playing = false;
      runId++;
      clearTimeout(timer);
      view.stop();
    },
  };
}


function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
