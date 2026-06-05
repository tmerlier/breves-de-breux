# Reliable PDF Generation via Paged.js + Puppeteer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser print-to-PDF with deterministic server-side PDF generation (Paged.js paginates, Puppeteer prints), so the on-screen preview matches the printed PDF exactly and no section is ever dropped.

**Architecture:** `lib/render.js` stays the single HTML source of truth. The EJS template gains the Paged.js polyfill (root-relative URL, served from `node_modules`) plus standard CSS Paged Media rules. A new isolated `lib/pdf.js` drives Puppeteer against the app's own `http://localhost:PORT/breves.html` URL (so `/uploads` and `/images` mounts resolve) and writes `breves.pdf`. `/api/generate` is rewritten to return the PDF; the frontend downloads it instead of opening the print dialog.

**Tech Stack:** Node.js, Express, EJS, `pagedjs` (npm), `puppeteer` (npm).

**Testing note:** This repo has no test runner and verification is visual (per CLAUDE.md). Tasks therefore use concrete smoke-check commands (curl / `node -e` / file inspection) and explicit visual checks instead of a unit-test harness. Do not introduce Jest/Vitest.

**Plan location note:** Saved under `docs/plans/` (not the skill default `docs/superpowers/plans/`) to sit beside the companion design doc `docs/plans/2026-06-05-pdf-generation-pagedjs-design.md`.

**Prerequisite for visual checks:** A working `.env` pointing `ARTICLES_DIR`/`EVENTS_PATH` at real content (the sibling `../breux-sur-avre` repo), and at least one article selectable plus some upcoming events, so the calendar section is non-empty. Note the actual port (`PORT` in `.env`, e.g. 3001); commands below use `$PORT` — substitute the real value.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `package.json` | declares `pagedjs` + `puppeteer` deps | Modify |
| `server.js` | serves Paged.js vendor file; `/api/generate` → PDF; `GET /breves.pdf` | Modify |
| `lib/render.js` | `toPrintableImageSrc` → root-relative URLs | Modify |
| `lib/pdf.js` | Puppeteer wrapper `generatePdf({ url, outputPath })` | **Create** |
| `templates/breves-template.ejs` | Paged.js script + CSS Paged Media; remove `optimizeArticleBreaks` | Modify |
| `public/app.js` | `generateFinal()` downloads PDF; optional hot preview | Modify |
| `public/index.html` | button label | Modify |
| `.gitignore` | ignore `breves.pdf` | Modify |

---

## Task 1: Add dependencies and serve the Paged.js polyfill

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `server.js:28-29` (static mounts)

- [ ] **Step 1: Install the two runtime dependencies**

Run:
```bash
yarn add pagedjs puppeteer
```
Expected: `package.json` `dependencies` now include `"pagedjs"` and `"puppeteer"`; `yarn install` completes (Puppeteer downloads a Chromium build — this is expected and may take a minute).

- [ ] **Step 2: Verify the polyfill file shipped**

Run:
```bash
ls -la node_modules/pagedjs/dist/paged.polyfill.js
```
Expected: file exists, non-zero size.

- [ ] **Step 3: Mount the polyfill as a static route**

In `server.js`, immediately after the existing line `app.use('/uploads', express.static('uploads'));` (currently line 29), add:

```js
// Sert le polyfill Paged.js (pagination print) depuis node_modules
app.use('/vendor/pagedjs', express.static(path.join(__dirname, 'node_modules/pagedjs/dist')));
```

- [ ] **Step 4: Verify the route serves the file**

Run (substitute the real port for `$PORT`):
```bash
yarn start &  # note the PID; or run in a second terminal
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:$PORT/vendor/pagedjs/paged.polyfill.js
```
Expected: `200`. Stop the server afterward (`kill %1` or Ctrl-C).

- [ ] **Step 5: Commit**

```bash
git add package.json yarn.lock server.js
git commit -m "chore(pdf): add pagedjs and puppeteer, serve pagedjs polyfill"
```

---

## Task 2: Make image URLs root-relative for HTTP serving

Puppeteer loads the document over HTTP (`http://localhost:PORT/breves.html`), and the preview iframe (an `about:blank` doc written via `document.write`) inherits the parent origin's base URL. In both cases **root-relative** URLs (`/uploads/x.jpg`) resolve correctly, whereas the current `./uploads/x.jpg` is fragile. Switch the localhost rewrite to produce root-relative paths.

**Files:**
- Modify: `lib/render.js:28-34` (`toPrintableImageSrc`)

- [ ] **Step 1: Change the rewrite target from `.` to `` (root-relative)**

In `lib/render.js`, replace the body of `toPrintableImageSrc`:

```js
function toPrintableImageSrc(src) {
  if (!src) return src;
  if (src.includes('localhost:') || src.startsWith('http://localhost') || src.startsWith('https://localhost')) {
    return src.replace(/^https?:\/\/localhost:\d+/, '');
  }
  return src;
}
```

(Only the replacement string changed: `'.'` → `''`, turning `http://localhost:3001/uploads/x.jpg` into `/uploads/x.jpg`.)

- [ ] **Step 2: Verify the transformation**

Run:
```bash
node -e "const r=require('./lib/render'); console.log(r.toPrintableImageSrc('http://localhost:3001/uploads/x.jpg')); console.log(r.toPrintableImageSrc('https://example.com/y.jpg'));"
```
Expected output:
```
/uploads/x.jpg
https://example.com/y.jpg
```
(Local rewritten to root-relative; external URL untouched.)

- [ ] **Step 3: Commit**

```bash
git add lib/render.js
git commit -m "fix(render): emit root-relative image URLs for HTTP-served rendering"
```

---

## Task 3: Integrate Paged.js into the template and refactor print CSS

This is the layout-correctness core. Paged.js reads a root-level `@page` rule, fragments content across pages, and honours `break-inside: avoid` on atomic blocks. We add a completion hook (`window.PagedConfig.after`) so Puppeteer can detect when pagination is done, load the polyfill, drop the obsolete height-measuring script, and move `@page` out of `@media print`.

**Files:**
- Modify: `templates/breves-template.ejs` (style block ~239-479, script block 481-509, end of `<body>` ~570-573)

- [ ] **Step 1: Add a root-level `@page` rule**

In `templates/breves-template.ejs`, immediately after the opening `<style>` tag (line 7) and before `/* General styles */`, insert:

```css
    /* Pagination print (Paged.js lit cette règle au niveau racine) */
    @page {
      size: A4;
      margin: 15mm;
    }
```

- [ ] **Step 2: Avoid double margins — neutralise the screen container padding under Paged.js**

Paged.js applies the `@page` margin (15mm). The `.container` padding (`20mm`, line 28) would stack on top. Add, right after the root `@page` rule from Step 1:

```css
    /* Sous Paged.js, la marge vient de @page : on retire le padding conteneur. */
    .pagedjs_page .container,
    .pagedjs_page .pagedjs_page_content .container {
      padding: 0;
      max-width: 100%;
    }
```

- [ ] **Step 3: Put `break-inside: avoid` on atomic blocks only**

The existing `.calendar-section` already had its section-level `page-break-inside: avoid` removed (commit `32ad28e`). Confirm none of the *section* containers (`.calendar-section`, `.rappels-section`, `.etat-civil-section`) carry `page-break-inside: avoid` or `break-inside: avoid`. Then ensure the atomic blocks do. Locate the `@media print` block (starts line 425) and replace its `.article, .event-card { page-break-inside: avoid; }` rule (lines 436-438) with a root-level (non-print-only) rule placed just before the `@media print` block:

```css
    /* Blocs atomiques : ne jamais couper en interne (écran + print + Paged.js) */
    .article.short-article,
    .event-card,
    .rappel-card,
    .etat-civil-card {
      break-inside: avoid;
    }
```

Note: `.etat-civil-card` is the per-category card class in `templates/etat-civil.ejs` (verified). Long articles intentionally keep `break-inside: auto` so they can flow across pages.

- [ ] **Step 4: Remove the obsolete `optimizeArticleBreaks` script**

Delete the entire `<script>` block spanning lines 481-509 (from `// Détection intelligente…` through the `window.addEventListener('beforeprint', optimizeArticleBreaks);` and its closing `</script>`). Paged.js handles fragmentation natively, so the `.short-article` class is no longer set by JS.

Because Step 3 keyed `break-inside` off `.article.short-article`, and that class is no longer added, change that selector to plain `.article` so short and long alike avoid mid-block cuts only where intended. Update the Step 3 rule's first selector line from `.article.short-article,` to:

```css
    .article,
```

(Final atomic-block rule: `.article, .event-card, .rappel-card, .etat-civil-card { break-inside: avoid; }`. If long articles exceeding one page get clipped during the Task 4 visual check, relax `.article` to `break-inside: auto` and keep the others.)

- [ ] **Step 5: Add the Paged.js completion hook + polyfill before `</body>`**

Just before the closing `</body>` tag (line 573, after the final `</div>` that closes `.container`), insert:

```html
  <script>
    // Signale à Puppeteer la fin de pagination Paged.js.
    window.PagedConfig = {
      auto: true,
      after: () => { window.__PAGEDJS_DONE__ = true; },
    };
  </script>
  <script src="/vendor/pagedjs/paged.polyfill.js"></script>
```

- [ ] **Step 6: Visual verification in the preview**

Run `yarn start`, open `http://localhost:$PORT/`, fill/select content (≥1 article, some upcoming events, an état-civil entry), click **🔄 Actualiser la prévisualisation**.
Expected: the iframe now shows **discrete A4 pages** (grey gutter between them, Paged.js layout), the **Calendrier des Événements** section is present, and no paragraph is cut mid-line across a page boundary. If margins look doubled, re-check Step 2 selectors against the actual Paged.js DOM (`.pagedjs_page_content`).

- [ ] **Step 7: Commit**

```bash
git add templates/breves-template.ejs
git commit -m "feat(breves-template): paginate with Paged.js and CSS Paged Media"
```

---

## Task 4: Create the Puppeteer PDF wrapper

**Files:**
- Create: `lib/pdf.js`

- [ ] **Step 1: Write `lib/pdf.js`**

Create `lib/pdf.js`:

```js
// Génère un PDF à partir d'une page HTML déjà paginée par Paged.js.
// Brique volontairement isolée : c'est la seule à réécrire pour une future
// génération serverless (ex. @sparticuz/chromium sur Vercel).
const puppeteer = require('puppeteer');

// Charge `url`, attend la fin de pagination Paged.js, écrit le PDF dans
// `outputPath`. Lance Chromium à la demande et le ferme dans tous les cas.
async function generatePdf({ url, outputPath }) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    // Paged.js positionne window.__PAGEDJS_DONE__ via PagedConfig.after.
    await page.waitForFunction(() => window.__PAGEDJS_DONE__ === true, {
      timeout: 60000,
    });
    await page.pdf({
      path: outputPath,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return outputPath;
  } finally {
    await browser.close();
  }
}

module.exports = { generatePdf };
```

- [ ] **Step 2: Verify the module loads and exposes the function**

Run:
```bash
node -e "const {generatePdf}=require('./lib/pdf'); console.log(typeof generatePdf);"
```
Expected: `function`.

(End-to-end PDF output is verified in Task 5, once a route serves a paginated page for Puppeteer to load.)

- [ ] **Step 3: Commit**

```bash
git add lib/pdf.js
git commit -m "feat(pdf): add Puppeteer wrapper that prints a Paged.js-rendered page"
```

---

## Task 5: Rewrite `/api/generate` to produce the PDF and serve it

**Files:**
- Modify: `server.js` (requires near top; `/api/generate` lines 218-227; add `GET /breves.pdf`)

- [ ] **Step 1: Import the PDF wrapper**

In `server.js`, after the line `const render = require('./lib/render');` (line 7), add:

```js
const { generatePdf } = require('./lib/pdf');
```

- [ ] **Step 2: Rewrite the `/api/generate` route**

Replace the current `/api/generate` handler (lines 218-227) with:

```js
// API: Générer le PDF final via Paged.js + Puppeteer
app.post('/api/generate', async (req, res) => {
  try {
    const { config, selectedArticles } = req.body;
    const htmlPath = path.join(__dirname, 'breves.html');
    const pdfPath = path.join(__dirname, 'breves.pdf');

    // 1. Écrit la page source (incluant Paged.js), servie en HTTP.
    fs.writeFileSync(htmlPath, renderBreves(config, selectedArticles), 'utf8');

    // 2. Puppeteer charge cette page servie et imprime le PDF.
    await generatePdf({
      url: `http://localhost:${PORT}/breves.html`,
      outputPath: pdfPath,
    });

    res.json({ success: true, url: '/breves.pdf' });
  } catch (error) {
    console.error('Erreur génération PDF:', error);
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 3: Add a route to download the PDF**

Immediately after the `/breves.html` route (ends ~line 244, after its closing `});`), add:

```js
// Route pour télécharger le PDF généré
app.get('/breves.pdf', (req, res) => {
  const pdfPath = path.join(__dirname, 'breves.pdf');
  if (fs.existsSync(pdfPath)) {
    res.sendFile(pdfPath);
  } else {
    res.status(404).send('PDF non généré. Cliquez sur « Générer le PDF » d\'abord.');
  }
});
```

- [ ] **Step 4: End-to-end verification (this exercises Task 4 too)**

Start the server (`yarn start`). Trigger a generation with one real selected article. The cleanest way without the updated UI button (Task 6) is the browser console on `http://localhost:$PORT/`, after selecting an article in the UI:
```js
// paste in the browser devtools console on the app page
fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ config: getCurrentConfig(), selectedArticles: getSelectedArticles() }),
}).then(r => r.json()).then(console.log);
```
Expected console output: `{ success: true, url: '/breves.pdf' }`. Then verify from a shell:
```bash
ls -la breves.pdf
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:$PORT/breves.pdf
```
Expected: `breves.pdf` exists with non-trivial size (tens of KB+); HTTP `200 application/pdf`. Open `breves.pdf` in a viewer and confirm the **Calendrier des Événements** section is present and pagination is clean.

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat(server): generate breves.pdf via Puppeteer and serve it"
```

---

## Task 6: Frontend — download the PDF instead of opening the print dialog

**Files:**
- Modify: `public/app.js:562-627` (`generateFinal`)
- Modify: `public/index.html:415` (button label)

- [ ] **Step 1: Rewrite `generateFinal()`**

In `public/app.js`, replace the whole `generateFinal` function (lines 562-627) with:

```js
// Générer le PDF final et déclencher son téléchargement
async function generateFinal() {
  const loadingIndicator = document.getElementById('loadingIndicator');

  try {
    const config = getCurrentConfig();
    const selectedArticles = getSelectedArticles();

    if (selectedArticles.length === 0) {
      alert('Veuillez sélectionner au moins un article');
      return;
    }

    loadingIndicator.classList.add('active');

    // Sauvegarde config + état du formulaire
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    await fetch('/api/save-form-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config,
        selectedArticleIds: Array.from(state.selectedArticleIds),
        timestamp: new Date().toISOString(),
      }),
    });

    // Génère le PDF côté serveur (Paged.js + Puppeteer)
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, selectedArticles }),
    });
    const result = await response.json();

    if (result.success) {
      // Ouvre le PDF dans un nouvel onglet (cache-busting pour éviter l'ancien)
      window.open(result.url + '?t=' + Date.now(), '_blank');
    } else {
      alert('Erreur lors de la génération du PDF : ' + (result.error || 'inconnue'));
    }
  } catch (error) {
    console.error('Erreur génération finale:', error);
    alert('Erreur lors de la génération du PDF');
  } finally {
    loadingIndicator.classList.remove('active');
  }
}
```

- [ ] **Step 2: Update the button label**

In `public/index.html` line 415, change:
```html
      <button class="btn btn-success" onclick="generateFinal()">📄 Générer et Imprimer</button>
```
to:
```html
      <button class="btn btn-success" onclick="generateFinal()">📄 Générer le PDF</button>
```

- [ ] **Step 3: Visual verification**

Reload the UI, select content, click **📄 Générer le PDF**.
Expected: loading indicator shows during generation (a few seconds), then a new tab opens displaying `breves.pdf`. The PDF matches the iframe preview page-for-page, and the calendar section is present.

- [ ] **Step 4: Commit**

```bash
git add public/app.js public/index.html
git commit -m "feat(app): download generated PDF instead of opening print dialog"
```

---

## Task 7 (optional): Hot preview refresh

Auto-refresh the preview as the form changes, debounced, so the user no longer must click 🔄. Keep the button as a manual fallback.

**Files:**
- Modify: `public/app.js` (add debounced trigger; wire to form `input` events)

- [ ] **Step 1: Add a debounced preview trigger**

In `public/app.js`, add near the top-level helpers (e.g. just above `async function updatePreview()` at line 513):

```js
// Rafraîchissement à chaud de la preview, anti-rebond 600 ms.
let previewDebounceTimer = null;
function schedulepreviewRefresh() {
  clearTimeout(previewDebounceTimer);
  previewDebounceTimer = setTimeout(() => { updatePreview(); }, 600);
}
```

- [ ] **Step 2: Wire it to form changes**

Inside the existing `DOMContentLoaded` handler (starts line 28), after the initial setup, add a delegated listener on the form container. Add these lines at the end of that handler's body (before its closing `});`):

```js
  // Rafraîchit la preview à chaque modification du formulaire.
  document.addEventListener('input', (e) => {
    if (e.target.closest('#previewFrame')) return; // ignore l'iframe
    schedulepreviewRefresh();
  });
  document.addEventListener('change', (e) => {
    if (e.target.closest('#previewFrame')) return;
    schedulepreviewRefresh();
  });
```

Note: the function is `schedulepreviewRefresh` — match the exact casing used in Step 1 (`schedulepreviewRefresh`). Rename both to a single consistent identifier `schedulePreviewRefresh` if you prefer camelCase; just keep them identical.

- [ ] **Step 3: Visual verification**

Reload the UI. Type in the mayor message field or toggle an article selection.
Expected: ~0.6s after you stop interacting, the preview iframe re-renders automatically (loading indicator flickers). Each Paged.js re-pagination should feel responsive; if it stutters badly on large selections, keep the debounce but consider raising it to 1000ms. The manual 🔄 button still works.

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat(app): hot-refresh preview on form changes (debounced)"
```

---

## Task 8: Ignore the generated PDF artifact

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add `breves.pdf` to `.gitignore`**

`breves.html` is already ignored. Append after that entry:
```
breves.pdf
```

- [ ] **Step 2: Verify it is ignored**

Run:
```bash
git check-ignore breves.pdf && echo ignored
```
Expected: prints `breves.pdf` then `ignored`.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore(gitignore): ignore generated breves.pdf"
```

---

## Final end-to-end acceptance

After all tasks, with a real `.env` and content:

1. `yarn start`, open `http://localhost:$PORT/`.
2. Select ≥1 article, ensure some upcoming events exist, add état-civil entries.
3. Confirm the preview shows paginated A4 pages including the **Calendrier des Événements**.
4. Click **📄 Générer le PDF** → a new tab opens with `breves.pdf`.
5. Confirm in the PDF: the calendar section is present (the original bug), no paragraph is cut mid-line across pages, and the PDF matches the preview page-for-page.

If any block is clipped rather than flowing to the next page, the culprit is a `break-inside: avoid` on a too-tall element — move it off that container (Task 3, Step 3).

## Out of scope (documented, no task)

- **CLI `generate-breves.js`** stays HTML-only (legacy path). PDF generation is the web-app path only, by design.
- **Vercel/serverless PDF** (swap Puppeteer for `@sparticuz/chromium` or a microservice) is the future Next.js-integration phase; `lib/pdf.js` is the single isolated brick to replace.
