// Small UI primitives: icons, toasts, dialogs (native <dialog>), popover menu.

export const $ = (sel, root = document) => root.querySelector(sel);

export function icon(name, cls = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `icon ${cls}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `assets/icons.svg#i-${name}`);
  svg.append(use);
  return svg;
}

/** Create an element: el('button', { class: 'x', onclick }, child, 'text') */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

/* ---------- toasts ---------- */

const toasts = $('#toasts');

export function toast(message, { type = 'info', action, timeout = 3500 } = {}) {
  const node = el('div', { class: `toast toast--${type}`, role: type === 'error' ? 'alert' : 'status' }, el('span', {}, message));
  if (action) {
    node.append(el('button', { type: 'button', onclick: () => { action.run(); node.remove(); } }, action.label));
  }
  toasts.append(node);
  if (timeout) setTimeout(() => node.remove(), timeout);
  return node;
}

/* ---------- dialogs ---------- */

const dlg = $('#dialog');
const dlgTitle = $('#dialogTitle');
const dlgText = $('#dialogText');
const dlgField = $('#dialogField');
const dlgLabel = $('#dialogLabel');
const dlgInput = $('#dialogInput');
const dlgError = $('#dialogError');
const dlgOk = $('#dialogOk');

/**
 * Open the shared dialog.
 *  - prompt mode (input: true) resolves to the entered string or null
 *  - confirm mode resolves to true/false
 * `validate(value)` may return an error string, or an async function may throw
 * from `submit(value)` to keep the dialog open with the error shown.
 */
function openDialog({ title, text = '', input = false, label = 'Name', value = '', okLabel = 'OK', danger = false, submit, selectStem = false }) {
  dlgTitle.textContent = title;
  dlgText.textContent = text;
  dlgField.hidden = !input;
  dlgLabel.textContent = label;
  dlgInput.value = value;
  dlgInput.required = input;
  dlgError.textContent = '';
  dlgOk.textContent = okLabel;
  dlgOk.className = `btn ${danger ? 'btn--danger' : 'btn--primary'}`;

  return new Promise((resolve) => {
    const onSubmit = async (e) => {
      if (e.submitter?.value !== 'ok') return; // Cancel → native close
      e.preventDefault();
      const v = dlgInput.value.trim();
      if (input && !v) { dlgError.textContent = 'Please enter a name'; return; }
      if (submit) {
        dlgOk.disabled = true;
        try { await submit(v); }
        catch (err) { dlgError.textContent = err.message; dlgOk.disabled = false; dlgInput.focus(); return; }
        dlgOk.disabled = false;
      }
      cleanup();
      dlg.close('ok');
      resolve(input ? v : true);
    };
    const onClose = () => { cleanup(); resolve(input ? null : false); };
    const cleanup = () => {
      dlg.removeEventListener('submit', onSubmit);
      dlg.removeEventListener('close', onClose);
    };
    dlg.addEventListener('submit', onSubmit);
    dlg.addEventListener('close', onClose, { once: true });
    dlg.showModal();
    if (input) {
      dlgInput.focus();
      const dot = selectStem ? value.lastIndexOf('.') : -1;
      dlgInput.setSelectionRange(0, dot > 0 ? dot : value.length);
    } else {
      // destructive confirmations start on Cancel so Enter can't destroy by accident
      (danger ? dlg.querySelector('button[value="cancel"]') : dlgOk).focus();
    }
  });
}

export const prompt = (opts) => openDialog({ ...opts, input: true });
export const confirm = (opts) => openDialog({ ...opts, input: false });

/* ---------- popover menu ---------- */

const menu = $('#menu');
const menuItems = $('#menuItems');
let menuOwner = null;

/** items: [{ label, icon, run, danger }] or 'sep' */
export function openMenu(anchor, items) {
  if (menuOwner === anchor && menu.matches(':popover-open')) { menu.hidePopover(); return; }
  menuItems.replaceChildren(...items.map((it) => it === 'sep'
    ? el('hr')
    : el('button', {
        type: 'button', role: 'menuitem', class: it.danger ? 'is-danger' : '',
        onclick: () => { menu.hidePopover(); it.run(); },
      }, icon(it.icon), it.label)));

  menuOwner?.setAttribute('aria-expanded', 'false');
  menuOwner = anchor;
  anchor.setAttribute('aria-expanded', 'true');
  menu.showPopover();

  // position under the anchor, kept inside the viewport
  const a = anchor.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  const left = Math.min(Math.max(8, a.right - m.width), innerWidth - m.width - 8);
  const top = a.bottom + 4 + m.height > innerHeight ? a.top - m.height - 4 : a.bottom + 4;
  menu.style.left = `${left}px`;
  menu.style.top = `${Math.max(8, top)}px`;
  menuItems.querySelector('[role="menuitem"]')?.focus();
}

menu.addEventListener('toggle', (e) => {
  if (e.newState === 'closed' && menuOwner) {
    menuOwner.setAttribute('aria-expanded', 'false');
    if (document.activeElement === document.body || menu.contains(document.activeElement)) menuOwner.focus();
    menuOwner = null;
  }
});

menu.addEventListener('keydown', (e) => {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const items = [...menuItems.querySelectorAll('[role="menuitem"]')];
  const i = items.indexOf(document.activeElement);
  const next = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
  items[(next + items.length) % items.length]?.focus();
});
