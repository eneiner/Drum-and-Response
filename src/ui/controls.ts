import { h } from './dom';

/** Segmented control (radio-button group styled as pills). */
export function segmented<T extends string | number>(
  label: string,
  options: { value: T; label: string }[],
  value: T,
  onChange: (v: T) => void,
): HTMLElement {
  const buttons = options.map((o) =>
    h(
      'button',
      {
        class: 'seg',
        role: 'radio',
        'aria-checked': String(o.value === value),
        on: {
          click: () => {
            buttons.forEach((b, i) => b.setAttribute('aria-checked', String(options[i].value === o.value)));
            onChange(o.value);
          },
        },
      },
      o.label,
    ),
  );
  return h('div', { class: 'field' }, h('span', { class: 'field-label' }, label), h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label }, ...buttons));
}

export function toggle(label: string, value: boolean, onChange: (v: boolean) => void, hint?: string): HTMLElement {
  const input = h('input', { type: 'checkbox', class: 'switch' });
  input.checked = value;
  input.addEventListener('change', () => onChange(input.checked));
  return h(
    'label',
    { class: 'field toggle-field' },
    h('span', null, h('span', { class: 'field-label' }, label), hint ? h('span', { class: 'field-hint' }, hint) : null),
    input,
  );
}

export function slider(
  label: string,
  opts: { min: number; max: number; step?: number; value: number; format?: (v: number) => string },
  onInput: (v: number) => void,
): { el: HTMLElement; set: (v: number) => void } {
  const out = h('span', { class: 'field-value' });
  const input = h('input', { type: 'range', min: opts.min, max: opts.max, step: opts.step ?? 1 });
  const fmt = opts.format ?? String;
  const set = (v: number) => {
    input.value = String(v);
    out.textContent = fmt(v);
  };
  set(opts.value);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = fmt(v);
    onInput(v);
  });
  return {
    el: h('label', { class: 'field' }, h('span', { class: 'field-row' }, h('span', { class: 'field-label' }, label), out), input),
    set,
  };
}

/** Live input level bar for the microphone. */
export function levelMeter(): { el: HTMLElement; set: (level: number, threshold: number) => void } {
  const fill = h('div', { class: 'meter-fill' });
  const mark = h('div', { class: 'meter-mark' });
  const el = h('div', { class: 'meter', 'aria-hidden': 'true' }, fill, mark);
  const toPct = (v: number) => Math.min(100, Math.max(0, ((Math.log10(Math.max(v, 1e-4)) + 4) / 4) * 100));
  return {
    el,
    set: (level, threshold) => {
      fill.style.width = `${toPct(level)}%`;
      mark.style.left = `${toPct(threshold)}%`;
      el.classList.toggle('over', level > threshold);
    },
  };
}
