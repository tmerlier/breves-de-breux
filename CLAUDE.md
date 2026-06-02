# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Generator for *Les Brèves de Breux*, the twice-yearly printed gazette of the commune
of Breux-sur-Avre. It aggregates Markdown articles, upcoming events, a mayor's message,
and civil-status records (births/deaths/new residents) into a single A4 HTML document
(`breves.html`) intended to be exported to PDF via the browser's print dialog.

## Commands

```bash
yarn install          # Node >= 18, Yarn Berry (4.1.1)
yarn start            # Express web app on http://localhost:3000 (primary workflow)
yarn dev              # alias of start
yarn generate         # legacy CLI: render breves.html directly (see gotcha below)
```

There is **no test suite, linter, or build step**. Verification is visual: regenerate
`breves.html` and check the rendered/printed output.

## Architecture

There are **two independent entry points that duplicate the same pipeline**:

- **`server.js`** — the Express web app and REST API. This is the maintained path; the
  web UI (`public/index.html` + `public/app.js`) drives it. Image path-prefixing here is
  more sophisticated (handles external URLs vs local `/images` mount) than the CLI.
- **`generate-breves.js`** — the original headless CLI. Reads `config.json` + env vars and
  writes `breves.html` in one shot.

Both implement the same core logic — `parseDate`, Markdown loading, stripping `<img>` from
article bodies, date sorting/filtering, event filtering, EJS rendering — so **a change to
the rendering pipeline usually needs to be made in both files**, or you risk the CLI and
the web app diverging.

The shared pipeline:
1. Read `.md` files from `ARTICLES_DIR`, parse YAML front-matter with `gray-matter`.
2. Skip `draft: true`; strip all `<img>` tags from the body (only the front-matter `img`
   is kept as the article's lead image); prefix image paths against `IMAGES_PATH`.
3. Sort articles ascending by date, filter to the configured `[startDate, endDate]` period.
4. Load `events.json`, keep **only events starting after the period end** (these are the
   "upcoming" events advertised in the gazette).
5. Render `templates/breves-template.ejs` with the assembled context → HTML.

### Templates (EJS, print-oriented)

`templates/breves-template.ejs` is the A4 skeleton: all CSS is inline in its `<style>`
block, sized in millimetres (`210mm`/`297mm`) with `page-break` rules for print. It
`include()`s four partials: `main-page` (cover + mayor message), `article`, `etat-civil`
(births/deaths/arrivals), and `event`. Layout changes must be validated against the PDF
print output, not just on-screen.

### Persisted state

`server.js` writes JSON state files at the repo root: `config.json` (period, mayor
message, civil status, `rappels`) and `form-state.json` (web UI form snapshot). These are
the app's only persistence — there is no database.

### Dates

Articles and config use **`MM-DD-YYYY`**; events in `events.json` use **ISO `YYYY-MM-DD`**.
Don't conflate them — `parseDate` only handles the `MM-DD-YYYY` form.

## Critical setup gotchas

- **Content lives in a sibling repo, not here.** `articles/` and `events.json` are **not**
  in this repo. `ARTICLES_DIR` / `EVENTS_PATH` must point at them via `.env`, and `server.js`
  auto-mounts `../breux-sur-avre/public/images` at `/images` if that sibling directory
  exists. Expect an empty article list until `.env` is configured to point at real content.

## Configuration precedence

`config.json` (repo root) > environment variables (`.env`) > hardcoded defaults. Recognised
env vars: `PORT`, `ARTICLES_DIR`, `TEMPLATE_DIR`, `TEMPLATE_NAME`, `OUTPUT_FILE`,
`IMAGES_PATH`, `MAIN_IMAGE`, `EVENTS_PATH`, `START_DATE`, `END_DATE`, `MAYOR_MESSAGE`. When
no dates are given, the default period is the last 6 months up to today.

## REST API

`GET/POST /api/config`, `GET/POST /api/form-state`, `GET /api/articles` (optional
`startDate`/`endDate` query), `POST /api/upload` (multipart `image`, saved to `uploads/`),
`POST /api/preview` (returns rendered HTML), `POST /api/generate` (writes `breves.html`).
See `API.md` for full request/response shapes.
