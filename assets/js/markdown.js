// Markdown → sanitised HTML with syntax highlighting.

import { Marked } from '../vendor/marked.esm.js';
import DOMPurify from '../vendor/purify.es.js';
import hljs from '../vendor/highlight.esm.min.js';

const marked = new Marked({ gfm: true, breaks: true });

// External links open in a new tab, without leaking the opener/referrer.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    const href = node.getAttribute('href');
    if (/^https?:\/\//i.test(href)) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
});

/** Render markdown into `target`. `notePath` resolves relative .md links. */
export function render(markdown, target, notePath = '') {
  const html = marked.parse(markdown);
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select'],
    RETURN_DOM_FRAGMENT: true,
  });

  // keep only task-list checkboxes
  clean.querySelectorAll('input').forEach((i) => {
    if (i.type !== 'checkbox') i.remove();
    else i.disabled = true;
  });

  // internal links to other notes: "other.md", "../x/y.md#heading"
  const base = notePath.includes('/') ? notePath.slice(0, notePath.lastIndexOf('/') + 1) : '';
  clean.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (/^[a-z][a-z0-9+.-]*:|^\/\/|^#/i.test(href)) return;
    const [file] = href.split('#');
    if (!/\.md$/i.test(file)) return;
    let decoded;
    try { decoded = decodeURI(file); } catch { return; }
    const resolved = resolvePath(base + decoded);
    if (resolved) a.setAttribute('href', `#/${encodeURI(resolved)}`);
  });

  clean.querySelectorAll('pre code').forEach((block) => {
    const lang = /language-([\w-]+)/.exec(block.className)?.[1];
    if (lang && !hljs.getLanguage(lang)) block.classList.add('language-plaintext');
    hljs.highlightElement(block);
  });

  target.replaceChildren(clean);
}

function resolvePath(p) {
  const out = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { if (!out.length) return null; out.pop(); } else out.push(seg);
  }
  return out.join('/');
}

hljs.configure({ ignoreUnescapedHTML: true });
