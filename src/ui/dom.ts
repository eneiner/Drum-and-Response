type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown> & {
  class?: string;
  style?: string;
  on?: Partial<Record<keyof HTMLElementEventMap, (e: Event) => void>>;
};

/** Tiny hyperscript helper: h('button', { class: 'btn', on: { click } }, 'Go'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'on' && v) {
        for (const [ev, fn] of Object.entries(v as Record<string, EventListener>)) el.addEventListener(ev, fn);
      } else if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (typeof v === 'boolean') {
        if (v) el.setAttribute(k, '');
      } else if (v !== undefined && v !== null) el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export function vibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

/** Header bar with a back button and a title. */
export function topBar(title: string, onBack?: () => void, right?: Node): HTMLElement {
  return h(
    'header',
    { class: 'topbar' },
    onBack ? h('button', { class: 'icon-btn', 'aria-label': 'Back', on: { click: onBack } }, '‹') : h('span', { class: 'icon-btn-spacer' }),
    h('h1', null, title),
    right ?? h('span', { class: 'icon-btn-spacer' }),
  );
}

/** Small label/value tile used in HUDs. */
export function stat(label: string, value: string): HTMLElement {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-value' }, value));
}
