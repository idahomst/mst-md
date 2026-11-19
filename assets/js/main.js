// mst·md — application controller.

import { api, ApiError } from './api.js';
import { $, el, icon, toast, prompt, confirm, openMenu } from './ui.js';
import { render } from './markdown.js';
import { Tree } from './tree.js';

const root = document.documentElement;
const app = $('#app');
const editor = $('#editor');
const preview = $('#preview');
const previewPane = $('#previewPane');
const docName = $('#docName');
const docPath = $('#docPath');
const docDirty = $('#docDirty');
const docMenuBtn = $('#docMenuBtn');
const saveState = $('#saveState');
const stats = $('#stats');
const searchInput = $('#search');
const treeSection = $('#treeSection');
const results = $('#results');
const resultsList = $('#resultsList');
const resultsTitle = $('#resultsTitle');
const divider = $('#divider');
const workspace = $('#workspace');
const narrow = matchMedia('(max-width: 820px)');

const AUTOSAVE_MS = 1200;
const store = {
  get: (k) => { try { return localStorage.getItem(`mstmd:${k}`); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(`mstmd:${k}`, v); } catch { /* ignore */ } },
  del: (k) => { try { localStorage.removeItem(`mstmd:${k}`); } catch { /* ignore */ } },
};

/** The open note. `saved` is the content last confirmed by the server. */
const doc = { path: null, saved: '', version: null, saving: null, conflict: false };
const isDirty = () => doc.path !== null && editor.value !== doc.saved;

/* ==========================================================================
   Tree
   ========================================================================== */

const tree = new Tree($('#tree'), {
  onOpen: (path) => { openNote(path); closeSidebar(); },
  onMenu: (item, anchor) => openMenu(anchor, itemMenu(item)),
});

async function loadTree() {
  try {
    const { tree: items } = await api.tree();
    tree.set(items);
  } catch (err) {
    $('#tree').replaceChildren(el('p', { class: 'tree__empty tree__fail' }, `Could not load notes: ${err.message}`));
    handleError(err, 'Could not load notes');
  }
}

const parentOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const stemOf = (name) => name.replace(/\.md$/i, '');

function itemMenu(item) {
  const folder = item.type === 'folder';
  return [
    ...(folder
      ? [
          { label: 'New note here', icon: 'file-plus', run: () => newNote(item.path) },
          { label: 'New folder here', icon: 'folder-plus', run: () => newFolder(item.path) },
        ]
      : [{ label: 'Open', icon: 'file-text', run: () => { openNote(item.path); closeSidebar(); } }]),
    'sep',
    { label: 'Rename…', icon: 'pencil', run: () => renameItem(item) },
    { label: 'Delete…', icon: 'trash-2', danger: true, run: () => deleteItem(item) },
  ];
}

/* ==========================================================================
   Open / save
   ========================================================================== */

async function openNote(path, { fromHash = false } = {}) {
  if (path === doc.path) return;
  if (isDirty() && !(await flush())) {
    const discard = await confirm({
      title: 'Unsaved changes',
      text: `“${stemOf(doc.path.split('/').pop())}” could not be saved. Open the other note anyway? Your edits stay in this browser as a draft.`,
      okLabel: 'Open anyway',
    });
    if (!discard) { if (fromHash) syncHash(); return; }
  }

  let note;
  try {
    note = await api.read(path);
  } catch (err) {
    if (err.status === 404) {
      toast(`Note “${path}” no longer exists`, { type: 'error' });
      if (doc.path === null) setEmpty();
      syncHash();
      store.del('last');
      loadTree();
      return;
    }
    return handleError(err, 'Could not open note');
  }

  Object.assign(doc, { path: note.path, saved: note.content, version: note.version, conflict: false });
  editor.disabled = false;
  editor.value = note.content;
  editor.setSelectionRange(0, 0);
  editor.scrollTop = 0;
  previewPane.scrollTop = 0;
  app.classList.remove('is-empty');
  docMenuBtn.disabled = false;
  updateTitle();
  renderPreview(true);
  updateStats();
  setSaveState('');
  tree.setActive(note.path);
  store.set('last', note.path);
  syncHash();

  // Unsaved draft from an earlier session (offline, expired login, closed tab)?
  const draft = store.get(`draft:${note.path}`);
  if (draft !== null && draft !== note.content) {
    toast('You have unsaved edits for this note from earlier.', {
      timeout: 15000,
      action: { label: 'Restore', run: () => { editor.value = draft; onInput(); } },
    });
  } else if (draft !== null) {
    store.del(`draft:${note.path}`);
  }

  if (!narrow.matches && root.dataset.view !== 'preview') editor.focus({ preventScroll: true });
}

function setEmpty() {
  Object.assign(doc, { path: null, saved: '', version: null, conflict: false });
  editor.value = '';
  editor.disabled = true;
  preview.replaceChildren();
  app.classList.add('is-empty');
  docMenuBtn.disabled = true;
  updateTitle();
  updateStats();
  setSaveState('');
  tree.setActive(null);
  syncHash();
}

/** Save if needed. Resolves true when the server has the current content. */
async function flush() {
  if (doc.saving) await doc.saving;
  if (!isDirty()) return true;
  if (doc.conflict) return false;
  return save();
}

async function save({ force = false } = {}) {
  clearTimeout(autosaveTimer);
  if (doc.saving) await doc.saving;          // one request at a time
  if (!doc.path) return true;
  if (!force && !isDirty()) return true;
  const path = doc.path;
  const content = editor.value;
  setSaveState('Saving…', 'is-saving');

  const run = (async () => {
    try {
      const res = await api.save(path, content, doc.version, force);
      if (doc.path !== path) return true; // switched notes meanwhile
      doc.saved = content;
      doc.version = res.version;
      doc.conflict = false;
      store.del(`draft:${path}`);
      setSaveState(`Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      updateTitle();
      if (isDirty()) scheduleSave();
      return true;
    } catch (err) {
      if (err.status === 409) {
        doc.conflict = true;
        setSaveState('Not saved — changed elsewhere', 'is-error');
        resolveConflict();
      } else {
        setSaveState(err.status === 0 ? 'Offline — draft kept locally' : 'Not saved', 'is-error');
        handleError(err, 'Save failed');
      }
      return false;
    }
  })();

  doc.saving = run;
  try { return await run; } finally { if (doc.saving === run) doc.saving = null; }
}

async function resolveConflict() {
  const overwrite = await confirm({
    title: 'This note changed elsewhere',
    text: 'It was modified in another tab or device after you opened it. Overwrite it with your version? Choose Cancel to keep both for now — you can reload the other version from the note menu.',
    okLabel: 'Overwrite',
    danger: true,
  });
  if (overwrite) save({ force: true });
}

async function reloadFromServer() {
  if (!doc.path) return;
  if (isDirty() && !(await confirm({ title: 'Reload note?', text: 'Your unsaved edits in this note will be lost.', okLabel: 'Reload', danger: true }))) return;
  const path = doc.path;
  doc.path = null; // force re-open
  store.del(`draft:${path}`);
  await openNote(path);
}

let autosaveTimer;
function scheduleSave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => { if (!doc.conflict) save(); }, AUTOSAVE_MS);
}

let draftTimer;
function onInput() {
  updateTitle();
  renderPreview();
  updateStats();
  if (doc.conflict) return;
  setSaveState('Edited');
  scheduleSave();
  clearTimeout(draftTimer);
  const path = doc.path;
  draftTimer = setTimeout(() => { if (path === doc.path && isDirty()) store.set(`draft:${path}`, editor.value); }, 400);
}

/* ==========================================================================
   Create / rename / delete
   ========================================================================== */

async function newNote(folder = '') {
  let created;
  const ok = await prompt({
    title: folder ? `New note in “${folder}”` : 'New note',
    label: 'Name',
    value: '',
    okLabel: 'Create',
    submit: async (name) => { created = await api.createNote(folder, name); },
  });
  if (!ok) return;
  if (folder) tree.expand(folder);
  await loadTree();
  await openNote(created.path);
  closeSidebar();
  // put the caret after the generated "# Title" heading
  editor.setSelectionRange(editor.value.length, editor.value.length);
  editor.focus();
}

async function newFolder(parent = '') {
  let created;
  const ok = await prompt({
    title: parent ? `New folder in “${parent}”` : 'New folder',
    label: 'Folder name',
    okLabel: 'Create',
    submit: async (name) => { created = await api.createFolder(parent, name); },
  });
  if (!ok) return;
  if (parent) tree.expand(parent);
  tree.expand(created.path);
  await loadTree();
}

async function renameItem(item) {
  const isFile = item.type === 'file';
  const parent = parentOf(item.path);
  let moved;
  if (isFile && item.path === doc.path && !(await flush())) {
    toast('Save the note before renaming it', { type: 'error' });
    return;
  }
  const ok = await prompt({
    title: isFile ? 'Rename note' : 'Rename folder',
    label: isFile ? 'Name' : 'Folder name',
    value: isFile ? stemOf(item.name) : item.name,
    okLabel: 'Rename',
    submit: async (name) => {
      if (name.includes('/')) throw new Error('Names cannot contain “/”');
      const to = (parent ? `${parent}/` : '') + name;
      moved = await api.move(item.path, to);
    },
  });
  if (!ok) return;

  // keep the open note pointing at its new location
  if (doc.path && (doc.path === item.path || doc.path.startsWith(`${item.path}/`))) {
    const draft = store.get(`draft:${doc.path}`);
    store.del(`draft:${doc.path}`);
    doc.path = moved.path + doc.path.slice(item.path.length);
    if (draft !== null) store.set(`draft:${doc.path}`, draft);
    store.set('last', doc.path);
    updateTitle();
    syncHash();
  }
  if (!isFile) {
    tree.forget(item.path);
    tree.expand(moved.path);
  }
  await loadTree();
  tree.setActive(doc.path);
}

async function deleteItem(item) {
  const isFile = item.type === 'file';
  const count = isFile ? 0 : countNotes(item.children ?? []);
  const ok = await confirm({
    title: isFile ? `Delete “${stemOf(item.name)}”?` : `Delete folder “${item.name}”?`,
    text: isFile
      ? 'The note is removed from the server. This cannot be undone.'
      : `The folder${count ? ` and ${count === 1 ? 'the note' : `all ${count} notes`} inside it` : ''} will be removed. This cannot be undone.`,
    okLabel: 'Delete',
    danger: true,
  });
  if (!ok) return;
  try {
    await api.remove(item.path);
  } catch (err) {
    return handleError(err, 'Delete failed');
  }
  if (doc.path && (doc.path === item.path || doc.path.startsWith(`${item.path}/`))) {
    store.del(`draft:${doc.path}`);
    store.del('last');
    setEmpty();
  }
  if (!isFile) tree.forget(item.path);
  toast(isFile ? 'Note deleted' : 'Folder deleted');
  loadTree();
}

const countNotes = (items) => items.reduce((n, it) => n + (it.type === 'file' ? 1 : countNotes(it.children ?? [])), 0);

function downloadNote() {
  if (!doc.path) return;
  const a = el('a', {
    href: URL.createObjectURL(new Blob([editor.value], { type: 'text/markdown' })),
    download: doc.path.split('/').pop(),
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function docMenu() {
  if (!doc.path) return;
  const item = tree.find(doc.path) ?? { type: 'file', path: doc.path, name: doc.path.split('/').pop() };
  openMenu(docMenuBtn, [
    { label: 'Rename…', icon: 'pencil', run: () => renameItem(item) },
    { label: 'Download .md', icon: 'file-text', run: downloadNote },
    { label: 'Reload from server', icon: 'refresh-cw', run: reloadFromServer },
    'sep',
    { label: 'Delete…', icon: 'trash-2', danger: true, run: () => deleteItem(item) },
  ]);
}

/* ==========================================================================
   Header, preview, stats
   ========================================================================== */

function updateTitle() {
  if (!doc.path) {
    docPath.textContent = '';
    docName.textContent = 'No note open';
    docDirty.hidden = true;
    document.title = 'mst·md';
    return;
  }
  const parts = doc.path.split('/');
  const name = stemOf(parts.pop());
  docPath.textContent = parts.length ? `${parts.join(' / ')} /` : '';
  docName.textContent = name;
  docDirty.hidden = !isDirty();
  document.title = `${isDirty() ? '● ' : ''}${name} · mst·md`;
}

let previewFrame = 0;
function renderPreview(now = false) {
  if (!doc.path) return;
  cancelAnimationFrame(previewFrame);
  const go = () => render(editor.value, preview, doc.path);
  if (now) go(); else previewFrame = requestAnimationFrame(go);
}

function updateStats() {
  if (!doc.path) { stats.textContent = ''; return; }
  const text = editor.value;
  const words = (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) || []).length;
  stats.textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'} · ${text.length.toLocaleString()} characters`;
}

function setSaveState(text, cls = '') {
  saveState.textContent = text;
  saveState.className = `save-state ${cls}`;
}

function handleError(err, prefix) {
  console.error(err);
  if (err instanceof ApiError && err.status === 401) {
    if (doc.path && isDirty()) store.set(`draft:${doc.path}`, editor.value);
    toast('Your session has expired. Your edits are kept in this browser.', {
      type: 'error', timeout: 0, action: { label: 'Sign in', run: () => location.reload() },
    });
    return;
  }
  toast(`${prefix}: ${err.message}`, { type: 'error', timeout: 6000 });
}

/* ==========================================================================
   URL hash  (#/folder/note.md)
   ========================================================================== */

function hashPath() {
  const h = location.hash.startsWith('#/') ? location.hash.slice(2) : '';
  try { return decodeURIComponent(h); } catch { return ''; }
}

function syncHash() {
  const want = doc.path ? `#/${doc.path.split('/').map(encodeURIComponent).join('/')}` : '';
  if (location.hash !== want) history.replaceState(null, '', want || location.pathname + location.search);
}

addEventListener('hashchange', () => {
  const p = hashPath();
  if (p && p !== doc.path) openNote(p, { fromHash: true });
});

/* ==========================================================================
   Search
   ========================================================================== */

let searchTimer;
let searchSeq = 0;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) { showTree(); return; }
  searchTimer = setTimeout(() => runSearch(q), 200);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { searchInput.value = ''; showTree(); return; }
  const first = resultsList.querySelector('.result');
  if (e.key === 'ArrowDown' && first) { e.preventDefault(); first.focus(); }
  if (e.key === 'Enter' && first) { e.preventDefault(); first.click(); }
});

resultsList.addEventListener('keydown', (e) => {
  const items = [...resultsList.querySelectorAll('.result')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[i + 1]?.focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? items[i - 1] : searchInput).focus(); }
  if (e.key === 'Escape') { searchInput.focus(); }
});

async function runSearch(q) {
  const seq = ++searchSeq;
  let data;
  try { data = await api.search(q); } catch (err) { return handleError(err, 'Search failed'); }
  if (seq !== searchSeq || searchInput.value.trim() !== q) return;

  treeSection.hidden = true;
  results.hidden = false;
  resultsTitle.textContent = data.results.length ? `${data.results.length} result${data.results.length === 1 ? '' : 's'}` : 'Results';

  if (!data.results.length) {
    resultsList.replaceChildren(el('li', { class: 'results__empty' }, `Nothing found for “${q}”.`));
    return;
  }
  resultsList.replaceChildren(...data.results.map((r) => el('li', {},
    el('button', {
      type: 'button', class: `result${r.path === doc.path ? ' is-active' : ''}`,
      onclick: async () => {
        await openNote(r.path);
        closeSidebar();
        const line = r.matches[0]?.line;
        if (line) goToLine(line);
      },
    },
      el('span', { class: 'result__name' }, ...highlight(stemOf(r.name), q)),
      r.path.includes('/') ? el('span', { class: 'result__path' }, parentOf(r.path)) : null,
      r.matches.map((m) => el('span', { class: 'result__line' }, `${m.line}: `, ...highlight(m.text, q))),
    ))));
}

/** Split text into nodes with <mark> around case-insensitive matches (no innerHTML). */
function highlight(text, q) {
  const out = [];
  const lower = text.toLocaleLowerCase();
  const needle = q.toLocaleLowerCase();
  let i = 0;
  for (let j = lower.indexOf(needle); j !== -1 && needle; j = lower.indexOf(needle, i)) {
    out.push(text.slice(i, j), el('mark', {}, text.slice(j, j + needle.length)));
    i = j + needle.length;
  }
  out.push(text.slice(i));
  return out;
}

function showTree() {
  searchSeq++;
  results.hidden = true;
  treeSection.hidden = false;
}

function goToLine(line) {
  const lines = editor.value.split('\n');
  const pos = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
  if (root.dataset.view === 'preview' || (narrow.matches && root.dataset.view === 'split')) return;
  editor.focus();
  editor.setSelectionRange(pos, pos + (lines[line - 1]?.length ?? 0));
  const lh = parseFloat(getComputedStyle(editor).lineHeight) || 24;
  editor.closest('.pane').scrollTop = Math.max(0, (line - 5) * lh);
}

/* ==========================================================================
   Editor ergonomics: Tab indent, list continuation, Ctrl+B / Ctrl+I
   ========================================================================== */

function insert(text) {
  // execCommand keeps the native undo stack intact; fall back if unavailable.
  if (!document.execCommand('insertText', false, text)) {
    editor.setRangeText(text, editor.selectionStart, editor.selectionEnd, 'end');
    editor.dispatchEvent(new Event('input'));
  }
}

function selectLines() {
  const v = editor.value;
  const start = v.lastIndexOf('\n', editor.selectionStart - 1) + 1;
  let end = v.indexOf('\n', editor.selectionEnd - (editor.selectionEnd > editor.selectionStart && v[editor.selectionEnd - 1] === '\n' ? 1 : 0));
  if (end === -1) end = v.length;
  return [start, end];
}

editor.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;

  if (e.key === 'Tab' && !mod && !e.altKey) {
    e.preventDefault();
    const { selectionStart: s, selectionEnd: t } = editor;
    if (s === t && !e.shiftKey) { insert('  '); return; }
    const [a, b] = selectLines();
    const block = editor.value.slice(a, b);
    const next = e.shiftKey ? block.replace(/^ {1,2}|^\t/gm, '') : block.replace(/^/gm, '  ');
    editor.setSelectionRange(a, b);
    insert(next);
    editor.setSelectionRange(a, a + next.length);
    return;
  }

  if (e.key === 'Enter' && !mod && !e.shiftKey && !e.altKey && editor.selectionStart === editor.selectionEnd) {
    const v = editor.value;
    const pos = editor.selectionStart;
    const lineStart = v.lastIndexOf('\n', pos - 1) + 1;
    const line = v.slice(lineStart, pos);
    const m = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?/.exec(line);
    if (!m) return;
    e.preventDefault();
    if (line.trim() === m[0].trim()) {          // empty item → end the list
      editor.setSelectionRange(lineStart, pos);
      insert('');
      return;
    }
    let bullet = m[2];
    if (/^\d/.test(bullet)) bullet = `${parseInt(bullet, 10) + 1}${bullet.slice(-1)}`;
    insert(`\n${m[1]}${bullet}${m[3]}${m[4] ? '[ ] ' : ''}`);
    return;
  }

  if (mod && !e.altKey && (e.key === 'b' || e.key === 'i')) {
    e.preventDefault();
    const mark = e.key === 'b' ? '**' : '_';
    const { selectionStart: s, selectionEnd: t } = editor;
    const sel = editor.value.slice(s, t);
    insert(`${mark}${sel}${mark}`);
    if (!sel) editor.setSelectionRange(s + mark.length, s + mark.length);
  }
});

editor.addEventListener('input', onInput);

// Proportional scroll sync editor → preview (split view only)
editor.closest('.pane').addEventListener('scroll', (e) => {
  if (root.dataset.view !== 'split' || narrow.matches) return;
  const src = e.currentTarget;
  const ratio = src.scrollTop / Math.max(1, src.scrollHeight - src.clientHeight);
  previewPane.scrollTop = ratio * (previewPane.scrollHeight - previewPane.clientHeight);
}, { passive: true });

/* ==========================================================================
   View, layout, theme
   ========================================================================== */

const viewSwitch = $('#viewSwitch');
const orientBtn = $('#orientBtn');
const themeSwitch = $('#themeSwitch');

function setView(view) {
  root.dataset.view = view;
  store.set('view', view);
  syncControls();
  if (view !== 'edit') renderPreview(true);
}

function syncControls() {
  const effective = narrow.matches && root.dataset.view === 'split' ? 'preview' : root.dataset.view;
  for (const b of viewSwitch.querySelectorAll('[data-view-choice]')) {
    const on = b.dataset.viewChoice === effective;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  const vertical = root.dataset.split === 'v';
  orientBtn.hidden = root.dataset.view !== 'split';
  orientBtn.replaceChildren(icon(vertical ? 'columns-2' : 'rows-2'));
  orientBtn.title = vertical ? 'Side by side' : 'Stack editor above preview';
  divider.setAttribute('aria-orientation', vertical ? 'horizontal' : 'vertical');

  const theme = root.dataset.theme || 'system';
  for (const b of themeSwitch.querySelectorAll('[data-theme-choice]')) {
    const on = b.dataset.themeChoice === theme;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  }
}

function setTheme(theme) {
  if (theme === 'system') { delete root.dataset.theme; store.del('theme'); }
  else { root.dataset.theme = theme; store.set('theme', theme); }
  syncControls();
}

viewSwitch.addEventListener('click', (e) => {
  const b = e.target.closest('[data-view-choice]');
  if (b) setView(b.dataset.viewChoice);
});
themeSwitch.addEventListener('click', (e) => {
  const b = e.target.closest('[data-theme-choice]');
  if (b) setTheme(b.dataset.themeChoice);
});
// Arrow keys inside radio groups
for (const group of [viewSwitch, themeSwitch]) {
  group.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const btns = [...group.querySelectorAll('[role="radio"]')].filter((b) => b.offsetParent);
    const i = btns.indexOf(document.activeElement);
    const next = btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length];
    next.focus();
    next.click();
  });
}
narrow.addEventListener('change', syncControls);

/* ---------- resizable split ---------- */

function setRatio(pct, persist = true) {
  const v = Math.min(85, Math.max(15, pct));
  root.style.setProperty('--ratio', `${v}%`);
  divider.setAttribute('aria-valuenow', String(Math.round(v)));
  if (persist) store.set('ratio', `${v.toFixed(1)}%`);
}

divider.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  divider.setPointerCapture(e.pointerId);
  divider.classList.add('is-dragging');
  const rect = workspace.getBoundingClientRect();
  const vertical = root.dataset.split === 'v';
  const move = (ev) => setRatio(vertical
    ? ((ev.clientY - rect.top) / rect.height) * 100
    : ((ev.clientX - rect.left) / rect.width) * 100, false);
  const up = () => {
    divider.classList.remove('is-dragging');
    divider.removeEventListener('pointermove', move);
    setRatio(parseFloat(root.style.getPropertyValue('--ratio')) || 50);
  };
  divider.addEventListener('pointermove', move);
  divider.addEventListener('pointerup', up, { once: true });
  divider.addEventListener('pointercancel', up, { once: true });
});
divider.addEventListener('dblclick', () => setRatio(50));
divider.addEventListener('keydown', (e) => {
  const cur = parseFloat(root.style.getPropertyValue('--ratio')) || 50;
  const step = e.shiftKey ? 10 : 2;
  const delta = { ArrowLeft: -step, ArrowUp: -step, ArrowRight: step, ArrowDown: step }[e.key];
  if (delta !== undefined) { e.preventDefault(); setRatio(cur + delta); }
  if (e.key === 'Home') setRatio(15);
  if (e.key === 'End') setRatio(85);
});

/* ---------- narrow-screen sidebar ---------- */

function openSidebar() {
  app.classList.add('sidebar-open');
  // focus the open note (not the search box — that would pop up the phone keyboard)
  const sb = $('#sidebar');
  (sb.querySelector('.tree__item[aria-current]') ?? sb.querySelector('.tree__item'))?.focus({ preventScroll: true });
}
function closeSidebar() {
  if (!app.classList.contains('sidebar-open')) return;
  app.classList.remove('sidebar-open');
}

/* ==========================================================================
   Global actions + shortcuts
   ========================================================================== */

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  switch (t.dataset.action) {
    case 'new-note': newNote(t.dataset.folder ?? ''); break;
    case 'new-folder': newFolder(t.dataset.folder ?? ''); break;
    case 'open-sidebar': openSidebar(); break;
    case 'close-sidebar': closeSidebar(); break;
    case 'toggle-orientation':
      root.dataset.split = root.dataset.split === 'v' ? 'h' : 'v';
      store.set('split', root.dataset.split);
      syncControls();
      break;
    case 'doc-menu': docMenu(); break;
  }
});

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (doc.conflict) resolveConflict(); else save();
  } else if (mod && !e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (narrow.matches) openSidebar();
    searchInput.focus();
    searchInput.select();
  } else if (e.altKey && !mod && e.code === 'KeyN') {
    e.preventDefault();
    newNote('');
  } else if (mod && e.altKey && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
    e.preventDefault();
    setView(['edit', 'split', 'preview'][Number(e.code.at(-1)) - 1]);
  } else if (e.key === 'Escape' && app.classList.contains('sidebar-open')) {
    closeSidebar();
  }
});

// Save when the tab is hidden; warn on close with unsaved edits.
document.addEventListener('visibilitychange', () => { if (document.hidden && isDirty() && !doc.conflict) save(); });
addEventListener('beforeunload', (e) => { if (isDirty()) e.preventDefault(); });

/* ==========================================================================
   Boot
   ========================================================================== */

window.mstmdReady = true;
setRatio(parseFloat(store.get('ratio')) || 50, false);
syncControls();
setEmpty();
await loadTree();
const start = hashPath() || store.get('last');
if (start) await openNote(start);
