require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const matter = require('gray-matter');
const ejs = require('ejs');
const multer = require('multer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Configuration multer pour l'upload d'images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Fonction pour parser une date au format "MM-DD-YYYY"
function parseDate(dateStr) {
  if (!dateStr) return null;
  const [month, day, year] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Fonction pour formater une date en "MM-DD-YYYY"
function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
}

// Calculer les dates par défaut (6 mois avant → aujourd'hui)
function getDefaultDates() {
  const endDate = new Date(); // Aujourd'hui
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6); // 6 mois avant
  
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  };
}

// Préparer les articles pour le rendu (suppression des images, conversion des dates)
function prepareArticlesForRendering(selectedArticles) {
  return selectedArticles.map(article => {
    // Supprimer les images du contenu
    let content = article.content.replace(/<img[^>]*>/g, '');
    
    return {
      title: article.title,
      date: new Date(article.date),
      content: content,
      img: article.img,
      alt: article.alt,
    };
  }).sort((a, b) => a.date - b.date); // Tri par date
}

// Charger et filtrer les événements
function loadAndFilterEvents(periodEndDate) {
  const EVENTS_PATH = process.env.EVENTS_PATH || path.join(__dirname, 'events.json');
  const eventsPath = path.isAbsolute(EVENTS_PATH) ? EVENTS_PATH : path.join(__dirname, EVENTS_PATH);
  
  if (!fs.existsSync(eventsPath)) {
    return [];
  }

  try {
    const eventsContent = fs.readFileSync(eventsPath, 'utf8');
    const allEvents = JSON.parse(eventsContent);
    
    // Filtrer les événements : ne garder que ceux qui commencent strictement après la date de fin de la période
    return allEvents.filter(event => {
      const eventStart = new Date(event.startDate);
      return eventStart > periodEndDate;
    });
  } catch (error) {
    console.error('Erreur lecture événements:', error);
    return [];
  }
}

// API: Récupérer les articles
app.get('/api/articles', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const ARTICLES_DIR = process.env.ARTICLES_DIR || path.join(__dirname, 'articles');
    const articlesPath = path.isAbsolute(ARTICLES_DIR) ? ARTICLES_DIR : path.join(__dirname, ARTICLES_DIR);
    
    if (!fs.existsSync(articlesPath)) {
      return res.json([]);
    }

    const files = fs.readdirSync(articlesPath);
    let articles = [];

    files.forEach(filename => {
      if (filename.endsWith('.md')) {
        const filepath = path.join(articlesPath, filename);
        const fileContent = fs.readFileSync(filepath, 'utf8');
        const parsed = matter(fileContent);

        const dateStr = parsed.data.date;
        let articleDate;
        try {
          articleDate = parseDate(dateStr);
        } catch (error) {
          console.error(`Erreur parsing date dans ${filename}:`, error, `date=${dateStr}`);
          return;
        }

        // Préfixer le chemin de l'image avec IMAGES_PATH si défini
        let imgPath = parsed.data.img;
        const IMAGES_PATH = process.env.IMAGES_PATH;
        if (IMAGES_PATH && imgPath) {
          imgPath = IMAGES_PATH.replace(/\/$/, '') + '/' + imgPath.replace(/^\//, '');
        }

        articles.push({
          id: filename,
          title: parsed.data.title || 'Sans titre',
          date: articleDate,
          dateStr: dateStr,
          content: parsed.content,
          img: imgPath,
          alt: parsed.data.alt,
          draft: parsed.data.draft === true,
        });
      }
    });

    // Tri par date croissante
    articles.sort((a, b) => a.date - b.date);

    // Filtrage par dates si fournies
    if (startDate) {
      const start = parseDate(startDate);
      articles = articles.filter(a => a.date >= start);
    }
    if (endDate) {
      const end = parseDate(endDate);
      articles = articles.filter(a => a.date <= end);
    }

    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Récupérer la configuration
app.get('/api/config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'config.json');
    let config;
    
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(configContent);
    } else {
      // Configuration par défaut avec dates calculées
      const defaultDates = getDefaultDates();
      config = {
        startDate: defaultDates.startDate,
        endDate: defaultDates.endDate,
        mainImage: '',
        mayorMessage: '',
        etatCivil: {
          naissances: [],
          deces: [],
          arrivants: []
        }
      };
    }
    
    // Si pas de dates dans la config, utiliser les dates par défaut
    if (!config.startDate || !config.endDate) {
      const defaultDates = getDefaultDates();
      config.startDate = config.startDate || defaultDates.startDate;
      config.endDate = config.endDate || defaultDates.endDate;
    }
    
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Sauvegarder la configuration
app.post('/api/config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(req.body, null, 4), 'utf8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Upload d'image
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Générer la prévisualisation
app.post('/api/preview', (req, res) => {
  try {
    const { config, selectedArticles } = req.body;
    
    const TEMPLATE_DIR = path.join(__dirname, 'templates');
    const TEMPLATE_NAME = 'breves-template.ejs';

    // Préparer les articles (suppression images + tri)
    const articles = prepareArticlesForRendering(selectedArticles);

    // Formatage des dates pour l'affichage
    const displayStartDate = articles.length > 0 ? articles[0].date : new Date();
    const displayEndDate = articles.length > 0 ? articles[articles.length - 1].date : new Date();
    
    const formatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
    const formattedStartDate = formatter.format(displayStartDate);
    const formattedEndDate = formatter.format(displayEndDate);

    // Utiliser la vraie date de fin de la période pour filtrer les événements
    const periodEndDate = config.endDate ? parseDate(config.endDate) : new Date();

    // Charger et filtrer les événements
    const events = loadAndFilterEvents(periodEndDate);

    // Contexte pour le template
    const context = {
      mayor_message: config.mayorMessage || '',
      etatCivil: config.etatCivil || null,
      articles: articles,
      subtitle: `De ${formattedStartDate} à ${formattedEndDate}`,
      mainImage: config.mainImage || '',
      events: events
    };

    // Rendu du template
    const templatePath = path.join(TEMPLATE_DIR, TEMPLATE_NAME);
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const outputHtml = ejs.render(templateContent, context, { filename: templatePath });

    res.send(outputHtml);
  } catch (error) {
    console.error('Erreur génération preview:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Générer le fichier final
app.post('/api/generate', (req, res) => {
  try {
    const { config, selectedArticles } = req.body;
    
    const TEMPLATE_DIR = path.join(__dirname, 'templates');
    const TEMPLATE_NAME = 'breves-template.ejs';
    const OUTPUT_FILE = path.join(__dirname, 'breves.html');

    // Préparer les articles (suppression images + tri)
    const articles = prepareArticlesForRendering(selectedArticles);

    const startDate = articles.length > 0 ? articles[0].date : new Date();
    const displayEndDate = articles.length > 0 ? articles[articles.length - 1].date : new Date();
    
    const formatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
    const formattedStartDate = formatter.format(startDate);
    const formattedEndDate = formatter.format(displayEndDate);

    // Récupérer la date de fin de la période depuis la configuration
    const periodEndDate = parseDate(config.endDate);

    // Charger et filtrer les événements
    const events = loadAndFilterEvents(periodEndDate);

    const context = {
      mayor_message: config.mayorMessage || '',
      etatCivil: config.etatCivil || null,
      articles: articles,
      subtitle: `De ${formattedStartDate} à ${formattedEndDate}`,
      mainImage: config.mainImage || '',
      events: events
    };

    const templatePath = path.join(TEMPLATE_DIR, TEMPLATE_NAME);
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const outputHtml = ejs.render(templateContent, context, { filename: templatePath });

    fs.writeFileSync(OUTPUT_FILE, outputHtml, 'utf8');
    
    res.json({ success: true, file: OUTPUT_FILE });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route pour afficher breves.html
app.get('/breves.html', (req, res) => {
  const brevesPath = path.join(__dirname, 'breves.html');
  if (fs.existsSync(brevesPath)) {
    res.sendFile(brevesPath);
  } else {
    res.status(404).send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Document non généré</title>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 50px; }
          .message { background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="message">
          <h1>📄 Document non encore généré</h1>
          <p>Retournez à l'interface pour générer le document.</p>
          <a href="/" style="color: #1a365d;">← Retour à l'interface</a>
        </div>
      </body>
      </html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
