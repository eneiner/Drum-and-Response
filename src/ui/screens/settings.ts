import { KITS } from '../../audio/kits';
import { mic } from '../../audio/mic';
import { thresholdFor } from '../../audio/onsetCore';
import { saveSettings, settings, type ClickLevel, type InputMode } from '../../storage';
import { h, topBar } from '../dom';
import { levelMeter, segmented, slider, toggle } from '../controls';
import { prepareInput } from '../input';
import { go, type Screen } from '../router';

export function settingsScreen(): Screen {
  let unsub: (() => void) | null = null;
  const meter = levelMeter();
  const meterHint = h('p', { class: 'field-hint' }, 'Tap "Test mic" and clap. Claps should cross the line.');
  const testBtn = h('button', { class: 'btn small' }, 'Test mic');

  const startMeter = async () => {
    if (settings.inputMode !== 'mic') return;
    if (!(await prepareInput())) return;
    unsub?.();
    unsub = mic.onLevel((l) => meter.set(l, thresholdFor(settings.sensitivity)));
    testBtn.textContent = 'Listening…';
  };
  testBtn.onclick = startMeter;

  const sens = slider('Mic sensitivity', { min: 1, max: 10, value: settings.sensitivity }, (v) => {
    settings.sensitivity = v;
    mic.setSensitivity(v);
    saveSettings();
  });

  const micSection = h(
    'section',
    { class: 'card' },
    h('div', { class: 'field-row' }, h('span', { class: 'field-label' }, 'Input level'), testBtn),
    meter.el,
    meterHint,
    sens.el,
  );
  const showMic = () => micSection.classList.toggle('hidden', settings.inputMode !== 'mic');

  const el = h(
    'main',
    { class: 'screen' },
    topBar('Settings', () => go('home')),
    h(
      'section',
      { class: 'card' },
      segmented<InputMode>(
        'Input',
        [
          { value: 'mic', label: 'Microphone' },
          { value: 'tap', label: 'Screen tap' },
        ],
        settings.inputMode,
        (v) => {
          settings.inputMode = v;
          saveSettings();
          showMic();
        },
      ),
      h('p', { class: 'field-hint' }, 'Microphone hears claps and table taps. Screen tap works anywhere, even in noisy places.'),
      segmented<ClickLevel>(
        'Metronome during your turn',
        [
          { value: 'off', label: 'Off' },
          { value: 'quiet', label: 'Quiet' },
          { value: 'normal', label: 'Normal' },
        ],
        settings.responseClick,
        (v) => {
          settings.responseClick = v;
          saveSettings();
        },
      ),
      segmented('Drum kit', KITS.map((k) => ({ value: k.id, label: k.name })), settings.kit, (v) => {
        settings.kit = v;
        saveSettings();
      }),
      toggle('Haptics', settings.haptics, (v) => {
        settings.haptics = v;
        saveSettings();
      }, 'Buzz on Perfect hits (Android)'),
    ),
    micSection,
    h(
      'section',
      { class: 'card' },
      h('p', { class: 'field-label' }, 'Timing calibration'),
      h('p', { class: 'field-hint' }, `Mic: ${settings.micCalibrated ? `${Math.round(settings.micOffset * 1000)} ms` : 'not calibrated'} · Tap: ${Math.round(settings.tapOffset * 1000)} ms`),
      h('button', { class: 'btn', on: { click: () => go('calibrate') } }, 'Recalibrate'),
    ),
  );
  showMic();
  return { el, destroy: () => unsub?.() };
}
