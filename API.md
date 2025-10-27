# 📡 Documentation de l'API

L'application expose plusieurs endpoints REST pour gérer la configuration et la génération des Brèves.

## Base URL

```
http://localhost:3000/api
```

---

## 📝 Articles

### GET `/api/articles`

Récupère la liste des articles depuis le dossier `articles/`.

**Paramètres de requête (optionnels)** :
- `startDate` (string) : Date de début au format `MM-DD-YYYY`
- `endDate` (string) : Date de fin au format `MM-DD-YYYY`

**Réponse** :
```json
[
  {
    "id": "exemple-article.md",
    "title": "Titre de l'article",
    "date": "2025-01-15T00:00:00.000Z",
    "dateStr": "01-15-2025",
    "content": "Contenu en Markdown...",
    "img": "url-image.jpg",
    "alt": "Description",
    "draft": false
  }
]
```

**Exemple** :
```bash
curl "http://localhost:3000/api/articles?startDate=01-01-2025&endDate=12-31-2025"
```

---

## ⚙️ Configuration

### GET `/api/config`

Récupère la configuration actuelle depuis `config.json`.

**Réponse** :
```json
{
  "startDate": "01-01-2025",
  "endDate": "12-31-2025",
  "mainImage": "https://exemple.com/image.jpg",
  "mayorMessage": "Message du maire...",
  "etatCivil": {
    "naissances": [],
    "deces": [
      {
        "nom": "Nom complet",
        "date": "01-15-2025"
      }
    ],
    "arrivants": [
      "Monsieur et Madame Dupont à la Haute-Folie"
    ]
  }
}
```

**Exemple** :
```bash
curl http://localhost:3000/api/config
```

---

### POST `/api/config`

Sauvegarde la configuration dans `config.json`.

**Body** :
```json
{
  "startDate": "01-01-2025",
  "endDate": "12-31-2025",
  "mainImage": "https://exemple.com/image.jpg",
  "mayorMessage": "Message du maire...",
  "etatCivil": {
    "naissances": [],
    "deces": [],
    "arrivants": []
  }
}
```

**Réponse** :
```json
{
  "success": true
}
```

**Exemple** :
```bash
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{"startDate":"01-01-2025","endDate":"12-31-2025"}'
```

---

## 🖼️ Upload d'image

### POST `/api/upload`

Upload une image sur le serveur.

**Content-Type** : `multipart/form-data`

**Champ** : `image` (fichier)

**Réponse** :
```json
{
  "url": "/uploads/1234567890-image.jpg"
}
```

**Exemple avec curl** :
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "image=@/chemin/vers/image.jpg"
```

**Exemple avec JavaScript** :
```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);

fetch('/api/upload', {
  method: 'POST',
  body: formData
})
.then(res => res.json())
.then(data => console.log(data.url));
```

---

## 👁️ Prévisualisation

### POST `/api/preview`

Génère une prévisualisation HTML du document.

**Body** :
```json
{
  "config": {
    "startDate": "01-01-2025",
    "endDate": "12-31-2025",
    "mainImage": "url-image.jpg",
    "mayorMessage": "Message...",
    "etatCivil": { ... }
  },
  "selectedArticles": [
    {
      "id": "article1.md",
      "title": "Titre",
      "date": "2025-01-15T00:00:00.000Z",
      "content": "Contenu...",
      "img": "image.jpg",
      "alt": "Description"
    }
  ]
}
```

**Réponse** : HTML complet du document

**Content-Type** : `text/html`

**Exemple** :
```javascript
fetch('/api/preview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ config, selectedArticles })
})
.then(res => res.text())
.then(html => {
  document.getElementById('preview').innerHTML = html;
});
```

---

## 📄 Génération finale

### POST `/api/generate`

Génère le fichier final `breves.html`.

**Body** : Même structure que `/api/preview`

**Réponse** :
```json
{
  "success": true,
  "file": "/chemin/absolu/vers/breves.html"
}
```

**Exemple** :
```javascript
fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ config, selectedArticles })
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    window.open('/breves.html', '_blank');
  }
});
```

---

## 📁 Fichiers statiques

### GET `/uploads/:filename`

Accès aux images uploadées.

**Exemple** :
```
http://localhost:3000/uploads/1234567890-image.jpg
```

### GET `/breves.html`

Accès au document généré.

**Exemple** :
```
http://localhost:3000/breves.html
```

---

## 🔒 Codes d'erreur

| Code | Description |
|------|-------------|
| 200  | Succès |
| 400  | Requête invalide (ex: fichier manquant) |
| 500  | Erreur serveur |

**Exemple de réponse d'erreur** :
```json
{
  "error": "Description de l'erreur"
}
```

---

## 💡 Exemples d'utilisation

### Workflow complet

```javascript
// 1. Charger les articles
const articles = await fetch('/api/articles?startDate=01-01-2025').then(r => r.json());

// 2. Charger la config
const config = await fetch('/api/config').then(r => r.json());

// 3. Modifier et sauvegarder
config.mayorMessage = "Nouveau message";
await fetch('/api/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(config)
});

// 4. Générer la prévisualisation
const selectedArticles = articles.filter(a => !a.draft);
const preview = await fetch('/api/preview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ config, selectedArticles })
}).then(r => r.text());

// 5. Générer le fichier final
const result = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ config, selectedArticles })
}).then(r => r.json());
```

### Upload d'image

```javascript
async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  
  const data = await response.json();
  return data.url; // "/uploads/12345-image.jpg"
}
```
