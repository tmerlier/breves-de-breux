// Pipeline de rendu partagé entre le serveur web (server.js) et le script CLI
// (generate-breves.js). Centralise le chargement des articles, le filtrage des
// événements, la préparation pour l'impression et le rendu EJS afin que les deux
// points d'entrée produisent exactement le même document.

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const ejs = require('ejs');

// Parse une date au format "MM-DD-YYYY".
function parseDate(dateStr) {
  if (!dateStr) return null;
  const [month, day, year] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Formate une date en "MM-DD-YYYY".
function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
}

// Convertit une URL localhost en chemin relatif pour l'impression
// (ex: http://localhost:3000/uploads/x.jpg -> ./uploads/x.jpg).
function toPrintableImageSrc(src) {
  if (!src) return src;
  if (src.includes('localhost:') || src.startsWith('http://localhost') || src.startsWith('https://localhost')) {
    return src.replace(/^https?:\/\/localhost:\d+/, '.');
  }
  return src;
}

// Préfixe un chemin d'image avec IMAGES_PATH en gérant les URLs externes
// déjà complètes et les montages locaux (ex: /images).
function prefixImagePath(imgPath, imagesPath) {
  if (!imagesPath || !imgPath) return imgPath;

  const imagesMount = imagesPath.replace(/\/$/, '');
  const isExternalImage = /^(https?:)?\/\//i.test(imgPath);
  const isImagesPathExternal = /^(https?:)?\/\//i.test(imagesMount);

  if (isExternalImage) return imgPath; // URL déjà complète : ne pas toucher
  if (isImagesPathExternal) return imagesMount + '/' + imgPath.replace(/^\//, '');
  if (!imgPath.startsWith(imagesMount)) {
    return imgPath.startsWith('/') ? imagesMount + imgPath : imagesMount + '/' + imgPath;
  }
  return imgPath;
}

// Charge et parse tous les articles Markdown d'un dossier (drafts inclus, avec
// le drapeau `draft` ; au caller de filtrer). Trié par date croissante.
function loadArticles(articlesDir, imagesPath) {
  if (!fs.existsSync(articlesDir)) return [];

  const articles = [];
  fs.readdirSync(articlesDir).forEach(filename => {
    if (!filename.endsWith('.md')) return;

    const filepath = path.join(articlesDir, filename);
    if (!fs.existsSync(filepath)) return;

    const parsed = matter(fs.readFileSync(filepath, 'utf8'));
    articles.push({
      id: filename,
      title: parsed.data.title || 'Sans titre',
      date: parseDate(parsed.data.date),
      dateStr: parsed.data.date,
      content: parsed.content,
      img: prefixImagePath(parsed.data.img, imagesPath),
      alt: parsed.data.alt,
      draft: parsed.data.draft === true,
    });
  });

  articles.sort((a, b) => a.date - b.date);
  return articles;
}

// Prépare les articles sélectionnés pour le rendu : suppression des images
// inline, normalisation des dates, réécriture des URLs localhost, tri par date.
function prepareArticlesForRendering(selectedArticles) {
  return selectedArticles
    .map(article => ({
      title: article.title,
      date: new Date(article.date),
      content: article.content.replace(/<img[^>]*>/g, ''),
      img: toPrintableImageSrc(article.img),
      alt: article.alt,
    }))
    .sort((a, b) => a.date - b.date);
}

// Charge les événements et ne garde que ceux qui commencent strictement après
// la fin de la période couverte.
function loadAndFilterEvents(eventsPath, periodEndDate) {
  if (!eventsPath || !fs.existsSync(eventsPath)) return [];

  try {
    const allEvents = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
    return allEvents.filter(event => new Date(event.startDate) > periodEndDate);
  } catch (error) {
    console.error('Erreur lecture événements:', error);
    return [];
  }
}

// Construit le contexte de rendu EJS à partir d'une config, d'articles déjà
// préparés et d'événements déjà filtrés. Le sous-titre reflète la plage de
// dates réellement couverte par les articles.
function buildContext(config, articles, events) {
  const formatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  const displayStartDate = articles.length > 0 ? articles[0].date : new Date();
  const displayEndDate = articles.length > 0 ? articles[articles.length - 1].date : new Date();

  return {
    mayor_message: config.mayorMessage || '',
    etatCivil: config.etatCivil || null,
    articles,
    subtitle: `De ${formatter.format(displayStartDate)} à ${formatter.format(displayEndDate)}`,
    mainImage: toPrintableImageSrc(config.mainImage || ''),
    events,
    rappels: config.rappels || [],
  };
}

// Rend le template principal avec le contexte fourni.
function renderTemplate(templateDir, templateName, context) {
  const templatePath = path.join(templateDir, templateName);
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  return ejs.render(templateContent, context, { filename: templatePath });
}

module.exports = {
  parseDate,
  formatDate,
  toPrintableImageSrc,
  prefixImagePath,
  loadArticles,
  prepareArticlesForRendering,
  loadAndFilterEvents,
  buildContext,
  renderTemplate,
};
