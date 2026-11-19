// Folder/note tree (disclosure pattern: folders are buttons with aria-expanded).

import { el, icon } from './ui.js';

const KEY = 'mstmd:expanded';

export class Tree {
  constructor(root, { onOpen, onMenu }) {
    this.root = root;
    this.onOpen = onOpen;
    this.onMenu = onMenu;
    this.items = [];
    this.active = null;
    try { this.expanded = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); }
    catch { this.expanded = new Set(); }

    root.addEventListener('keydown', (e) => this.#keys(e));
  }

  set(items) { this.items = items; this.render(); }

  setActive(path) {
    this.active = path;
    if (path) this.reveal(path); else this.render();
  }

  /** Expand all ancestors of a path and re-render. */
  reveal(path) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) this.expanded.add(parts.slice(0, i).join('/'));
    this.#persist();
    this.render();
    this.root.querySelector('.tree__row.is-active')?.scrollIntoView({ block: 'nearest' });
  }

  expand(path) { this.expanded.add(path); this.#persist(); }

  forget(path) {
    for (const p of [...this.expanded]) if (p === path || p.startsWith(`${path}/`)) this.expanded.delete(p);
    this.#persist();
  }

  find(path, list = this.items) {
    for (const it of list) {
      if (it.path === path) return it;
      if (it.children) { const f = this.find(path, it.children); if (f) return f; }
    }
    return null;
  }

  render() {
    if (!this.items.length) {
      this.root.replaceChildren(el('p', { class: 'tree__empty' }, 'No notes yet.'));
      return;
    }
    const focusedPath = document.activeElement?.closest?.('.tree')?.contains(document.activeElement)
      ? document.activeElement.dataset.path : null;
    this.root.replaceChildren(this.#list(this.items));
    if (focusedPath) this.root.querySelector(`.tree__item[data-path="${CSS.escape(focusedPath)}"]`)?.focus();
  }

  #list(items) {
    return el('ul', { role: 'list' }, items.map((it) => this.#node(it)));
  }

  #node(it) {
    const isFolder = it.type === 'folder';
    const open = isFolder && this.expanded.has(it.path);
    const stem = isFolder ? it.name : it.name.replace(/\.md$/i, '');

    const main = el('button', {
      type: 'button', class: 'tree__item',
      'data-path': it.path,
      'aria-expanded': isFolder ? String(open) : null,
      'aria-current': !isFolder && it.path === this.active ? 'page' : null,
      title: it.path,
      onclick: () => isFolder ? this.#toggle(it.path) : this.onOpen(it.path),
    },
      isFolder ? icon('chevron-right', 'tree__chev') : el('span', { class: 'tree__spacer' }),
      icon(isFolder ? (open ? 'folder-open' : 'folder') : 'file-text'),
      el('span', { class: 'tree__name' }, stem),
    );

    const more = el('button', {
      type: 'button', class: 'icon-btn tree__more',
      'aria-label': `Actions for ${stem}`, 'aria-haspopup': 'menu', 'aria-expanded': 'false',
      onclick: (e) => { e.stopPropagation(); this.onMenu(it, more); },
    }, icon('ellipsis'));

    const row = el('div', { class: `tree__row${it.path === this.active ? ' is-active' : ''}` }, main, more);
    row.addEventListener('contextmenu', (e) => { e.preventDefault(); this.onMenu(it, more); });

    return el('li', {}, row, open && it.children?.length ? this.#list(it.children) : null);
  }

  #toggle(path) {
    this.expanded.has(path) ? this.expanded.delete(path) : this.expanded.add(path);
    this.#persist();
    this.render();
  }

  #persist() {
    try { localStorage.setItem(KEY, JSON.stringify([...this.expanded])); } catch { /* private mode */ }
  }

  // Arrow-key navigation between rows; Left/Right collapse/expand folders.
  #keys(e) {
    const t = e.target;
    if (!t.classList?.contains('tree__item')) return;
    const all = [...this.root.querySelectorAll('.tree__item')];
    const i = all.indexOf(t);
    const path = t.dataset.path;
    switch (e.key) {
      case 'ArrowDown': all[i + 1]?.focus(); break;
      case 'ArrowUp': all[i - 1]?.focus(); break;
      case 'Home': all[0]?.focus(); break;
      case 'End': all.at(-1)?.focus(); break;
      case 'ArrowRight':
        if (t.getAttribute('aria-expanded') === 'false') this.#toggle(path); else all[i + 1]?.focus();
        break;
      case 'ArrowLeft':
        if (t.getAttribute('aria-expanded') === 'true') this.#toggle(path);
        else if (path.includes('/')) this.root.querySelector(`.tree__item[data-path="${CSS.escape(path.slice(0, path.lastIndexOf('/')))}"]`)?.focus();
        break;
      case 'F2': {
        const it = this.find(path);
        if (it) this.onMenu(it, t.nextElementSibling ?? t);
        break;
      }
      default: return;
    }
    e.preventDefault();
  }
}
