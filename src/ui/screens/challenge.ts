import { levelInfo } from '../../game/levels';
import { generatePattern } from '../../game/patterns';
import type { Pattern } from '../../game/types';
import { saveStats, stats } from '../../storage';
import { h, stat, topBar } from '../dom';
import { prepareInput } from '../input';
import { PlayView } from '../play';
import { go, type Screen } from '../router';

const START_LIVES = 3;
const AUTO_NEXT_MS = 2500;

export function challengeScreen(): Screen {
  let level = 1;
  let lives = START_LIVES;
  let score = 0;
  let streak = 0;
  let retryUsed = false;
  let info = levelInfo(level);
  let pattern: Pattern = generatePattern(info.difficulty);
  let autoTimer = 0;
  let destroyed = false;
  let over = false;

  const view = new PlayView();
  const hud = h('div', { class: 'hud' });
  const tip = h('p', { class: 'tip' });
  const status = h('p', { class: 'status', 'aria-live': 'polite' });
  const primary = h('button', { class: 'btn primary big' }, 'Start');
  const secondary = h('button', { class: 'btn ghost' }, 'Quit');

  const renderHud = () => {
    const hearts = '♥'.repeat(lives) + '♡'.repeat(START_LIVES - lives);
    hud.replaceChildren(
      stat('Level', String(level)),
      stat('Tempo', `${info.bpm}`),
      stat('Score', score.toLocaleString()),
      stat('Streak', streak ? `×${multiplier().toFixed(1)}` : '–'),
      h('div', { class: 'lives', 'aria-label': `${lives} lives` }, hearts),
    );
    tip.replaceChildren(h('b', null, info.tier.name), info.newTier ? ` · ${info.tier.tip}` : '');
  };

  const multiplier = () => Math.min(2, 1 + streak * 0.1);

  const setButtons = (label: string, action: () => void, auto = false) => {
    primary.textContent = label;
    primary.onclick = () => {
      clearTimeout(autoTimer);
      action();
    };
    primary.disabled = false;
    if (auto) {
      clearTimeout(autoTimer);
      autoTimer = window.setTimeout(() => !destroyed && action(), AUTO_NEXT_MS);
    }
  };

  const play = async () => {
    clearTimeout(autoTimer);
    if (!(await prepareInput())) return;
    primary.disabled = true;
    primary.textContent = 'Playing…';
    secondary.textContent = 'Stop';
    status.textContent = '';
    const result = await view.runRound(pattern, info.bpm);
    if (destroyed) return;
    secondary.textContent = 'Quit';
    if (!result) {
      setButtons('Start', play);
      return;
    }

    if (result.passed) {
      const gained = Math.round(result.accuracy * level * multiplier());
      score += gained;
      streak++;
      stats.bestStreak = Math.max(stats.bestStreak, streak);
      level++;
      retryUsed = false;
      status.textContent = `+${gained} points!`;
      info = levelInfo(level);
      pattern = generatePattern(info.difficulty);
      stats.highestLevel = Math.max(stats.highestLevel, level);
      renderHud();
      setButtons(info.newTier ? `New: ${info.tier.name} ›` : 'Next level ›', play, !info.newTier);
    } else if (!retryUsed) {
      retryUsed = true;
      streak = 0;
      status.textContent = 'Not quite. One more try at this pattern.';
      renderHud();
      setButtons('Try again', play, true);
    } else {
      lives--;
      streak = 0;
      retryUsed = false;
      renderHud();
      if (lives <= 0) {
        gameOver();
      } else {
        status.textContent = `Lost a life. New pattern, same level.`;
        pattern = generatePattern(info.difficulty);
        setButtons('Continue', play, true);
      }
    }
    stats.highScore = Math.max(stats.highScore, score);
    saveStats();
  };

  const gameOver = () => {
    over = true;
    const best = score >= stats.highScore && score > 0;
    stats.highScore = Math.max(stats.highScore, score);
    saveStats();
    status.replaceChildren(
      h('span', { class: 'game-over' }, 'Game over'),
      h('br'),
      `Score ${score.toLocaleString()} · reached level ${level}`,
      best ? h('span', { class: 'new-best' }, ' · New best!') : '',
    );
    setButtons('Play again', () => {
      level = 1;
      lives = START_LIVES;
      score = 0;
      streak = 0;
      retryUsed = false;
      over = false;
      info = levelInfo(level);
      pattern = generatePattern(info.difficulty);
      renderHud();
      view.preview(pattern);
      play();
    });
  };

  secondary.onclick = () => {
    clearTimeout(autoTimer);
    if (view.running) view.stop();
    else go('home');
  };
  primary.onclick = play;

  renderHud();
  view.preview(pattern);

  const el = h(
    'main',
    { class: 'screen play-screen' },
    topBar('Challenge', () => go('home')),
    hud,
    tip,
    view.el,
    status,
    h('div', { class: 'controls' }, secondary, primary),
  );

  return {
    el,
    destroy: () => {
      destroyed = true;
      clearTimeout(autoTimer);
      view.stop();
      if (!over && score > 0) {
        stats.highScore = Math.max(stats.highScore, score);
        saveStats();
      }
    },
  };
}
