export interface Screen {
  el: HTMLElement;
  destroy?: () => void;
}

export type ScreenName = 'home' | 'challenge' | 'freedom' | 'calibrate' | 'settings' | 'stats';
type Factory = () => Screen;

const factories = new Map<ScreenName, Factory>();
let current: Screen | null = null;
let root: HTMLElement;

export function register(name: ScreenName, f: Factory): void {
  factories.set(name, f);
}

export function mount(el: HTMLElement): void {
  root = el;
}

export function go(name: ScreenName): void {
  current?.destroy?.();
  const f = factories.get(name);
  if (!f) throw new Error(`Unknown screen ${name}`);
  current = f();
  root.replaceChildren(current.el);
  root.scrollTop = 0;
  window.scrollTo(0, 0);
}
