# breves-de-breux

# Brèves de Breux – Générateur de la gazette bisannuelle

Ce dépôt contient l’outil qui produit **_Les Brèves de Breux_**, le journal papier diffusé deux fois par an par la mairie de Breux‑sur‑Avre (Eure).  
Le script agrège les actualités publiées sur le site web communal, les événements à venir et d’autres informations (état‑civil, mot du maire…) pour générer automatiquement un livret **A4 prêt à imprimer**.

---

## 1. Fonctionnement général

1. Les articles du site sont convertis au format **Markdown** (front‑matter YAML) puis déposés dans `articles/`.
2. Un script Node (`generate-breves.js`) :
   - lit la **configuration** (`config.json` ou variables d’environnement),
   - charge les articles entre deux dates données,
   - récupère les événements (fichier JSON) et autres blocs éditoriaux,
   - rend le modèle **EJS** (`templates/`) afin de produire `breves.html`.
3. Le fichier HTML obtenu peut être exporté en PDF via le navigateur ou un outil CLI (Chromium, wkhtmltopdf…).

---

## 2. Prérequis

| Outil | Version conseillée |
|-------|--------------------|
| Node.js | ≥ 18 |
| Yarn (Berry) | ≥ 4 |
| Git | ≥ 2.20 |

*(Le moteur EJS et autres dépendances sont installées automatiquement.)*

---

## 3. Installation

```bash
git clone https://github.com/votre‑orga/breves-de-breux.git
cd breves-de-breux
yarn install
```

---

## 4. Configuration

Plusieurs paramètres peuvent être fournis de **trois manières** :  
1. Un fichier `config.json` à la racine (prioritaire)  
2. Des variables d’environnement  
3. Les valeurs par défaut codées dans le script

### 4.1 Exemple de `config.json`

```jsonc
{
  // Période à couvrir (MM-DD-YYYY)
  "startDate": "01-01-2025",
  "endDate":   "06-30-2025",

  // Image de couverture (relatif à IMAGES_PATH ou chemin absolu)
  "mainImage": "header.jpg",

  // Mot du maire (texte brut ; \n = retour à la ligne)
  "mayorMessage": "Chères Bréusiennes, chers Bréusiens, ...",

  // Bloc État‑civil (optionnel)
  "etatCivil": {
    "naissances": [
      { "prenom": "Lou",  "nom": "Martin", "date": "2025‑02‑14" }
    ],
    "mariages": [
      { "prenom1": "Anna", "nom1": "Durand", "prenom2": "Léo", "nom2": "Petit", "date": "2025‑04‑22" }
    ],
    "deces": [
      { "prenom": "René", "nom": "Bernard", "date": "2025‑03‑03" }
    ]
  }
}
```

### 4.2 Variables d’environnement reconnues

| Nom | Rôle | Valeur par défaut |
|-----|------|-------------------|
| `ARTICLES_DIR` | Dossier contenant les `.md` | `./articles` |
| `TEMPLATE_DIR` | Dossier des templates EJS  | `./templates` |
| `TEMPLATE_NAME`| Fichier EJS principal      | `breves_template.ejs` |
| `OUTPUT_FILE`  | HTML généré                | `./breves.html` |
| `IMAGES_PATH`  | Préfixe pour les images    | _vide_ |
| `MAIN_IMAGE`   | Image de couverture        | _vide_ |
| `EVENTS_PATH`  | Fichier JSON d’événements  | _vide_ |
| `START_DATE`, `END_DATE` | Limites de période | _calculées_ |

Déclarez‑les dans un `.env` local ou via la ligne de commande.

---

## 5. Structure des articles

Chaque article est un Markdown avec **front‑matter** :

```markdown
---
title: "Conseil municipal de janvier"
date: "01-15-2025"   # MM-DD-YYYY
img: "conseil.jpg"   # optionnel
alt: "Réunion du conseil municipal"
draft: false         # true = ignoré par le script
---

Résumé de la séance du 15 janvier…

![image interne](interieur.jpg)

Autre paragraphe, liste, etc.
```

Le script :

- ignore les articles marqués `draft: true` ;  
- retire toutes les balises `<img>` du corps (seule l’image principale est gardée).

---

## 6. Exécution

```bash
# Méthode 1 : via Yarn
yarn generate

# Méthode 2 : directement
node generate-breves.js
```

Le terminal indique le chemin du document généré :

```
Document généré : /…/breves.html
```

---

## 7. Export en PDF

Ouvrez `breves.html` dans un navigateur :

1. **Ctrl/Cmd + P**  
2. Destination : « Enregistrer en PDF »  
3. Marges : Aucune  
4. Options : Activer l’impression des arrière‑plans

Pour l’automatisation en CI :

```bash
# Exemple avec Chromium
chromium --headless --print-to-pdf=breves.pdf breves.html
```

---

## 8. Personnaliser le template

Les fichiers EJS se trouvent dans `templates/` :

| Fichier | Rôle |
|---------|------|
| `breves_template.ejs` | squelette principal A4 |
| `main-page.ejs` | première page (titre, couverture, mot du maire) |
| `article.ejs` | mise en page d’un article |
| `event.ejs` | vignette d’événement |
| `etat-civil.ejs` | registre des naissances/mariages/décès |

La mise en page (CSS inline dans le `<style>`) est ajustable ; n’oubliez pas de **tester le rendu PDF** après modification.

---

## 9. Organisation du dépôt

```
breves-de-breux/
├── articles/            # Markdown source des articles
├── templates/           # Fichiers EJS (partials + template principal)
├── images/              # Ressources illustratives (optionnel)
├── events.json          # Événements futurs (optionnel)
├── config.json          # Configuration locale (optionnel)
├── generate-breves.js   # Script de génération
└── breves.html          # Sortie générée
```
