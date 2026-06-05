#!/usr/bin/env node
// Prépare une édition des Brèves de Breux pour la génération CLI, sans passer
// par l'interface web.
//
// Ce que le script fait de façon déterministe (le reste — adaptation papier des
// articles — relève du jugement de l'agent, cf. SKILL.md) :
//   1. Lit ARTICLES_DIR / EVENTS_PATH depuis le .env du repo.
//   2. Charge TOUS les articles `.md` ET `.mdx` (le pipeline natif ne lit que
//      `.md` ; on copie donc les `.mdx` en `.md` pour qu'il les voie).
//   3. Filtre : pas de `draft: true`, date dans [startDate, endDate] inclus.
//   4. Copie chaque article retenu dans un dossier de TRAVAIL local
//      (.breve-travail/articles). Le contenu source du site n'est jamais touché.
//   5. Réécrit les chemins d'images `/images/...` en chemin relatif vers le
//      dossier d'images du site voisin, pour qu'un breves.html ouvert
//      directement (impression) affiche bien les images.
//   6. Écrit config.json (période, mot du maire, état civil, rappels...).
//   7. Affiche un résumé JSON des articles retenus, en signalant ceux qui
//      contiennent des liens / URLs (candidats à l'adaptation papier).
//
// Usage : node skills/generer-breve-de-breux/scripts/preparer-breve.js <payload.json>
//
// payload.json :
// {
//   "startDate": "01-03-2025",          // MM-DD-YYYY, obligatoire
//   "endDate":   "10-31-2025",          // MM-DD-YYYY, obligatoire
//   "mayorMessage": "Chères Bréoliennes...",
//   "mainImage": "",                    // optionnel ; vide => MAIN_IMAGE du .env
//   "etatCivil": {
//     "naissances": [{ "nom": "Orion Merlière", "date": "08-22-2025" }],
//     "deces":      [{ "nom": "Jacques Perrin",  "date": "09-11-2025" }],
//     "arrivants":  ["Delphine Berland"]
//   },
//   "rappels": [{ "titre": "...", "contenu": "..." }]
// }

const fs = require('fs');
const path = require('path');

// skills/generer-breve-de-breux/scripts/ -> remonte 3 niveaux jusqu'à la racine du repo.
const REPO_ROOT = path.resolve(__dirname, '../../../');
require(path.join(REPO_ROOT, 'node_modules/dotenv')).config({ path: path.join(REPO_ROOT, '.env') });
const matter = require(path.join(REPO_ROOT, 'node_modules/gray-matter'));
const render = require(path.join(REPO_ROOT, 'lib/render'));

function fail(msg) {
  console.error(`Erreur : ${msg}`);
  process.exit(1);
}

// --- Lecture du payload --------------------------------------------------
const payloadPath = process.argv[2];
if (!payloadPath) fail('chemin du payload JSON manquant.');
let payload;
try {
  payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
} catch (err) {
  fail(`payload JSON illisible (${payloadPath}) : ${err.message}`);
}

if (!payload.startDate || !payload.endDate) fail('startDate et endDate sont obligatoires (format MM-DD-YYYY).');
const startDate = render.parseDate(payload.startDate);
const endDate = render.parseDate(payload.endDate);
if (!startDate || isNaN(startDate)) fail(`startDate invalide : ${payload.startDate} (attendu MM-DD-YYYY).`);
if (!endDate || isNaN(endDate)) fail(`endDate invalide : ${payload.endDate} (attendu MM-DD-YYYY).`);

// --- Résolution des chemins source --------------------------------------
const ARTICLES_DIR = process.env.ARTICLES_DIR
  ? (path.isAbsolute(process.env.ARTICLES_DIR) ? process.env.ARTICLES_DIR : path.join(REPO_ROOT, process.env.ARTICLES_DIR))
  : path.join(REPO_ROOT, 'articles');
if (!fs.existsSync(ARTICLES_DIR)) fail(`dossier d'articles introuvable : ${ARTICLES_DIR} (vérifier ARTICLES_DIR dans .env).`);

// Dossier d'images du site voisin, pour rendre les images résolvables hors serveur.
// Chemin RELATIF depuis le repo root (où sera écrit breves.html).
const SITE_IMAGES_REL = '../breux-sur-avre/public/images';
const SITE_IMAGES_ABS = path.resolve(REPO_ROOT, SITE_IMAGES_REL);

// --- Préparation du dossier de travail ----------------------------------
const WORK_DIR = path.join(REPO_ROOT, '.breve-travail', 'articles');
fs.rmSync(path.join(REPO_ROOT, '.breve-travail'), { recursive: true, force: true });
fs.mkdirSync(WORK_DIR, { recursive: true });

// Réécrit `/images/x.png` -> `../breux-sur-avre/public/images/x.png` (relatif au repo root).
function rewriteImg(img) {
  if (!img || typeof img !== 'string') return img;
  if (/^(https?:)?\/\//i.test(img)) return img;          // URL absolue : laisser
  if (img.startsWith('/images/')) return SITE_IMAGES_REL + img.slice('/images'.length);
  return img;
}

// --- Sélection + copie ---------------------------------------------------
const inRange = [];
const seen = new Set();
for (const filename of fs.readdirSync(ARTICLES_DIR)) {
  if (!/\.mdx?$/.test(filename)) continue;
  const base = filename.replace(/\.mdx?$/, '');
  if (seen.has(base)) continue;                          // dédoublonne .md vs .mdx
  const parsed = matter(fs.readFileSync(path.join(ARTICLES_DIR, filename), 'utf8'));
  if (parsed.data.draft === true) continue;
  const d = render.parseDate(parsed.data.date);
  if (!d || isNaN(d) || d < startDate || d > endDate) continue;
  seen.add(base);

  const newImg = rewriteImg(parsed.data.img);
  const front = { ...parsed.data };
  if (newImg) front.img = newImg;
  const rebuilt = matter.stringify(parsed.content, front);
  fs.writeFileSync(path.join(WORK_DIR, `${base}.md`), rebuilt, 'utf8');

  const links = (parsed.content.match(/https?:\/\/[^\s"'<>)]+/g) || []);
  inRange.push({
    file: `${base}.md`,
    title: parsed.data.title || 'Sans titre',
    date: parsed.data.date,
    img: newImg || null,
    urlCount: links.length,
    longUrl: links.some(u => u.length > 40),
  });
}
inRange.sort((a, b) => render.parseDate(a.date) - render.parseDate(b.date));

// --- Écriture de config.json --------------------------------------------
const configPath = path.join(REPO_ROOT, 'config.json');
let config = {};
try { if (fs.existsSync(configPath)) config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (_) {}
config.startDate = payload.startDate;
config.endDate = payload.endDate;
config.mayorMessage = payload.mayorMessage || '';
config.mainImage = payload.mainImage || '';            // vide => MAIN_IMAGE du .env
config.etatCivil = payload.etatCivil || { naissances: [], deces: [], arrivants: [] };
config.rappels = payload.rappels || [];
fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');

// --- Résumé --------------------------------------------------------------
console.log(JSON.stringify({
  ok: true,
  workingArticlesDir: path.relative(REPO_ROOT, WORK_DIR),
  imagesResolvedFrom: fs.existsSync(SITE_IMAGES_ABS) ? SITE_IMAGES_REL : null,
  configPath: path.relative(REPO_ROOT, configPath),
  period: { startDate: payload.startDate, endDate: payload.endDate },
  count: inRange.length,
  generateCommand: `ARTICLES_DIR=.breve-travail/articles IMAGES_PATH= node generate-breves.js`,
  articles: inRange,
}, null, 2));
