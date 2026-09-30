import { audio } from '../../audio/engine';
import { mic } from '../../audio/mic';
import { thresholdFor } from '../../audio/onsetCore';
import { calibrationOffset } from '../../game/tempo';
import { saveSettings, settings } from '../../storage';
import { h, topBar } from '../dom';
import { levelMeter, slider } from '../controls';
import { prepareInput } from '../input';
import { go, type Screen } from '../router';

const BPM = 90;
const LEAD_IN = 4;
const MEASURED = 8;

/**
 * Latency calibration: the player claps along with 12 clicks (4 lead-in + 8 measured).
 * The median gap between each click and the matching clap is saved and subtracted from
 * every future hit. This covers speaker delay, mic delay and the player's own habit.
 */
export function calibrateScreen(): Screen {
  let destroyed = false;
  let unsubOnset: (() => void) | null = null;
  let unsubLevel: (() => void) | null = null;
  let raf = 0;
  let bus: GainNode | null = null;

  const isMic = () => settings.inputMode === 'mic';
  const dots = Array.from({ length: LEAD_IN + MEASURED }, (_, i) => h('span', { class: i < LEAD_IN ? 'cal-dot lead' : 'cal-dot' }));
  const status = h('p', { class: 'status', 'aria-live': 'polite' });
  const current = h('p', { class: 'cal-current' });
  const meter = levelMeter();
  const pad = h('div', { class: 'cal-pad' }, ...dots);
  const startBtn = h('button', { class: 'btn primary big' }, 'Start');

  const sens = slider('Mic sensitivity', { min: 1, max: 10, value: settings.sensitivity }, (v) => {
    settings.sensitivity = v;
    mic.setSensitivity(v);
    saveSettings();
  });

  const renderCurrent = () => {
    const off = isMic() ? settings.micOffset : settings.tapOffset;
    const done = isMic() ? settings.micCalibrated : settings.tapOffset !== 0;
    current.textContent = done ? `Current offset: ${Math.round(off * 1000)} ms` : 'Not calibrated yet';
  };

  const hookMic = () => {
    if (!isMic() || unsubLevel) return;
    unsubLevel = mic.onLevel((l) => meter.set(l, thresholdFor(settings.sensitivity)));
  };

  const run = async () => {
    if (!(await prepareInput())) return;
    hookMic();
    startBtn.disabled = true;
    startBtn.textContent = 'Clap along…';
    dots.forEach((d) => d.classList.remove('on', 'got'));
    status.textContent = 'Clap on every click. The first 4 are warm-up.';

    const beat = 60 / BPM;
    const t0 = audio.now + 0.4;
    bus = audio.createBus();
    const clicks: number[] = [];
    for (let i = 0; i < LEAD_IN + MEASURED; i++) {
      const t = t0 + i * beat;
      audio.click(t, i % 4 === 0, bus, 0.9);
      if (i >= LEAD_IN) clicks.push(t);
    }
    const hits: number[] = [];
    const record = (t: number) => {
      hits.push(t);
      const i = Math.round((t - t0) / beat);
      dots[i]?.classList.add('got');
    };
    if (isMic()) {
      unsubOnset = mic.onOnset((t) => record(t));
    } else {
      const onTap = (e: PointerEvent) => {
        e.preventDefault();
        record(audio.eventToAudioTime(e.timeStamp));
      };
      pad.addEventListener('pointerdown', onTap);
      unsubOnset = () => pad.removeEventListener('pointerdown', onTap);
    }

    const end = t0 + (LEAD_IN + MEASURED) * beat + 0.3;
    const tick = () => {
      if (destroyed) return;
      const heard = audio.now - audio.outputLatency;
      const i = Math.floor((heard - t0) / beat);
      dots.forEach((d, j) => d.classList.toggle('on', j === i));
      if (audio.now < end) {
        raf = requestAnimationFrame(tick);
        return;
      }
      unsubOnset?.();
      unsubOnset = null;
      dots.forEach((d) => d.classList.remove('on'));
      startBtn.disabled = false;
      startBtn.textContent = 'Try again';
      const offset = calibrationOffset(clicks, hits);
      if (offset === null) {
        status.textContent = isMic()
          ? 'Didn\'t hear enough claps. Clap louder or raise the sensitivity, then try again.'
          : 'Not enough taps landed. Try again, tapping with each click.';
        return;
      }
      if (isMic()) {
        settings.micOffset = offset;
        settings.micCalibrated = true;
        settings.micCalOutputLatency = audio.outputLatency;
      } else {
        settings.tapOffset = offset;
      }
      saveSettings();
      renderCurrent();
      status.textContent = `Saved! Offset ${Math.round(offset * 1000)} ms. You're all set.`;
      startBtn.textContent = 'Done';
      startBtn.onclick = () => go('home');
    };
    raf = requestAnimationFrame(tick);
  };
  startBtn.onclick = run;

  if (mic.active) hookMic();
  renderCurrent();

  const el = h(
    'main',
    { class: 'screen' },
    topBar('Calibrate', () => go('home')),
    h(
      'section',
      { class: 'card' },
      h('p', null, isMic()
        ? 'Every phone hears a little late. Clap along with 12 clicks so we can measure the delay and keep your scores fair.'
        : 'Tap the pad along with 12 clicks so we can measure your screen\'s delay.'),
      pad,
      status,
      current,
    ),
    isMic()
      ? h(
          'section',
          { class: 'card' },
          h('p', { class: 'field-label' }, 'Input level'),
          meter.el,
          h('p', { class: 'field-hint' }, 'Claps should cross the line; background noise should stay below it.'),
          sens.el,
        )
      : null,
    h('div', { class: 'controls' }, startBtn),
  );

  return {
    el,
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      unsubOnset?.();
      unsubLevel?.();
      bus?.disconnect();
    },
  };
}
