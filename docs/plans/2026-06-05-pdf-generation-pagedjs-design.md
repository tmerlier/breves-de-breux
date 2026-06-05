# Génération PDF fiable via Paged.js + Puppeteer

**Date :** 2026-06-05
**Statut :** validé, prêt pour planification d'implémentation

## Problème

La gazette *Les Brèves de Breux* (« le 4 pages ») est composée via l'app web
(sélection d'articles/événements du site, édito du maire, état civil) puis
imprimée pour distribution en boîtes aux lettres. Aujourd'hui le PDF est produit
par **l'impression du navigateur** (Cmd-P → Enregistrer en PDF). Ce procédé est
intrinsèquement instable pour la pagination print :

- des paragraphes sont coupés en plein milieu au saut de page ;
- des sections entières **disparaissent du PDF** alors qu'elles s'affichent à
  l'écran (constaté sur le « Calendrier des Événements ») ;
- la prévisualisation à l'écran ne correspond jamais au résultat imprimé.

La cause racine n'est pas un bug CSS isolé mais la dépendance au moteur
d'impression du navigateur.

## Objectif de cette itération

**Fiabiliser la génération PDF dans l'app Express actuelle**, avec une preview
fidèle à 100 % au résultat imprimé, tout en gardant le cœur de rendu
**extractible** vers une future intégration dans l'admin du site commune
(`../breux-sur-avre`, Next.js 15 sur Vercel, contenu Airtable/Supabase).

Choix d'ampleur : *fiabiliser maintenant, intégrer plus tard*. On ne résout pas
encore les contraintes Chromium-sur-Vercel ; on isole la brique PDF pour qu'elle
soit la seule à réécrire lors de l'intégration serverless.

## Approche retenue : Paged.js + Puppeteer

Même moteur de pagination des deux côtés → preview = PDF.

- **Paged.js** (implémente le standard CSS Paged Media) tourne **dans le
  navigateur** pour paginer la preview en vraies pages A4.
- **Puppeteer (Chrome headless)** charge le même HTML côté serveur, attend la fin
  de pagination Paged.js, puis produit le PDF. Plus aucune manip d'impression
  navigateur.
- Le contenu **déborde proprement** sur la page suivante au lieu d'être rogné.

Alternatives écartées :
- *Durcir le CSS de l'impression navigateur* : ne donnera jamais preview =
  print, fiabilité aléatoire selon le navigateur.
- *Réécriture en react-pdf* : natif serverless (utile pour Vercel plus tard) mais
  impose de réécrire tout le contenu en composants et gère mal le Markdown des
  articles. À réserver éventuellement à la phase d'intégration Next.js.

## Architecture & flux

```
lib/render.js   → produit le HTML (inchangé sur le fond) ── source de vérité
templates/*.ejs → CSS print refait pour Paged.js + script Paged.js inclus
lib/pdf.js      → NOUVEAU : wrapper Puppeteer (HTML servi → PDF)  ← brique isolée
server.js       → /api/preview (inchangé) + /api/generate (réécrit → breves.pdf)
public/app.js   → preview iframe paginée + génération PDF
```

**Flux de génération PDF :**
1. `renderBreves()` → HTML (Paged.js inclus) → écrit `breves.html` (page source
   servie en HTTP).
2. `lib/pdf.js` lance Puppeteer, **navigue vers
   `http://localhost:PORT/breves.html`** (pas de `setContent`) → les montages
   `/uploads` et `/images` résolvent nativement.
3. Puppeteer attend la fin de pagination Paged.js, puis `page.pdf()` →
   `breves.pdf`.
4. La route répond avec l'URL du PDF à télécharger.

**Extractibilité Next.js :** `lib/render.js` (HTML pur) et `lib/pdf.js`
(HTML→PDF) sont découplés. Plus tard, le Next.js réutilise `render` tel quel et
remplace uniquement la brique PDF (Chromium serverless type `@sparticuz/chromium`
ou microservice dédié).

## Changements template & CSS (Paged.js)

- **`@page` au niveau racine** (et non dans `@media print`) :
  `@page { size: A4; margin: 15mm; }`.
- **`break-inside: avoid` uniquement sur les blocs atomiques** : `.article`
  (court), `.event-card`, `.rappel-card`, entrées d'état civil. **Jamais sur les
  conteneurs de section** (cause de la disparition du calendrier).
- **`break-before: always`** conservé sur `.calendar-section`.
- **Suppression du script `optimizeArticleBreaks`** (mesure de hauteurs au
  chargement) : rendu inutile par la fragmentation native de Paged.js.
- **Paged.js en dépendance npm locale** (`pagedjs`), servi en statique par l'app
  (pas de CDN — fonctionne hors-ligne, version verrouillée).
- **Pas d'entêtes/pieds de page** : on reste minimal, design inchangé.

## Backend

**Nouveau `lib/pdf.js`** — `async generatePdf({ url, outputPath })` :
1. `puppeteer.launch()` (headless), **à la demande** par génération (gazette
   semestrielle, pas de navigateur chaud à maintenir).
2. `page.goto(url, { waitUntil: 'networkidle0' })`.
3. `page.waitForFunction(...)` jusqu'à fin de pagination Paged.js.
4. `page.pdf({ path: outputPath, printBackground: true, preferCSSPageSize: true,
   margin: 0 })` (Paged.js gère déjà les marges `@page`).
5. `browser.close()` dans un `finally`.

**`/api/generate` réécrit** : rend le HTML → écrit `breves.html` → appelle
`generatePdf` → répond `{ success, url: '/breves.pdf' }`. **Nouvelle route
`GET /breves.pdf`** pour le téléchargement.

**CLI `generate-breves.js`** : reste HTML-only (chemin legacy). La génération PDF
fiable passe par l'app web. Noté pour éviter la divergence.

## Frontend

- **Preview** : `/api/preview` renvoie déjà le HTML ; comme il inclut Paged.js,
  l'iframe affiche directement les pages A4 paginées = exactement le futur PDF.
- **Bouton « Générer le PDF »** : appelle `/api/generate`, affiche un état de
  chargement, puis ouvre/propose le téléchargement de `/breves.pdf`.
- **(Optionnel) Rafraîchissement à chaud** : re-render automatique de la preview
  à chaque modification du formulaire (appel `/api/preview` *debounced* ~500 ms),
  plutôt qu'un clic manuel. À implémenter si le coût de re-pagination Paged.js
  reste fluide ; sinon garder le bouton.

## Dépendances, risques & vérification

- **Dépendances ajoutées** : `puppeteer` (embarque Chromium, serveur uniquement)
  + `pagedjs`.
- **Images** : en HTTP servi, garantir des `src` **racine-relatifs**
  (`/uploads/x.jpg`) plutôt que `./uploads/...` → petit ajustement de
  `toPrintableImageSrc`.
- **Vercel reporté volontairement** : seule `lib/pdf.js` sera à réécrire pour le
  serverless.
- **Vérification** (pas de tests auto dans ce projet) : visuelle — générer avec
  articles + événements + état civil, ouvrir `breves.pdf`, confirmer la présence
  du calendrier et l'absence de paragraphes coupés ; comparer preview iframe et
  PDF (doivent être identiques).
