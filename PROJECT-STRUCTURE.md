# 📂 Structure complète du projet

```
breves-de-breux/
│
├── 📄 Configuration et dépendances
│   ├── package.json              # Dépendances npm et scripts
│   ├── yarn.lock                 # Verrouillage des versions
│   ├── .yarnrc.yml               # Configuration Yarn (node-modules)
│   ├── .env.example              # Variables d'environnement exemple
│   ├── .gitignore                # Fichiers ignorés par Git
│   └── .editorconfig             # Configuration de l'éditeur
│
├── 📚 Documentation
│   ├── README.md                 # Vue d'ensemble du projet
│   ├── QUICKSTART.md             # ⭐ Démarrage rapide (5 min)
│   ├── GUIDE-UTILISATION.md      # Guide d'utilisation complet
│   ├── README-WEBAPP.md          # Documentation de l'interface web
│   ├── API.md                    # Documentation de l'API REST
│   ├── DEPLOYMENT.md             # Guide de déploiement
│   ├── TROUBLESHOOTING.md        # Guide de dépannage
│   ├── CONTRIBUTING.md           # Guide de contribution
│   ├── CHANGELOG.md              # Historique des versions
│   ├── IMPLEMENTATION.md         # Récapitulatif de l'implémentation
│   └── LICENSE                   # Licence MIT
│
├── 🖥️ Backend
│   ├── server.js                 # ⭐ Serveur Express + API REST
│   └── generate-breves.js        # Script de génération original (CLI)
│
├── 🎨 Frontend (Interface Web)
│   └── public/
│       ├── index.html            # ⭐ Interface principale
│       └── app.js                # ⭐ Logique JavaScript
│
├── 📄 Templates EJS
│   └── templates/
│       ├── breves-template.ejs   # Template principal
│       ├── main-page.ejs         # Première page (titre, maire)
│       ├── article.ejs           # Mise en page d'un article
│       ├── event.ejs             # Vignette d'événement
│       └── etat-civil.ejs        # Registre état civil
│
├── 📝 Contenu
│   ├── articles/                 # Articles en Markdown
│   │   ├── exemple-conseil-municipal.md
│   │   └── exemple-fete-commune.md
│   ├── events.json               # Événements futurs
│   └── config.json               # ⭐ Configuration sauvegardée
│
├── 🖼️ Ressources
│   └── uploads/                  # Images uploadées (auto-créé)
│
├── 📤 Sortie
│   └── breves.html               # Document final généré
│
└── 🔧 Node.js
    ├── node_modules/             # Dépendances installées
    └── .yarn/                    # Cache Yarn
```

## 🎯 Fichiers clés

### Pour démarrer
1. **QUICKSTART.md** - Guide de démarrage rapide
2. **package.json** - Installer : `yarn install`
3. **server.js** - Démarrer : `yarn start`

### Pour utiliser l'interface
1. **public/index.html** - Interface web
2. **public/app.js** - Logique de l'application
3. **config.json** - Configuration sauvegardée

### Pour comprendre
1. **README.md** - Vue d'ensemble
2. **GUIDE-UTILISATION.md** - Guide complet
3. **API.md** - Documentation technique

### Pour déployer
1. **DEPLOYMENT.md** - Options de déploiement
2. **.env.example** - Variables d'environnement
3. **server.js** - Configuration du serveur

## 📊 Statistiques

- **Fichiers de code** : 4 (server.js, generate-breves.js, app.js, index.html)
- **Templates** : 5 fichiers EJS
- **Documentation** : 10 fichiers Markdown
- **Dépendances** : 6 packages npm
- **Lignes de code** : ~1500 lignes

## 🔄 Flux de données

```
┌─────────────┐
│   Articles  │ (Markdown)
│ articles/*.md│
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────────────────────────┐
│                    API Server                        │
│                   (server.js)                        │
│                                                      │
│  GET /api/articles ──────► Parse Markdown           │
│  POST /api/config ───────► Save config.json         │
│  POST /api/upload ───────► Save to uploads/         │
│  POST /api/preview ──────► Render EJS → HTML        │
│  POST /api/generate ─────► Generate breves.html     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ↓
              ┌────────────────┐
              │   Web UI       │
              │ (index.html)   │
              │                │
              │  📅 Période    │
              │  �️ Image      │
              │  � Message    │
              │  � Articles   │
              │  📋 État civil │
              │  👁️ Preview    │
              └────────┬───────┘
                       │
                       ↓
              ┌────────────────┐
              │  breves.html   │
              │  (Document     │
              │   final PDF)   │
              └────────────────┘
```

## 🎨 Technologies utilisées

### Backend
- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **EJS** - Moteur de templates
- **Multer** - Upload de fichiers
- **Gray-matter** - Parsing Markdown front-matter

### Frontend
- **HTML5** - Structure
- **CSS3** - Styles (Grid, Flexbox)
- **JavaScript ES6+** - Logique
- **Fetch API** - Communication avec l'API

### Outils
- **Yarn 4** - Gestionnaire de packages
- **Git** - Contrôle de version

## 🚀 Commandes utiles

```bash
# Installation
yarn install

# Démarrage
yarn start              # Interface web
yarn dev                # Alias de start
yarn generate           # Script CLI original

# Développement
yarn --version          # Version de Yarn
node --version          # Version de Node.js

# Nettoyage
rm -rf node_modules     # Supprimer les dépendances
rm breves.html          # Supprimer le fichier généré
rm -rf uploads/*        # Supprimer les uploads
```

## 📦 Taille du projet

```
Total : ~5 MB
├── node_modules : ~4 MB
├── Documentation : ~100 KB
├── Code source : ~50 KB
└── Templates : ~20 KB
```

---

**Dernière mise à jour** : 27 octobre 2025
**Version** : 2.0.0
