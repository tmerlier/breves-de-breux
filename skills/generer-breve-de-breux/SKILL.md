---
name: generer-breve-de-breux
description: >-
  Produit une édition des « Brèves de Breux » (la gazette imprimée de
  Breux-sur-Avre) en ligne de commande, sans utiliser l'interface web. Utilise
  ce skill dès que l'utilisateur veut générer, préparer, monter ou produire une
  brève / un numéro / une gazette / un bulletin communal de Breux, fabriquer le
  breves.html à imprimer, ou rassembler les articles d'une période dans le
  journal — même s'il ne dit pas explicitement « skill » ou « CLI ». Le skill
  demande le mot du maire, la période des articles et l'état civil
  (naissances / décès / nouveaux arrivants), génère le document, puis adapte
  chaque article pour l'impression papier (liens web trop longs, renvois
  « cliquez ici », tournures datées) avant la version finale.
---

# Générer une Brève de Breux (CLI, sans interface web)

## Ce que tu produis

Le fichier `breves.html` à la racine du repo : un document A4 prêt à être
exporté en PDF via le dialogue d'impression du navigateur. Tu t'appuies sur le
pipeline CLI existant (`generate-breves.js` + `templates/`), **jamais** sur le
serveur web (`yarn start`) ni sur l'API.

Travaille toujours depuis la racine du repo `breves-de-breux`.

## Pourquoi un dossier de travail (à comprendre avant de commencer)

Les articles sources vivent dans un **repo voisin** (`ARTICLES_DIR` du `.env`,
typiquement `../breux-sur-avre/contents/articles`) et sont **aussi le contenu du
site web**. Deux conséquences :

1. Ce sont des fichiers **`.mdx`** (HTML inline), alors que le pipeline natif ne
   charge que les `.md`. Le script de préparation copie donc les articles
   retenus en `.md` dans un dossier de travail local `.breve-travail/articles/`.
2. Les adaptations « papier » (raccourcir une URL, retirer un « voir la vidéo
   ci-dessous »…) n'ont de sens que pour l'imprimé, pas pour le site. **On édite
   donc les copies du dossier de travail, jamais les sources.** Le site reste
   intact.

## Déroulé

### 1. Rassembler les informations auprès de l'utilisateur

Demande (et ne suppose rien — ces éléments changent à chaque numéro) :

- **Période des articles** : `startDate` et `endDate` au format **`MM-DD-YYYY`**.
  Les articles dont la date tombe dans `[startDate, endDate]` seront inclus.
- **Date de parution prévue** de ce numéro (distribution papier). Elle te sert
  de repère pour juger ce qui est devenu daté/obsolète (« le mois prochain », un
  évènement déjà passé…). Elle ne va pas dans la config, c'est ta référence pour
  l'étape 4.
- **Mot du maire** : texte libre. Les sauts de ligne (`\n`) sont conservés.
- **État civil**, trois listes (chacune peut être vide) :
  - `naissances` : `[{ "nom": "...", "date": "MM-DD-YYYY" }]`
  - `deces` : `[{ "nom": "...", "date": "MM-DD-YYYY" }]`
  - `arrivants` : `["Prénom Nom", "Famille Untel", ...]` (simples chaînes)
- *(Optionnel)* `rappels` : `[{ "titre": "...", "contenu": "..." }]`, et
  `mainImage` (URL de l'image de couverture ; si vide, la valeur `MAIN_IMAGE` du
  `.env` est utilisée).

Si l'utilisateur n'est pas sûr de la période, propose de lister d'abord les
articles disponibles : lance l'étape 2 avec une fourchette large, montre la
liste retournée, puis affine avec lui.

### 2. Préparer l'édition (sélection des articles + config)

Écris les réponses dans un payload JSON temporaire, puis lance le script de
préparation. Il sélectionne les articles, les copie (en `.md`) dans le dossier
de travail, réécrit les chemins d'images pour qu'elles s'affichent dans un HTML
ouvert directement, et écrit `config.json`.

```bash
cat > /tmp/breve-payload.json <<'JSON'
{
  "startDate": "01-03-2025",
  "endDate": "10-31-2025",
  "mayorMessage": "Chères Bréoliennes, chers Bréoliens,\n\n...\n\nAlexandre Pourvu",
  "mainImage": "",
  "etatCivil": {
    "naissances": [{ "nom": "Orion Merlière", "date": "08-22-2025" }],
    "deces":      [{ "nom": "Jacques Perrin", "date": "09-11-2025" }],
    "arrivants":  ["Delphine Berland", "Anne-Barbara Nicco et Xavier Akoka"]
  },
  "rappels": []
}
JSON

node skills/generer-breve-de-breux/scripts/preparer-breve.js /tmp/breve-payload.json
```

Le script renvoie un résumé JSON : la liste des articles retenus (`file`,
`title`, `date`) et, pour chacun, `urlCount` / `longUrl` qui signalent les
articles contenant des URLs (candidats prioritaires à l'adaptation papier).
**Montre cette liste à l'utilisateur et fais-la valider** avant de continuer —
c'est le bon moment pour ajouter/retirer un article en ajustant la période.

### 3. Première génération

```bash
ARTICLES_DIR=.breve-travail/articles IMAGES_PATH= node generate-breves.js
```

`ARTICLES_DIR` pointe sur le dossier de travail ; `IMAGES_PATH=` (vide)
neutralise le préfixage car les chemins d'images ont déjà été réécrits. Les
évènements à venir (après `endDate`) sont chargés automatiquement depuis
`EVENTS_PATH`. Le résultat est `breves.html`.

### 4. Adapter chaque article pour l'impression papier (l'étape clé)

Le contenu a été rédigé pour le **web** ; il part maintenant sur du **papier**.
Relis le contenu de **chaque** fichier de `.breve-travail/articles/*.md` et
corrige ce qui n'a plus de sens une fois imprimé. Édite **uniquement ces copies**,
jamais les sources. Concentre-toi sur :

- **URLs longues / liens hypertexte.** Un lien cliquable n'existe pas sur papier,
  et une URL à rallonge (`https://forms.office.com/Pages/ResponsePage.aspx?id=…`)
  est illisible et inutile. Remplace `<a href="…">texte</a>` par le **texte seul**
  s'il se suffit, ou par une formulation papier : un domaine court lisible
  (`inse27.fr`, rubrique « réserver mon composteur »), « formulaire disponible en
  mairie / sur le site de la commune », etc. Supprime les URLs interminables
  qu'on ne saurait recopier à la main.
- **Renvois propres au web** : « cliquez ici », « voir la vidéo ci-dessous », « le
  lien ci-dessous », « en cliquant sur le bouton »… Reformule pour le papier ou
  retire, puisque l'élément référencé n'est pas là.
- **Fraîcheur temporelle**, jugée par rapport à la **date de parution** fournie à
  l'étape 1 : « prochainement », « la semaine prochaine », « le 15 mars prochain »,
  une inscription dont la date butoir est passée, un évènement annoncé qui a déjà
  eu lieu. Mets au passé, actualise, ou retire le passage devenu caduc — sans
  trahir le sens de l'article.
- **Restes de balises non rendues** : composants MDX/JSX éventuels (`<Image …>`,
  `<Video>`, `<Newsletter/>`…) qui ne s'afficheront pas en HTML simple. Remplace
  par du texte/HTML standard ou supprime.
- **Longueur**. Le gabarit gère les sauts de page mais un article très verbeux
  casse la mise en page. Si un article déborde manifestement, resserre les
  passages les plus accessoires.

Garde les retouches **minimales et fidèles** : tu adaptes au support, tu ne
réécris pas l'article. En cas de doute sur un retrait qui change le fond,
signale-le à l'utilisateur plutôt que de trancher seul.

### 5. Régénérer et livrer

Relance exactement la commande de l'étape 3 pour reconstruire `breves.html` avec
les articles adaptés :

```bash
ARTICLES_DIR=.breve-travail/articles IMAGES_PATH= node generate-breves.js
```

Puis :

- Récapitule à l'utilisateur les adaptations faites article par article (ex.
  « Séjours d'été : URL Office 365 remplacée par “formulaire en mairie” »).
- Indique que le document est prêt : ouvrir `breves.html` dans un navigateur,
  puis **Imprimer → Enregistrer en PDF**, format A4, pour obtenir la gazette.

## Repères utiles

- **Formats de date** : articles et `config.json` en `MM-DD-YYYY` ; les
  évènements (`events.json`) sont en ISO `YYYY-MM-DD` et filtrés automatiquement,
  tu n'y touches pas.
- **Régénérer seulement** (après une retouche manuelle d'article ou de config) :
  la commande de l'étape 3 suffit, tant que `.breve-travail/` existe.
- **Repartir de zéro** : relance le script de préparation (étape 2) — il vide et
  recrée le dossier de travail.
- Le script et la génération s'attendent à un `.env` configuré (`ARTICLES_DIR`,
  `EVENTS_PATH`, `MAIN_IMAGE`…). Si `ARTICLES_DIR` est vide ou faux, le script le
  signale ; oriente alors l'utilisateur vers son `.env`.
