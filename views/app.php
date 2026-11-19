<?php /** @var string $csrf */
function icon(string $name, string $class = ''): string
{
    return '<svg class="icon ' . h($class) . '" aria-hidden="true"><use href="assets/icons.svg#i-' . h($name) . '"></use></svg>';
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content">
  <meta name="robots" content="noindex, nofollow">
  <meta name="csrf-token" content="<?= h($csrf) ?>">
  <title>mst·md</title>
  <link rel="icon" href="<?= asset('assets/favicon.svg') ?>" type="image/svg+xml">
  <script nonce="<?= h(csp_nonce()) ?>">
    // Apply theme + layout before first paint (no flash).
    try {
      const d = document.documentElement, s = localStorage;
      const t = s.getItem('mstmd:theme'); if (t === 'light' || t === 'dark') d.dataset.theme = t;
      d.dataset.view = s.getItem('mstmd:view') || 'split';
      d.dataset.split = s.getItem('mstmd:split') || 'h';
      const r = s.getItem('mstmd:ratio'); if (r) d.style.setProperty('--ratio', r);
    } catch {}
  </script>
  <link rel="stylesheet" href="<?= asset('assets/app.css') ?>">
  <link rel="modulepreload" href="<?= asset('assets/js/main.js') ?>">
</head>
<body>
<div class="app" id="app">

  <aside class="sidebar" id="sidebar" aria-label="Notes">
    <div class="sidebar__head">
      <a class="brand" href="./" title="mst·md">
        <?= icon('book-marked') ?><span>mst<span class="brand__dot">·</span>md</span>
      </a>
      <button type="button" class="icon-btn only-narrow" data-action="close-sidebar" aria-label="Close notes list"><?= icon('x') ?></button>
    </div>

    <div class="search" role="search">
      <?= icon('search', 'search__icon') ?>
      <input type="search" id="search" placeholder="Search notes" autocomplete="off" spellcheck="false"
             aria-label="Search notes" aria-controls="results">
      <kbd class="search__kbd" aria-hidden="true">Ctrl K</kbd>
    </div>

    <div class="sidebar__section" id="treeSection">
      <div class="sidebar__section-head">
        <h2>Notes</h2>
        <div class="sidebar__actions">
          <button type="button" class="icon-btn icon-btn--sm" data-action="new-note" data-folder="" title="New note (Alt+N)" aria-label="New note"><?= icon('file-plus') ?></button>
          <button type="button" class="icon-btn icon-btn--sm" data-action="new-folder" data-folder="" title="New folder" aria-label="New folder"><?= icon('folder-plus') ?></button>
        </div>
      </div>
      <nav class="tree" id="tree" aria-label="Notes"><p class="tree__loading">Loading…</p></nav>
    </div>

    <div class="sidebar__section results" id="results" hidden>
      <div class="sidebar__section-head"><h2 id="resultsTitle">Results</h2></div>
      <ul class="results__list" id="resultsList" role="list"></ul>
    </div>

    <div class="sidebar__foot">
      <div class="seg seg--icons" role="radiogroup" aria-label="Theme" id="themeSwitch">
        <button type="button" role="radio" data-theme-choice="system" title="System theme" aria-label="System theme"><?= icon('monitor') ?></button>
        <button type="button" role="radio" data-theme-choice="light" title="Light theme" aria-label="Light theme"><?= icon('sun') ?></button>
        <button type="button" role="radio" data-theme-choice="dark" title="Dark theme" aria-label="Dark theme"><?= icon('moon') ?></button>
      </div>
      <form method="post" action="./">
        <input type="hidden" name="action" value="logout">
        <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
        <button type="submit" class="btn btn--ghost btn--sm"><?= icon('log-out') ?>Sign out</button>
      </form>
    </div>
  </aside>

  <div class="scrim" data-action="close-sidebar" aria-hidden="true"></div>

  <main class="main">
    <header class="toolbar">
      <button type="button" class="icon-btn only-narrow" data-action="open-sidebar" aria-label="Open notes list" aria-controls="sidebar"><?= icon('menu') ?></button>
      <div class="doc">
        <span class="doc__path" id="docPath"></span>
        <h1 class="doc__name" id="docName">No note open</h1>
        <span class="doc__dirty" id="docDirty" hidden title="Unsaved changes">●</span>
      </div>
      <div class="toolbar__right">
        <div class="seg" role="radiogroup" aria-label="View" id="viewSwitch">
          <button type="button" role="radio" data-view-choice="edit" title="Editor only (Ctrl+Alt+1)"><?= icon('pen-line') ?><span>Edit</span></button>
          <button type="button" role="radio" data-view-choice="split" class="hide-narrow" title="Side by side (Ctrl+Alt+2)"><?= icon('columns-2') ?><span>Split</span></button>
          <button type="button" role="radio" data-view-choice="preview" title="Preview only (Ctrl+Alt+3)"><?= icon('eye') ?><span>Read</span></button>
        </div>
        <button type="button" class="icon-btn hide-narrow" id="orientBtn" data-action="toggle-orientation" title="Stack editor and preview" aria-label="Toggle split orientation"><?= icon('rows-2') ?></button>
        <button type="button" class="icon-btn" id="docMenuBtn" data-action="doc-menu" title="Note actions" aria-label="Note actions" disabled><?= icon('ellipsis') ?></button>
      </div>
    </header>

    <section class="workspace" id="workspace">
      <div class="pane pane--editor">
        <textarea id="editor" class="editor" aria-label="Markdown source" spellcheck="true" disabled
                  placeholder="Start writing…"></textarea>
      </div>
      <div class="divider" id="divider" role="separator" tabindex="0" aria-label="Resize editor and preview"
           aria-controls="editor" aria-valuemin="15" aria-valuemax="85" aria-valuenow="50"></div>
      <div class="pane pane--preview" id="previewPane">
        <article class="md" id="preview"></article>
      </div>

      <div class="empty" id="empty">
        <?= icon('book-marked', 'icon--xl') ?>
        <h2>Pick a note or start a new one</h2>
        <p>Notes are plain Markdown files, saved automatically as you type.</p>
        <button type="button" class="btn btn--primary" data-action="new-note" data-folder=""><?= icon('file-plus') ?>New note</button>
        <dl class="shortcuts">
          <dt><kbd>Ctrl</kbd> <kbd>K</kbd></dt><dd>Search</dd>
          <dt><kbd>Alt</kbd> <kbd>N</kbd></dt><dd>New note</dd>
          <dt><kbd>Ctrl</kbd> <kbd>S</kbd></dt><dd>Save now</dd>
          <dt><kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>1–3</kbd></dt><dd>Edit / Split / Read</dd>
        </dl>
      </div>
    </section>

    <footer class="statusbar">
      <span id="stats"></span>
      <span id="saveState" class="save-state" role="status" aria-live="polite"></span>
    </footer>
  </main>
</div>

<div class="menu" id="menu" popover>
  <div role="menu" id="menuItems"></div>
</div>

<dialog class="dialog" id="dialog" aria-labelledby="dialogTitle">
  <form method="dialog" class="dialog__form">
    <h2 id="dialogTitle"></h2>
    <p id="dialogText" class="dialog__text"></p>
    <label class="field" id="dialogField">
      <span id="dialogLabel">Name</span>
      <input type="text" id="dialogInput" autocomplete="off" spellcheck="false">
      <small id="dialogError" class="field__error" role="alert"></small>
    </label>
    <div class="dialog__buttons">
      <!-- OK first in the DOM so Enter submits it; shown on the right via row-reverse -->
      <button type="submit" value="ok" class="btn btn--primary" id="dialogOk">OK</button>
      <button type="submit" value="cancel" class="btn btn--ghost" formnovalidate>Cancel</button>
    </div>
  </form>
</dialog>

<div class="toasts" id="toasts" aria-live="polite"></div>

<script type="module" src="<?= asset('assets/js/main.js') ?>"></script>
<script nonce="<?= h(csp_nonce()) ?>">
  // If the app modules fail to load (wrong MIME type, blocked file, old browser), say so instead of "Loading…" forever.
  setTimeout(() => {
    if (window.mstmdReady) return;
    const t = document.getElementById('tree');
    t.textContent = 'The app scripts did not load. Open the browser console (F12) for details — usually a file is missing on the server or served with the wrong type.';
    t.className = 'tree tree__fail';
  }, 5000);
</script>
</body>
</html>
