import { settings, stats } from '../../storage';
import { h } from '../dom';
import { go, type Screen } from '../router';

export function homeScreen(): Screen {
  const needsCalibration = settings.inputMode === 'mic' && !settings.micCalibrated;
  const el = h(
    'main',
    { class: 'screen home' },
    h(
      'div',
      { class: 'hero' },
      h('div', { class: 'logo', 'aria-hidden': 'true' }, h('span'), h('span'), h('span'), h('span')),
      h('h1', null, 'Drum ', h('em', null, '&'), ' Response'),
      h('p', { class: 'tagline' }, 'Hear the beat. Clap it back.'),
    ),
    needsCalibration
      ? h(
          'button',
          { class: 'banner', on: { click: () => go('calibrate') } },
          h('b', null, 'First time? '),
          'Calibrate your mic for accurate timing (20 seconds) ›',
        )
      : null,
    h(
      'nav',
      { class: 'menu' },
      h(
        'button',
        { class: 'mode-card challenge', on: { click: () => go('challenge') } },
        h('span', { class: 'mode-title' }, 'Challenge'),
        h('span', { class: 'mode-sub' }, 'Patterns get harder and faster. 3 lives.'),
        stats.highScore > 0 ? h('span', { class: 'mode-meta' }, `Best ${stats.highScore.toLocaleString()} · Level ${stats.highestLevel}`) : null,
      ),
      h(
        'button',
        { class: 'mode-card freedom', on: { click: () => go('freedom') } },
        h('span', { class: 'mode-title' }, 'Freedom'),
        h('span', { class: 'mode-sub' }, 'Pick your tempo and style. Endless call and response.'),
      ),
    ),
    h(
      'div',
      { class: 'menu-row' },
      h('button', { class: 'btn ghost', on: { click: () => go('calibrate') } }, 'Calibrate'),
      h('button', { class: 'btn ghost', on: { click: () => go('stats') } }, 'Stats'),
      h('button', { class: 'btn ghost', on: { click: () => go('settings') } }, 'Settings'),
    ),
    h('p', { class: 'hint' }, settings.inputMode === 'mic' ? 'Input: microphone (clap or tap a table)' : 'Input: screen taps'),
  );
  return { el };
}
