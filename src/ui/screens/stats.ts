import { resetStats, stats } from '../../storage';
import { h, stat, topBar } from '../dom';
import { modal } from '../modal';
import { go, type Screen } from '../router';

export function statsScreen(): Screen {
  const avg = stats.roundsPlayed ? Math.round(stats.accuracySum / stats.roundsPlayed) : 0;
  const el = h(
    'main',
    { class: 'screen' },
    topBar('Stats', () => go('home')),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Challenge'),
      h(
        'div',
        { class: 'stat-grid' },
        stat('High score', stats.highScore.toLocaleString()),
        stat('Highest level', String(stats.highestLevel || '–')),
        stat('Best streak', String(stats.bestStreak)),
      ),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'All play'),
      h(
        'div',
        { class: 'stat-grid' },
        stat('Rounds', stats.roundsPlayed.toLocaleString()),
        stat('Avg accuracy', stats.roundsPlayed ? `${avg}%` : '–'),
        stat('Perfect hits', stats.perfectHits.toLocaleString()),
        stat('Freedom streak', String(stats.freedomBestStreak)),
      ),
    ),
    h(
      'button',
      {
        class: 'btn ghost danger',
        on: {
          click: async () => {
            const ok = await modal('Reset stats?', ['This clears your high score and history on this device.'], [
              { label: 'Cancel', value: 'no' },
              { label: 'Reset', primary: true, value: 'yes' },
            ]);
            if (ok === 'yes') {
              resetStats();
              go('stats');
            }
          },
        },
      },
      'Reset stats',
    ),
  );
  return { el };
}
