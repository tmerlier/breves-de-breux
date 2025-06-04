# Agent Information

This document provides a summary of the "Brèves de Breux" project, extracted from the README.md file. It outlines the project's functionality, setup, configuration, and usage.

## Project Functionality

The "Brèves de Breux" tool generates a biannual paper gazette for the municipality of Breux-sur-Avre.
It aggregates news published on the municipal website, upcoming events, and other information (civil status, mayor's message, etc.) to automatically generate an A4 booklet ready for printing.

The general operation is as follows:
1. Website articles are converted to Markdown format (YAML front-matter) and placed in the `articles/` directory.
2. A Node.js script (`generate-breves.js`):
    - Reads the configuration (`config.json` or environment variables).
    - Loads articles between two given dates.
    - Retrieves events (JSON file) and other editorial blocks.
    - Renders the EJS template (`templates/`) to produce `breves.html`.
3. The resulting HTML file can be exported to PDF via a browser or a CLI tool (Chromium, wkhtmltopdf, etc.).

## Prerequisites

| Tool         | Recommended Version |
|--------------|---------------------|
| Node.js      | ≥ 18                |
| Yarn (Berry) | ≥ 4                 |
| Git          | ≥ 2.20              |

*(EJS engine and other dependencies are installed automatically.)*

## Installation

```bash
git clone https://github.com/your-org/breves-de-breux.git
cd breves-de-breux
yarn install
```

## Configuration

Parameters can be supplied in three ways:
1. A `config.json` file at the root (highest priority).
2. Environment variables.
3. Default values hardcoded in the script.

### Example `config.json`

```jsonc
{
  // Period to cover (MM-DD-YYYY)
  "startDate": "01-01-2025",
  "endDate":   "06-30-2025",

  // Cover image (relative to IMAGES_PATH or absolute path)
  "mainImage": "header.jpg",

  // Mayor's message (plain text; \n = newline)
  "mayorMessage": "Chères Bréusiennes, chers Bréusiens, ...",

  // Civil Status block (optional)
  "etatCivil": {
    "naissances": [
      { "prenom": "Lou",  "nom": "Martin", "date": "2025-02-14" }
    ],
    "mariages": [
      { "prenom1": "Anna", "nom1": "Durand", "prenom2": "Léo", "nom2": "Petit", "date": "2025-04-22" }
    ],
    "deces": [
      { "prenom": "René", "nom": "Bernard", "date": "2025-03-03" }
    ]
  }
}
```

### Recognized Environment Variables

| Name           | Role                      | Default Value        |
|----------------|---------------------------|----------------------|
| `ARTICLES_DIR` | Folder containing `.md`   | `./articles`         |
| `TEMPLATE_DIR` | Folder for EJS templates  | `./templates`        |
| `TEMPLATE_NAME`| Main EJS file             | `breves_template.ejs`|
| `OUTPUT_FILE`  | Generated HTML            | `./breves.html`      |
| `IMAGES_PATH`  | Prefix for images         | *empty*              |
| `MAIN_IMAGE`   | Cover image               | *empty*              |
| `EVENTS_PATH`  | JSON events file          | *empty*              |
| `START_DATE`, `END_DATE` | Period limits   | *calculated*         |

Declare them in a local `.env` file or via the command line.

## Article Structure

Each article is a Markdown file with **front-matter**:

```markdown
---
title: "January Municipal Council"
date: "01-15-2025"   # MM-DD-YYYY
img: "conseil.jpg"   # optional
alt: "Municipal council meeting"
draft: false         # true = ignored by the script
---

Summary of the January 15th session…

![internal image](interieur.jpg)

Another paragraph, list, etc.
```

The script:
- Ignores articles marked `draft: true`.
- Removes all `<img>` tags from the body (only the main image is kept).

## Execution

```bash
# Method 1: via Yarn
yarn generate

# Method 2: directly
node generate-breves.js
```

The terminal indicates the path of the generated document:
```
Document généré : /…/breves.html
```

## PDF Export

Open `breves.html` in a browser:

1. **Ctrl/Cmd + P**
2. Destination: "Save as PDF"
3. Margins: None
4. Options: Enable background printing

For CI automation:
```bash
# Example with Chromium
chromium --headless --print-to-pdf=breves.pdf breves.html
```

## Template Customization

EJS files are located in `templates/`:

| File                | Role                                      |
|---------------------|-------------------------------------------|
| `breves_template.ejs` | Main A4 skeleton                          |
| `main-page.ejs`     | First page (title, cover, mayor's message)|
| `article.ejs`       | Article layout                            |
| `event.ejs`         | Event thumbnail                           |
| `etat-civil.ejs`    | Births/marriages/deaths register          |

The layout (CSS inline in `<style>`) can be adjusted; remember to **test the PDF rendering** after modification.

## Repository Organization

```
breves-de-breux/
├── articles/            # Source Markdown for articles
├── templates/           # EJS files (partials + main template)
├── images/              # Illustrative resources (optional)
├── events.json          # Future events (optional)
├── config.json          # Local configuration (optional)
├── generate-breves.js   # Generation script
└── breves.html          # Generated output
```
