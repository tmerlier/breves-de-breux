require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');
const render = require('./lib/render');
const { generatePdf } = require('./lib/pdf');
const {
  parseDate,
  formatDate,
  loadArticles,
  prepareArticlesForRendering,
  loadAndFilterEvents,
  buildContext,
  renderTemplate,
} = render;

const app = express();
const PORT = process.env.PORT || 3000;
// Normalisation IMAGES_PATH: si c'est un chemin filesystem absolu on le remplace par '/images'
if (process.env.IMAGES_PATH && !/^(https?:)?\/\//.test(process.env.IMAGES_PATH) && path.isAbsolute(process.env.IMAGES_PATH)) {
  process.env.IMAGES_PATH = '/images';
}

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
// Sert le polyfill Paged.js (pagination print) depuis node_modules
app.use('/vendor/pagedjs', express.static(path.join(__dirname, 'node_modules/pagedjs/dist')));
// Montage des images externes du site Breux-sur-Avre si le dossier existe
const externalImagesPath = path.resolve(__dirname, '../breux-sur-avre/public/images');
if (fs.existsSync(externalImagesPath)) {
  app.use('/images', express.static(externalImagesPath));
  console.log('📷 Dossier images monté sur /images depuis', externalImagesPath);
} else {
  console.warn('⚠️ Dossier images externe introuvable :', externalImagesPath);
}

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

// Résout le chemin du fichier d'événements depuis l'environnement.
function resolveEventsPath() {
  const EVENTS_PATH = process.env.EVENTS_PATH || path.join(__dirname, 'events.json');
  return path.isAbsolute(EVENTS_PATH) ? EVENTS_PATH : path.join(__dirname, EVENTS_PATH);
}

// API: Récupérer les articles
app.get('/api/articles', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const ARTICLES_DIR = process.env.ARTICLES_DIR || path.join(__dirname, 'articles');
    const articlesPath = path.isAbsolute(ARTICLES_DIR) ? ARTICLES_DIR : path.join(__dirname, ARTICLES_DIR);
    console.log('📄 Chargement articles depuis', articlesPath);

    let articles = loadArticles(articlesPath, process.env.IMAGES_PATH);
    console.log('✅ Articles trouvés:', articles.length);

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
        },
        rappels: []
      };
    }
    
    // Si pas de dates dans la config, utiliser les dates par défaut
    if (!config.startDate || !config.endDate) {
      const defaultDates = getDefaultDates();
      config.startDate = config.startDate || defaultDates.startDate;
      config.endDate = config.endDate || defaultDates.endDate;
    }
    
    // S'assurer que rappels existe toujours
    if (!config.rappels) {
      config.rappels = [];
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

// API: Sauvegarder l'état du formulaire
app.post('/api/save-form-state', (req, res) => {
  try {
    const formStatePath = path.join(__dirname, 'form-state.json');
    fs.writeFileSync(formStatePath, JSON.stringify(req.body, null, 4), 'utf8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Récupérer l'état du formulaire
app.get('/api/form-state', (req, res) => {
  try {
    const formStatePath = path.join(__dirname, 'form-state.json');
    if (fs.existsSync(formStatePath)) {
      const formStateContent = fs.readFileSync(formStatePath, 'utf8');
      res.json(JSON.parse(formStateContent));
    } else {
      res.json(null);
    }
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

const TEMPLATE_DIR = path.join(__dirname, 'templates');
const TEMPLATE_NAME = 'breves-template.ejs';

// Assemble le contexte de rendu commun aux routes preview et generate.
function renderBreves(config, selectedArticles) {
  const articles = prepareArticlesForRendering(selectedArticles);
  const events = loadAndFilterEvents(resolveEventsPath());
  const context = buildContext(config, articles, events);
  return renderTemplate(TEMPLATE_DIR, TEMPLATE_NAME, context);
}

// API: Générer la prévisualisation
app.post('/api/preview', (req, res) => {
  try {
    const { config, selectedArticles } = req.body;
    res.send(renderBreves(config, selectedArticles));
  } catch (error) {
    console.error('Erreur génération preview:', error);
    res.status(500).json({ error: error.message });
  }
});

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

// Route pour télécharger le PDF généré
app.get('/breves.pdf', (req, res) => {
  const pdfPath = path.join(__dirname, 'breves.pdf');
  if (fs.existsSync(pdfPath)) {
    res.sendFile(pdfPath);
  } else {
    res.status(404).send('PDF non généré. Cliquez sur « Générer le PDF » d\'abord.');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
