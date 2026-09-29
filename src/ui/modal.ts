import { h } from './dom';

export interface ModalButton {
  label: string;
  primary?: boolean;
  value: string;
}

/** Simple promise-based modal dialog. Resolves with the chosen button's value. */
export function modal(title: string, body: (string | Node)[], buttons: ModalButton[]): Promise<string> {
  return new Promise((resolve) => {
    const close = (v: string) => {
      overlay.remove();
      resolve(v);
    };
    const overlay = h(
      'div',
      { class: 'modal-overlay' },
      h(
        'div',
        { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
        h('h2', null, title),
        ...body.map((b) => (typeof b === 'string' ? h('p', null, b) : b)),
        h(
          'div',
          { class: 'modal-actions' },
          ...buttons.map((b) =>
            h('button', { class: b.primary ? 'btn primary' : 'btn', on: { click: () => close(b.value) } }, b.label),
          ),
        ),
      ),
    );
    document.body.append(overlay);
    overlay.querySelector<HTMLButtonElement>('.btn.primary')?.focus();
  });
}
