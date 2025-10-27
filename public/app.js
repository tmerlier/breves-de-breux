// État global de l'application
let state = {
  config: {
    startDate: null,
    endDate: null,
    mainImage: '',
    mayorMessage: '',
    etatCivil: {
      naissances: [],
      deces: [],
      arrivants: []
    }
  },
  articles: [],
  selectedArticleIds: new Set()
};

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig(); // Charger d'abord la config pour avoir les dates
  await loadArticles(); // Puis charger les articles avec les bonnes dates
  
  // Message initial dans l'iframe
  const previewFrame = document.getElementById('previewFrame');
  const doc = previewFrame.contentDocument || previewFrame.contentWindow.document;
  doc.open();
  doc.write(`
    <html>
      <head>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0; 
            background: #f9fafb;
          }
          .message {
            text-align: center;
            color: #6b7280;
          }
          h2 { color: #1a365d; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="message">
          <h2>📰 Prévisualisation</h2>
          <p>Configurez les paramètres et cliquez sur<br>"Actualiser la prévisualisation"</p>
        </div>
      </body>
    </html>
  `);
  doc.close();
});

// Charger la configuration existante
async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    state.config = config;
    
    // Remplir les champs
    if (config.startDate) {
      document.getElementById('startDate').value = convertToInputDate(config.startDate);
    }
    if (config.endDate) {
      document.getElementById('endDate').value = convertToInputDate(config.endDate);
    }
    if (config.mainImage) {
      document.getElementById('mainImageUrl').value = config.mainImage;
      updateMainImagePreview();
    }
    if (config.mayorMessage) {
      document.getElementById('mayorMessage').value = config.mayorMessage;
    }
    
    // État civil
    if (config.etatCivil) {
      if (config.etatCivil.naissances) {
        config.etatCivil.naissances.forEach(naissance => {
          addNaissance(naissance.nom, naissance.date);
        });
      }
      if (config.etatCivil.deces) {
        config.etatCivil.deces.forEach(deces => {
          addDeces(deces.nom, deces.date);
        });
      }
      if (config.etatCivil.arrivants) {
        config.etatCivil.arrivants.forEach(arrivant => {
          addArrivant(arrivant);
        });
      }
    }
  } catch (error) {
    console.error('Erreur chargement config:', error);
  }
}

// Convertir date MM-DD-YYYY en YYYY-MM-DD pour input date
function convertToInputDate(dateStr) {
  if (!dateStr) return '';
  const [month, day, year] = dateStr.split('-');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Convertir date YYYY-MM-DD en MM-DD-YYYY
function convertFromInputDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-');
  return `${month}-${day}-${year}`;
}

// Charger les articles
async function loadArticles() {
  try {
    const startDate = convertFromInputDate(document.getElementById('startDate').value);
    const endDate = convertFromInputDate(document.getElementById('endDate').value);
    
    let url = '/api/articles';
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    if (params.toString()) {
      url += '?' + params.toString();
    }
    
    const response = await fetch(url);
    state.articles = await response.json();
    
    renderArticlesList();
  } catch (error) {
    console.error('Erreur chargement articles:', error);
  }
}

// Afficher la liste des articles
function renderArticlesList() {
  const container = document.getElementById('articlesList');
  
  if (state.articles.length === 0) {
    container.innerHTML = '<p style="color: #6b7280; font-size: 0.9rem; padding: 10px;">Aucun article trouvé pour cette période.</p>';
    return;
  }
  
  container.innerHTML = state.articles.map(article => {
    const isSelected = state.selectedArticleIds.has(article.id);
    const isDraft = article.draft;
    const checked = isSelected || (!isDraft && state.selectedArticleIds.size === 0);
    
    // Auto-sélection si pas encore de sélection manuelle
    if (checked && state.selectedArticleIds.size === 0 && !isDraft) {
      state.selectedArticleIds.add(article.id);
    }
    
    const dateFormatted = new Date(article.date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    return `
      <div class="article-item ${checked ? 'selected' : ''}" onclick="toggleArticle('${article.id}')">
        <input type="checkbox" ${checked ? 'checked' : ''} onclick="event.stopPropagation(); toggleArticle('${article.id}')">
        <div class="article-info">
          <div class="article-title">${article.title}${isDraft ? ' (brouillon)' : ''}</div>
          <div class="article-date">${dateFormatted}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Toggle sélection d'un article
function toggleArticle(articleId) {
  if (state.selectedArticleIds.has(articleId)) {
    state.selectedArticleIds.delete(articleId);
  } else {
    state.selectedArticleIds.add(articleId);
  }
  renderArticlesList();
}

// Upload image principale
async function uploadMainImage() {
  const fileInput = document.getElementById('mainImageFile');
  const file = fileInput.files[0];
  
  if (!file) return;
  
  const formData = new FormData();
  formData.append('image', file);
  
  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.url) {
      const fullUrl = window.location.origin + data.url;
      document.getElementById('mainImageUrl').value = fullUrl;
      state.config.mainImage = fullUrl;
      updateMainImagePreview();
    }
  } catch (error) {
    console.error('Erreur upload image:', error);
    alert('Erreur lors de l\'upload de l\'image');
  }
}

// Mettre à jour l'aperçu de l'image principale
function updateMainImagePreview() {
  const url = document.getElementById('mainImageUrl').value;
  const preview = document.getElementById('mainImagePreview');
  
  if (url) {
    preview.src = url;
    preview.classList.remove('hidden');
    state.config.mainImage = url;
  } else {
    preview.classList.add('hidden');
  }
}

// Ajouter une naissance
function addNaissance(nom = '', date = '') {
  const container = document.getElementById('naissancesList');
  const id = Date.now();
  
  const div = document.createElement('div');
  div.className = 'etat-civil-item';
  div.id = `naissance-${id}`;
  div.innerHTML = `
    <input type="text" placeholder="Nom complet" value="${nom}" onchange="updateNaissances()">
    <input type="date" value="${convertToInputDate(date)}" onchange="updateNaissances()">
    <button class="btn-remove" onclick="removeNaissance('${id}')">✕</button>
  `;
  
  container.appendChild(div);
}

// Supprimer une naissance
function removeNaissance(id) {
  const element = document.getElementById(`naissance-${id}`);
  if (element) {
    element.remove();
    updateNaissances();
  }
}

// Mettre à jour les naissances
function updateNaissances() {
  const container = document.getElementById('naissancesList');
  const items = container.querySelectorAll('.etat-civil-item');
  
  state.config.etatCivil.naissances = Array.from(items).map(item => {
    const inputs = item.querySelectorAll('input');
    return {
      nom: inputs[0].value,
      date: convertFromInputDate(inputs[1].value)
    };
  }).filter(item => item.nom && item.date);
}

// Ajouter un décès
function addDeces(nom = '', date = '') {
  const container = document.getElementById('decesList');
  const id = Date.now();
  
  const div = document.createElement('div');
  div.className = 'etat-civil-item';
  div.id = `deces-${id}`;
  div.innerHTML = `
    <input type="text" placeholder="Nom complet" value="${nom}" onchange="updateDeces()">
    <input type="date" value="${convertToInputDate(date)}" onchange="updateDeces()">
    <button class="btn-remove" onclick="removeDeces('${id}')">✕</button>
  `;
  
  container.appendChild(div);
}

// Supprimer un décès
function removeDeces(id) {
  const element = document.getElementById(`deces-${id}`);
  if (element) {
    element.remove();
    updateDeces();
  }
}

// Mettre à jour les décès
function updateDeces() {
  const container = document.getElementById('decesList');
  const items = container.querySelectorAll('.etat-civil-item');
  
  state.config.etatCivil.deces = Array.from(items).map(item => {
    const inputs = item.querySelectorAll('input');
    return {
      nom: inputs[0].value,
      date: convertFromInputDate(inputs[1].value)
    };
  }).filter(item => item.nom && item.date);
}

// Ajouter un arrivant
function addArrivant(text = '') {
  const container = document.getElementById('arrivantsList');
  const id = Date.now();
  
  const div = document.createElement('div');
  div.className = 'etat-civil-item';
  div.id = `arrivant-${id}`;
  div.innerHTML = `
    <input type="text" placeholder="Nom(s) et adresse" value="${text}" onchange="updateArrivants()">
    <button class="btn-remove" onclick="removeArrivant('${id}')">✕</button>
  `;
  
  container.appendChild(div);
}

// Supprimer un arrivant
function removeArrivant(id) {
  const element = document.getElementById(`arrivant-${id}`);
  if (element) {
    element.remove();
    updateArrivants();
  }
}

// Mettre à jour les arrivants
function updateArrivants() {
  const container = document.getElementById('arrivantsList');
  const items = container.querySelectorAll('.etat-civil-item');
  
  state.config.etatCivil.arrivants = Array.from(items)
    .map(item => item.querySelector('input').value)
    .filter(text => text.trim() !== '');
}

// Récupérer la configuration actuelle
function getCurrentConfig() {
  return {
    startDate: convertFromInputDate(document.getElementById('startDate').value),
    endDate: convertFromInputDate(document.getElementById('endDate').value),
    mainImage: document.getElementById('mainImageUrl').value,
    mayorMessage: document.getElementById('mayorMessage').value,
    etatCivil: state.config.etatCivil
  };
}

// Récupérer les articles sélectionnés
function getSelectedArticles() {
  return state.articles.filter(article => state.selectedArticleIds.has(article.id));
}

// Actualiser la prévisualisation
async function updatePreview() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  const previewFrame = document.getElementById('previewFrame');
  
  try {
    loadingIndicator.classList.add('active');
    
    // Sauvegarder la config
    const config = getCurrentConfig();
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    // Générer la prévisualisation
    const selectedArticles = getSelectedArticles();
    
    if (selectedArticles.length === 0) {
      const doc = previewFrame.contentDocument || previewFrame.contentWindow.document;
      doc.open();
      doc.write('<div style="padding: 40px; text-align: center; color: #6b7280; font-family: sans-serif;"><h2>Aucun article sélectionné</h2><p style="margin-top: 10px;">Veuillez sélectionner au moins un article</p></div>');
      doc.close();
      return;
    }
    
    const response = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, selectedArticles })
    });
    
    const html = await response.text();
    
    // Injecter le HTML dans l'iframe
    const doc = previewFrame.contentDocument || previewFrame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    
  } catch (error) {
    console.error('Erreur prévisualisation:', error);
    alert('Erreur lors de la génération de la prévisualisation');
  } finally {
    loadingIndicator.classList.remove('active');
  }
}

// Générer le fichier final et ouvrir pour impression
async function generateFinal() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  
  try {
    loadingIndicator.classList.add('active');
    
    const config = getCurrentConfig();
    const selectedArticles = getSelectedArticles();
    
    if (selectedArticles.length === 0) {
      alert('Veuillez sélectionner au moins un article');
      return;
    }
    
    // Ouvrir la fenêtre AVANT la requête async pour éviter le blocage de pop-up
    const printWindow = window.open('about:blank', '_blank');
    
    // Sauvegarder la config
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    // Générer le fichier
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, selectedArticles })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Rediriger la fenêtre déjà ouverte vers le fichier généré
      if (printWindow) {
        printWindow.location.href = '/breves.html';
        alert('Document généré avec succès ! Une nouvelle fenêtre s\'est ouverte pour l\'impression.');
      } else {
        alert('Document généré avec succès !\n\nVeuillez autoriser les pop-ups pour ce site.\nVous pouvez accéder au document via ce lien : ' + window.location.origin + '/breves.html');
      }
    } else {
      if (printWindow) printWindow.close();
      alert('Erreur lors de la génération du document');
    }
    
  } catch (error) {
    console.error('Erreur génération finale:', error);
    alert('Erreur lors de la génération du document');
  } finally {
    loadingIndicator.classList.remove('active');
  }
}
