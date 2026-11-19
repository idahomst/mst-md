# Vendored libraries

Self-hosted so the app makes no third-party requests and works under a strict CSP.
Files are copied unmodified from npm (source-map comments removed).

| File | Package | Version | License |
|---|---|---|---|
| `marked.esm.js` | [marked](https://github.com/markedjs/marked) | 18.2.1 | MIT |
| `purify.es.js` (renamed from `purify.es.mjs`: many nginx setups serve `.mjs` with a non-JavaScript MIME type, which browsers refuse for modules) | [dompurify](https://github.com/cure53/DOMPurify) | 3.4.18 | MPL-2.0 OR Apache-2.0 |
| `highlight.esm.min.js` | [@highlightjs/cdn-assets](https://github.com/highlightjs/highlight.js) (`es/highlight.min.js`, common languages) | 11.12.0 | BSD-3-Clause |
| `../icons.svg` | [lucide-static](https://lucide.dev) (subset, as a sprite) | 1.76.0 | ISC |

## Updating

```bash
npm pack marked dompurify @highlightjs/cdn-assets   # or npm i into a temp dir
cp node_modules/marked/lib/marked.esm.js                   assets/vendor/
cp node_modules/dompurify/dist/purify.es.mjs               assets/vendor/purify.es.js
cp node_modules/@highlightjs/cdn-assets/es/highlight.min.js assets/vendor/highlight.esm.min.js
sed -i '/sourceMappingURL/d' assets/vendor/*.js
```
