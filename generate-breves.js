require('dotenv').config();
const fs = require('fs');
const path = require('path');
const render = require('./lib/render');

// ---------------------------------------------
// Chargement d'un fichier de configuration JSON
// ---------------------------------------------
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, 'config.json');
let config = {};
try {
  if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }
} catch (err) {
  console.warn(`Impossible de lire le fichier de configuration (${CONFIG_PATH}) : ${err.message}`);
}

// Récupération des variables d'environnement ou valeurs par défaut
const ARTICLES_DIR = process.env.ARTICLES_DIR || path.join(__dirname, 'articles');
const TEMPLATE_DIR = process.env.TEMPLATE_DIR || path.join(__dirname, 'templates');
const TEMPLATE_NAME = process.env.TEMPLATE_NAME || 'breves-template.ejs';
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(__dirname, 'breves.html');
const IMAGES_PATH = process.env.IMAGES_PATH || '';
const MAIN_IMAGE = process.env.MAIN_IMAGE || '';       // Image principale pour la page d'accueil
const EVENTS_PATH = process.env.EVENTS_PATH || '';     // Chemin vers le fichier JSON d'évènements

// Valeurs par défaut spécifiques au CLI (priorité : config.json > env > défaut)
config.mayorMessage = config.mayorMessage || process.env.MAYOR_MESSAGE || 'À compléter – mot du maire ici.';
config.mainImage = config.mainImage || MAIN_IMAGE;

// Chargement des articles (drafts exclus pour le CLI)
let articles = render.loadArticles(ARTICLES_DIR, IMAGES_PATH).filter(article => !article.draft);

// Détermination des dates de filtrage (priorité au fichier de config, puis aux variables d'environnement)
const startDateRaw = config.startDate || process.env.START_DATE;
const endDateRaw = config.endDate || process.env.END_DATE;

const startDate = (startDateRaw && render.parseDate(startDateRaw))
  || (articles.length > 0 ? articles[0].date : new Date());
const endDate = (endDateRaw && render.parseDate(endDateRaw)) || new Date();

// Filtrer les articles selon la plage de dates
articles = articles.filter(article => article.date >= startDate && article.date <= endDate);

// Préparation (suppression des images inline, réécriture des URLs, tri)
const preparedArticles = render.prepareArticlesForRendering(articles);

// Chargement et filtrage des évènements (ceux qui débutent après la fin de période)
const eventsPath = EVENTS_PATH
  ? (path.isAbsolute(EVENTS_PATH) ? EVENTS_PATH : path.join(__dirname, EVENTS_PATH))
  : '';
const events = render.loadAndFilterEvents(eventsPath, endDate);

// Construction du contexte et rendu
const context = render.buildContext(config, preparedArticles, events);
const outputHtml = render.renderTemplate(TEMPLATE_DIR, TEMPLATE_NAME, context);

// Sauvegarde du document généré
fs.writeFileSync(OUTPUT_FILE, outputHtml, 'utf8');
console.log(`Document généré : ${OUTPUT_FILE}`);
