require('dotenv').config();
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ejs = require('ejs');

// ---------------------------------------------
// Chargement d'un fichier de configuration JSON
// ---------------------------------------------
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, 'config.json');
let config = {};
try {
  if (fs.existsSync(CONFIG_PATH)) {
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    config = JSON.parse(configContent);
  }
} catch (err) {
  console.warn(`Impossible de lire le fichier de configuration (${CONFIG_PATH}) : ${err.message}`);
}

// Récupération des variables d'environnement ou valeurs par défaut
const ARTICLES_DIR = process.env.ARTICLES_DIR || path.join(__dirname, 'articles');
const TEMPLATE_DIR = process.env.TEMPLATE_DIR || path.join(__dirname, 'templates');
const TEMPLATE_NAME = process.env.TEMPLATE_NAME || 'breves_template.ejs';
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(__dirname, 'breves.html');
const IMAGES_PATH = process.env.IMAGES_PATH || '';
const MAIN_IMAGE = process.env.MAIN_IMAGE || '';       // Image principale pour la page d'accueil

// Si un mainImage est défini dans config.json il a priorité
const MAIN_IMAGE_FINAL = config.mainImage || MAIN_IMAGE;

const EVENTS_PATH = process.env.EVENTS_PATH || '';       // Chemin vers le fichier JSON d'évènements

// Fonction pour parser une date au format "MM-DD-YYYY"
function parseDate(dateStr) {
  const [month, day, year] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

let articles = [];
const files = fs.readdirSync(ARTICLES_DIR);

// Parcours des fichiers Markdown
files.forEach(filename => {
  if (filename.endsWith('.md')) {
    const filepath = path.join(ARTICLES_DIR, filename);
    const fileContent = fs.readFileSync(filepath, 'utf8');
    const parsed = matter(fileContent);

    // Ignorer les articles en brouillon
    if (parsed.data.draft === true) return;

    // Parsing de la date
    const dateStr = parsed.data.date;
    let articleDate;
    try {
      articleDate = parseDate(dateStr);
    } catch (error) {
      console.error(`Erreur lors du parsing de la date dans ${filename}: ${error}`);
      return;
    }
    
    // Préfixer le chemin de l'image principale si IMAGES_PATH est défini
    let imgPath = parsed.data.img;
    if (IMAGES_PATH && imgPath) {
      imgPath = IMAGES_PATH.replace(/\/$/, '') + '/' + imgPath.replace(/^\//, '');
    }
    
    // Supprimer complètement les images du contenu, qu'elles soient en Markdown ou en HTML
    let content = parsed.content
      .replace(/<img[^>]*>/g, '');
    
    articles.push({
      title: parsed.data.title,
      date: articleDate,
      content: content, // contenu mis à jour
      img: imgPath,
      alt: parsed.data.alt,
    });
  }
});

// Tri des articles par date croissante
articles.sort((a, b) => a.date - b.date);

// Détermination des dates de filtrage (priorité au fichier de config, puis aux variables d'environnement)
let startDateRaw = config.startDate || process.env.START_DATE;
let endDateRaw   = config.endDate   || process.env.END_DATE;

let startDate;
if (startDateRaw) {
  try {
    startDate = parseDate(startDateRaw);
  } catch (error) {
    console.error("Erreur lors du parsing de startDate, utilisation de la date du plus ancien article.");
    startDate = articles.length > 0 ? articles[0].date : new Date();
  }
} else {
  startDate = articles.length > 0 ? articles[0].date : new Date();
}

let endDate;
if (endDateRaw) {
  try {
    endDate = parseDate(endDateRaw);
  } catch (error) {
    console.error("Erreur lors du parsing de endDate, utilisation de la date d'aujourd'hui.");
    endDate = new Date();
  }
} else {
  endDate = new Date();
}

// Filtrer les articles selon la plage de dates
articles = articles.filter(article => article.date >= startDate && article.date <= endDate);

// Formatage des dates en français (mois et année)
const formatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const formattedStartDate = formatter.format(startDate);
const formattedEndDate = formatter.format(endDate);

// Chargement et filtrage des évènements depuis le fichier JSON défini dans EVENTS_PATH
let events = [];
if (EVENTS_PATH) {
  try {
    const eventsContent = fs.readFileSync(path.join(__dirname, EVENTS_PATH), 'utf8');
    events = JSON.parse(eventsContent).filter(event => {
      // Les dates d'évènements sont au format ISO "YYYY-MM-DD", qui peut être directement parsé par new Date()
      const eventStart = new Date(event.startDate);
      // Ne récupérer que les évènements dont la date de début est après (ou égale à) endDate (ou aujourd'hui si END_DATE n'est pas défini)
      return eventStart >= endDate;
    });
  } catch (error) {
    console.error(`Erreur lors de la lecture des évènements depuis ${EVENTS_PATH}: ${error}`);
  }
}

// Préparation du contexte pour le template EJS
const context = {
  mayor_message: config.mayorMessage || process.env.MAYOR_MESSAGE || "À compléter – mot du maire ici.",
  etatCivil: config.etatCivil || null,
  articles: articles,
  subtitle: `De ${formattedStartDate} à ${formattedEndDate}`,
  mainImage: MAIN_IMAGE_FINAL,  // Image principale (config > env > vide)
  events: events           // Tableau d'évènements filtré
};

// Lecture et rendu du template EJS
const templatePath = path.join(TEMPLATE_DIR, TEMPLATE_NAME);
const templateContent = fs.readFileSync(templatePath, 'utf8');
const outputHtml = ejs.render(templateContent, context, { filename: templatePath });

// Sauvegarde du document généré
fs.writeFileSync(OUTPUT_FILE, outputHtml, 'utf8');
console.log(`Document généré : ${OUTPUT_FILE}`);