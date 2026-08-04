/* =========================================================
   PrecoTech237 — Espace administrateur (branché sur Supabase)
   ---------------------------------------------------------
   Authentification : vrai compte Supabase Auth (e-mail + mot de
   passe), créé depuis Supabase > Authentication > Users > Add user.
   La session est gérée automatiquement par supabaseClient (jeton
   stocké de façon sécurisée, envoyé à chaque requête). Les règles
   de sécurité réelles sont définies côté Supabase dans
   supabase-migration-auth.sql — c'est cette configuration côté
   serveur qui protège vos données, pas ce fichier.
   ========================================================= */

let adminProducts = [];
let adminContact = {};
let adminTransportModes = [];
let editingProductId = null;
let currentProductImages = [];
let currentUploadFolder = '';
let currentVariantes = [];

/* ---------- Chargement depuis Supabase ---------- */
async function loadAdminData(){
  const { data: products, error: prodErr } = await supabaseClient
    .from('products').select('*').order('created_at', { ascending: true });
  if (prodErr){ alert('Erreur de chargement des produits : ' + prodErr.message); return; }
  adminProducts = (products || []).map(mapDbProduct);

  const { data: settings, error: setErr } = await supabaseClient
    .from('site_settings').select('*').in('key', ['contact', 'transport_modes']);
  if (!setErr && settings){
    settings.forEach(function(row){
      if (row.key === 'contact') adminContact = row.value;
      if (row.key === 'transport_modes') adminTransportModes = row.value;
    });
  }
}

/* ---------- Connexion / déconnexion (Supabase Auth) ---------- */
document.addEventListener('DOMContentLoaded', async function(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session){ showAdminApp(); }

  document.getElementById('lock-form').addEventListener('submit', async function(e){
    e.preventDefault();
    const email = document.getElementById('lock-email').value.trim();
    const password = document.getElementById('lock-password').value;
    const errorEl = document.getElementById('lock-error');
    const submitBtn = document.getElementById('lock-submit');

    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Connexion...';

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Se connecter';

    if (error){
      errorEl.textContent = 'Connexion impossible : e-mail ou mot de passe incorrect.';
      errorEl.style.display = 'block';
      return;
    }
    showAdminApp();
  });

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn){
    logoutBtn.addEventListener('click', async function(){
      await supabaseClient.auth.signOut();
      window.location.reload();
    });
  }
});

async function showAdminApp(){
  document.getElementById('lock-screen').style.display = 'none';
  document.getElementById('admin-app').style.display = 'block';
  document.getElementById('product-tbody').innerHTML = '<tr><td colspan="5">Chargement depuis la base de données...</td></tr>';

  await loadAdminData();
  renderProductTable();
  fillContactForm();
  bindContactForm();
  fillTransportForm();
  bindTransportForm();
  await loadReviewsAdmin();
  renderReviewTable();
  await loadOrdersAdmin();
  renderOrderTable();
  bindOrderFilter();
  initTabs();
  initModal();
  initOrderModal();
  bindBulkImportForm();
  bindBulkPhotoAssociation();
  document.querySelectorAll('[data-icon]').forEach(function(el){
    const name = el.getAttribute('data-icon');
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });
}

/* ---------- Onglets ---------- */
function initTabs(){
  const buttons = document.querySelectorAll('.admin-tabs button');
  buttons.forEach(function(btn){
    btn.addEventListener('click', function(){
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
      document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';
    });
  });
}

/* ---------- Tableau produits ---------- */
function renderProductTable(){
  const tbody = document.getElementById('product-tbody');
  document.getElementById('product-count').textContent = adminProducts.length;

  if (!adminProducts.length){
    tbody.innerHTML = '<tr><td colspan="6">Aucun produit pour le moment. Cliquez sur « Ajouter un produit ».</td></tr>';
    return;
  }

  const catLabels = { 'laptops':'Laptops', 'pc-gaming':'PC Gaming', 'telephones':'Téléphones' };

  tbody.innerHTML = adminProducts.map(function(p){
    const poidsVol = p.poidsKg
      ? `${p.poidsKg} kg${(p.longueurCm && p.largeurCm && p.hauteurCm) ? ` · ${calcCBM(p).toFixed(3)} CBM` : ''}`
      : '—';
    return `<tr>
      <td data-label="Produit"><b>${escapeHtml(p.nom)}</b></td>
      <td data-label="Catégorie">${catLabels[p.categorie] || p.categorie}</td>
      <td data-label="Prix">${Number(p.prix).toLocaleString('fr-FR')} FCFA</td>
      <td data-label="Poids / Volume">${poidsVol}</td>
      <td data-label="Badge">${p.badge ? escapeHtml(p.badge) : '—'}</td>
      <td data-label="Actions">
        <div class="row-actions">
          <button class="edit" data-action="edit" data-id="${p.id}">Modifier</button>
          <button class="danger" data-action="delete" data-id="${p.id}">Supprimer</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-action="edit"]').forEach(function(btn){
    btn.addEventListener('click', function(){ openProductModal(btn.dataset.id); });
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach(function(btn){
    btn.addEventListener('click', function(){ deleteProduct(btn.dataset.id); });
  });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function deleteProduct(id){
  const product = adminProducts.find(p => p.id === id);
  if (!confirm(`Supprimer « ${product ? product.nom : id} » du catalogue ? Cette action est immédiate et visible par tous vos clients.`)) return;

  const { error } = await supabaseClient.from('products').delete().eq('id', id);
  if (error){ alert('Erreur lors de la suppression : ' + error.message); return; }

  adminProducts = adminProducts.filter(p => p.id !== id);
  renderProductTable();
}

/* ---------- Modale produit (ajout / modification) ---------- */
function initModal(){
  document.getElementById('btn-new-product').addEventListener('click', function(){ openProductModal(null); });
  document.getElementById('btn-cancel-product').addEventListener('click', closeProductModal);
  document.getElementById('btn-add-spec').addEventListener('click', function(){ addSpecRow('', ''); });
  document.getElementById('btn-add-option-group').addEventListener('click', function(){ addOptionGroupRow('', ''); });
  document.getElementById('btn-generate-variants').addEventListener('click', renderVariantsTable);
  document.getElementById('product-form').addEventListener('submit', submitProductForm);
  bindMediaUploads();
  bindCategorySelect();

  document.getElementById('product-modal').addEventListener('click', function(e){
    if (e.target === this) closeProductModal();
  });
}

/* ---------- Catégories dynamiques ---------- */
const CATEGORY_LABELS_KNOWN = { 'laptops':'Laptops', 'pc-gaming':'PC Gaming', 'telephones':'Téléphones' };

function slugify(text){
  return text.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 30);
}

function getKnownCategories(){
  // Combine les catégories déjà utilisées par vos produits + les catégories "historiques"
  const map = {};
  Object.keys(CATEGORY_LABELS_KNOWN).forEach(function(k){ map[k] = CATEGORY_LABELS_KNOWN[k]; });
  adminProducts.forEach(function(p){
    if (p.categorie && !map[p.categorie]) map[p.categorie] = p.categorieLabel || p.categorie;
  });
  return map;
}

function populateCategorySelect(selectedValue){
  const sel = document.getElementById('p-categorie');
  const categories = getKnownCategories();
  let html = Object.keys(categories).map(function(key){
    return `<option value="${key}">${escapeHtml(categories[key])}</option>`;
  }).join('');
  html += `<option value="__new__">+ Nouvelle catégorie...</option>`;
  sel.innerHTML = html;

  const newInput = document.getElementById('p-categorie-nouvelle');
  if (selectedValue && categories[selectedValue]){
    sel.value = selectedValue;
    newInput.style.display = 'none';
  } else {
    sel.value = Object.keys(categories)[0] || '__new__';
    newInput.style.display = 'none';
  }
}

function bindCategorySelect(){
  document.getElementById('p-categorie').addEventListener('change', function(){
    const newInput = document.getElementById('p-categorie-nouvelle');
    if (this.value === '__new__'){
      newInput.style.display = 'block';
      newInput.focus();
    } else {
      newInput.style.display = 'none';
    }
  });
}

/* =========================================================
   Import en masse de produits (copier-coller depuis Excel/Sheets)
   ========================================================= */

// Intitulés de colonnes reconnus (accents/espaces/majuscules ignorés) -> nom de colonne interne
const BULK_FIELD_ALIASES = {
  nom:'nom', nomduproduit:'nom', produit:'nom', titre:'nom',
  categorie:'categorie', categorielabel:'categorie',
  prix:'prix', prixfcfa:'prix',
  etat:'etat',
  disponibilite:'disponibilite', stock:'disponibilite',
  badge:'badge',
  description:'description', desc:'description',
  poids:'poids_kg', poidskg:'poids_kg',
  longueur:'longueur_cm', longueurcm:'longueur_cm',
  largeur:'largeur_cm', largeurcm:'largeur_cm',
  hauteur:'hauteur_cm', hauteurcm:'hauteur_cm',
  images:'images', photos:'images', image:'images', photo:'images'
};
const BULK_ALLOWED_DISPO = ['en_stock', 'sur_commande', 'rupture'];

function bulkCompactKey(s){
  return s.toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Excel/Sheets colle avec des tabulations ; on garde ; puis , en repli (CSV export)
function bulkSplitLine(line){
  if (line.indexOf('\t') !== -1) return line.split('\t');
  if (line.indexOf(';') !== -1) return line.split(';');
  return line.split(',');
}

function bulkToNumberOrNull(v){
  if (v === undefined || v === null || v.toString().trim() === '') return null;
  const n = Number(v.toString().trim().replace(',', '.'));
  return isFinite(n) ? n : null;
}

function parseBulkInput(text){
  const lines = text.split(/\r?\n/).filter(function(l){ return l.trim() !== ''; });
  if (!lines.length) return { rows: [], error: 'Aucune donnée détectée — collez au moins une ligne d\'en-tête et une ligne de produit.' };

  const headerCells = bulkSplitLine(lines[0]);
  const fields = headerCells.map(function(h){ return BULK_FIELD_ALIASES[bulkCompactKey(h)] || null; });

  if (fields.indexOf('nom') === -1 || fields.indexOf('categorie') === -1 || fields.indexOf('prix') === -1){
    return { rows: [], error: 'Colonnes obligatoires manquantes dans l\'en-tête : il faut au moins "nom", "categorie" et "prix".' };
  }

  // Réutilise une catégorie existante si le libellé tapé correspond à une catégorie déjà en base
  const knownCategories = getKnownCategories(); // { slug: label }
  const labelToSlug = {};
  Object.keys(knownCategories).forEach(function(slug){
    labelToSlug[bulkCompactKey(knownCategories[slug])] = slug;
  });

  const rows = lines.slice(1).map(function(line, idx){
    const cells = bulkSplitLine(line);
    const data = {};
    fields.forEach(function(field, i){
      if (field) data[field] = (cells[i] || '').trim();
    });

    const errors = [];
    const nom = data.nom || '';
    const categorieLabel = data.categorie || '';
    const prixRaw = (data.prix || '').replace(/[^\d.,-]/g, '').replace(',', '.');
    const prix = Number(prixRaw);

    if (!nom) errors.push('Nom manquant');
    if (!categorieLabel) errors.push('Catégorie manquante');
    if (!data.prix || !isFinite(prix) || prix <= 0) errors.push('Prix invalide');

    let disponibilite = (data.disponibilite || 'en_stock').trim();
    if (!BULK_ALLOWED_DISPO.includes(disponibilite)) disponibilite = 'en_stock';

    const categorieKey = bulkCompactKey(categorieLabel);
    const categorieSlug = labelToSlug[categorieKey] || slugify(categorieLabel || 'categorie');
    const finalCategorieLabel = knownCategories[categorieSlug] || categorieLabel;

    const images = (data.images || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);

    const row = {
      id: slugify(nom || 'produit') + '-' + Date.now().toString().slice(-5) + '-' + idx,
      nom: nom,
      categorie: categorieSlug,
      categorie_label: finalCategorieLabel,
      prix: isFinite(prix) ? prix : 0,
      etat: data.etat || '',
      disponibilite: disponibilite,
      badge: data.badge || '',
      description: data.description || '',
      specs: [],
      poids_kg: bulkToNumberOrNull(data.poids_kg),
      longueur_cm: bulkToNumberOrNull(data.longueur_cm),
      largeur_cm: bulkToNumberOrNull(data.largeur_cm),
      hauteur_cm: bulkToNumberOrNull(data.hauteur_cm),
      images: images,
      video_url: null,
      option_groups: [],
      variantes: []
    };

    return { lineNumber: idx + 2, row: row, images: images, errors: errors, valid: errors.length === 0 };
  });

  return { rows: rows, error: null };
}

let bulkParsedRows = [];

function renderBulkPreviewTable(){
  const tbody = document.getElementById('bulk-preview-tbody');
  const validRows = bulkParsedRows.filter(function(r){ return r.valid; });

  document.getElementById('bulk-preview-count').textContent = validRows.length;
  document.getElementById('bulk-preview-total').textContent = bulkParsedRows.length;

  tbody.innerHTML = bulkParsedRows.map(function(r){
    const statusHtml = r.valid
      ? '<span style="color:var(--green-dark); font-weight:700;">✓ OK</span>'
      : '<span style="color:#C0272D; font-weight:700;">✗ ' + escapeHtml(r.errors.join(', ')) + '</span>';
    const prixTxt = r.row.prix ? Number(r.row.prix).toLocaleString('fr-FR') + ' FCFA' : '—';
    return '<tr>' +
      '<td data-label="Ligne">' + r.lineNumber + '</td>' +
      '<td data-label="Nom">' + escapeHtml(r.row.nom || '—') + '</td>' +
      '<td data-label="Catégorie">' + escapeHtml(r.row.categorie_label || '—') + '</td>' +
      '<td data-label="Prix">' + prixTxt + '</td>' +
      '<td data-label="Images">' + r.row.images.length + ' image(s)</td>' +
      '<td data-label="Statut">' + statusHtml + '</td>' +
      '</tr>';
  }).join('');

  document.getElementById('btn-bulk-confirm').style.display = validRows.length ? 'inline-flex' : 'none';
  return validRows;
}

function bindBulkImportForm(){
  const previewBtn = document.getElementById('btn-bulk-preview');
  const confirmBtn = document.getElementById('btn-bulk-confirm');
  const noteEl = document.getElementById('bulk-import-note');
  const previewWrap = document.getElementById('bulk-preview-wrap');
  if (!previewBtn || previewBtn.dataset.bound === '1') return;
  previewBtn.dataset.bound = '1';

  function showNote(el, message, isError){
    el.textContent = message;
    el.style.color = isError ? '#C0272D' : 'var(--green-dark)';
    el.style.display = 'block';
  }

  previewBtn.addEventListener('click', function(){
    noteEl.style.display = 'none';
    const parsed = parseBulkInput(document.getElementById('bulk-import-input').value);

    if (parsed.error){
      previewWrap.style.display = 'none';
      showNote(noteEl, parsed.error, true);
      return;
    }

    bulkParsedRows = parsed.rows;
    const validRows = renderBulkPreviewTable();
    previewWrap.style.display = 'block';

    // Réinitialise l'étape 2 (photos) à chaque nouvel aperçu, pour éviter d'associer
    // des photos déjà uploadées à un aperçu périmé
    document.getElementById('bulk-images-upload').value = '';
    document.getElementById('bulk-photo-status').style.display = 'none';

    if (!bulkParsedRows.length){
      showNote(noteEl, 'Aucune ligne de produit trouvée sous l\'en-tête.', true);
    } else if (!validRows.length){
      showNote(noteEl, 'Aucune ligne valide à importer — corrigez les erreurs ci-dessus puis réessayez.', true);
    }
  });

  confirmBtn.addEventListener('click', async function(){
    const validRows = bulkParsedRows.filter(function(r){ return r.valid; }).map(function(r){ return r.row; });
    if (!validRows.length) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Import en cours...';

    const { error } = await supabaseClient.from('products').upsert(validRows);

    confirmBtn.disabled = false;
    confirmBtn.textContent = "Confirmer l'import";

    if (error){
      showNote(noteEl, 'Erreur lors de l\'import : ' + error.message, true);
      return;
    }

    showNote(noteEl, '✓ ' + validRows.length + ' produit(s) importé(s) avec succès — déjà visibles sur le site.', false);

    document.getElementById('bulk-import-input').value = '';
    previewWrap.style.display = 'none';
    confirmBtn.style.display = 'none';
    bulkParsedRows = [];

    await loadAdminData();
    renderProductTable();
  });
}

/* ---------- Étape 2 : association de photos en masse par nom de fichier ---------- */

// Retire l'extension et un éventuel numéro final ("-1", "_2", " (3)") puis normalise
// comme slugify() pour comparer au nom du produit de façon fiable
function bulkExtractPhotoKey(filename){
  const noExt = filename.replace(/\.[a-zA-Z0-9]+$/, '');
  const noNum = noExt.replace(/[-_\s]*\(?\d+\)?$/, '');
  return slugify(noNum || noExt);
}

// Numéro final du fichier (pour garder l'ordre 1, 2, 3... des photos d'un même produit)
function bulkExtractPhotoIndex(filename){
  const noExt = filename.replace(/\.[a-zA-Z0-9]+$/, '');
  const m = noExt.match(/(\d+)\)?$/);
  return m ? Number(m[1]) : 0;
}

function bindBulkPhotoAssociation(){
  const assocBtn = document.getElementById('btn-bulk-assoc-photos');
  if (!assocBtn || assocBtn.dataset.bound === '1') return;
  assocBtn.dataset.bound = '1';

  const fileInput = document.getElementById('bulk-images-upload');
  const statusEl = document.getElementById('bulk-photo-status');

  assocBtn.addEventListener('click', async function(){
    statusEl.style.display = 'none';

    if (!bulkParsedRows.length){
      alert('Cliquez d\'abord sur « Prévisualiser » (étape 1) avant d\'associer des photos.');
      return;
    }
    const files = Array.from(fileInput.files || []);
    if (!files.length){
      alert('Sélectionnez d\'abord une ou plusieurs photos.');
      return;
    }

    // Regroupe les fichiers par produit (clé issue du nom de fichier), triés par numéro
    const groups = {};
    files.forEach(function(file){
      const key = bulkExtractPhotoKey(file.name);
      if (!groups[key]) groups[key] = [];
      groups[key].push(file);
    });
    Object.keys(groups).forEach(function(key){
      groups[key].sort(function(a, b){ return bulkExtractPhotoIndex(a.name) - bulkExtractPhotoIndex(b.name); });
    });

    assocBtn.disabled = true;
    assocBtn.textContent = 'Association en cours...';

    const matchedKeys = new Set();
    let uploadedCount = 0, failedCount = 0;

    for (const r of bulkParsedRows){
      if (!r.valid) continue;
      const rowKey = slugify(r.row.nom || '');
      const group = groups[rowKey];
      if (!group || !group.length) continue;

      matchedKeys.add(rowKey);

      for (const file of group){
        const path = `${r.row.id}/${Date.now()}-${safeFileName(file.name)}`;
        const { error: upErr } = await supabaseClient.storage.from('product-images').upload(path, file);
        if (upErr){ console.error('Erreur upload', file.name, upErr); failedCount++; continue; }
        const { data: pub } = supabaseClient.storage.from('product-images').getPublicUrl(path);
        if (pub && pub.publicUrl){
          r.row.images.push(pub.publicUrl);
          uploadedCount++;
        }
      }
    }

    assocBtn.disabled = false;
    assocBtn.textContent = 'Associer les photos aux produits';

    renderBulkPreviewTable();

    const unmatchedGroups = Object.keys(groups).filter(function(k){ return !matchedKeys.has(k); });
    let message = '✓ ' + uploadedCount + ' photo(s) associée(s) et envoyée(s) à ' + matchedKeys.size + ' produit(s).';
    let isError = false;
    if (failedCount) message += ' (' + failedCount + ' échec(s) d\'envoi, voir la console.)';
    if (unmatchedGroups.length){
      message += ' Aucun produit ne correspond à : ' + unmatchedGroups.map(function(k){ return groups[k][0].name; }).join(', ') + ' — vérifiez le nom du fichier par rapport au nom du produit.';
      isError = true;
    }

    statusEl.textContent = message;
    statusEl.style.color = isError ? '#C0272D' : 'var(--green-dark)';
    statusEl.style.display = 'block';
  });
}

function openProductModal(id){
  editingProductId = id;
  const form = document.getElementById('product-form');
  form.reset();
  document.getElementById('spec-rows').innerHTML = '';
  document.getElementById('option-groups-rows').innerHTML = '';
  document.getElementById('variants-table-wrap').innerHTML = '';
  document.getElementById('variants-section').style.display = 'none';
  document.getElementById('p-video-status').textContent = '';
  document.getElementById('p-categorie-nouvelle').value = '';

  if (id){
    const p = adminProducts.find(x => x.id === id);
    document.getElementById('modal-title').textContent = 'Modifier le produit';
    document.getElementById('p-id').value = p.id;
    document.getElementById('p-nom').value = p.nom;
    populateCategorySelect(p.categorie);
    document.getElementById('p-prix').value = p.prix;
    document.getElementById('p-badge').value = p.badge || '';
    document.getElementById('p-etat').value = p.etat || '';
    document.getElementById('p-disponibilite').value = p.disponibilite || 'en_stock';
    document.getElementById('p-description').value = p.description || '';
    document.getElementById('p-poids').value = p.poidsKg || '';
    document.getElementById('p-longueur').value = p.longueurCm || '';
    document.getElementById('p-largeur').value = p.largeurCm || '';
    document.getElementById('p-hauteur').value = p.hauteurCm || '';
    document.getElementById('p-video-url').value = p.videoUrl || '';
    currentProductImages = (p.images || []).slice();
    currentUploadFolder = p.id;
    (p.specs || []).forEach(function(s){ addSpecRow(s[0], s[1]); });

    currentVariantes = (p.variantes || []).slice();
    (p.optionGroups || []).forEach(function(g){ addOptionGroupRow(g.nom, g.valeurs.join(', ')); });
    if (p.optionGroups && p.optionGroups.length) renderVariantsTable();
  } else {
    document.getElementById('modal-title').textContent = 'Ajouter un produit';
    document.getElementById('p-id').value = '';
    populateCategorySelect(null);
    document.getElementById('p-video-url').value = '';
    currentProductImages = [];
    currentUploadFolder = 'new-' + Date.now();
    addSpecRow('', '');
    currentVariantes = [];
  }

  renderImagePreviews();
  document.getElementById('product-modal').classList.add('show');
}

function closeProductModal(){
  document.getElementById('product-modal').classList.remove('show');
  editingProductId = null;
}

function addSpecRow(label, value){
  const wrap = document.getElementById('spec-rows');
  const row = document.createElement('div');
  row.className = 'spec-row';
  row.innerHTML = `
    <input type="text" placeholder="Ex : Processeur" class="spec-label" value="${escapeHtml(label)}">
    <input type="text" placeholder="Ex : Intel Core i7" class="spec-value" value="${escapeHtml(value)}">
    <button type="button" title="Retirer">✕</button>`;
  row.querySelector('button').addEventListener('click', function(){ row.remove(); });
  wrap.appendChild(row);
}

/* ---------- Options à choix + variantes (prix par combinaison) ---------- */
function addOptionGroupRow(nom, valeursStr){
  const wrap = document.getElementById('option-groups-rows');
  const row = document.createElement('div');
  row.className = 'option-group-row';
  row.innerHTML = `
    <input type="text" placeholder="Ex : Couleur" class="og-nom" value="${escapeHtml(nom || '')}">
    <input type="text" placeholder="Valeurs séparées par des virgules, ex : Rouge, Noir, Bleu" class="og-valeurs" value="${escapeHtml(valeursStr || '')}">
    <button type="button" title="Retirer">✕</button>`;
  row.querySelector('button').addEventListener('click', function(){
    row.remove();
    if (!document.querySelectorAll('.option-group-row').length){
      document.getElementById('variants-section').style.display = 'none';
    }
  });
  wrap.appendChild(row);
  document.getElementById('variants-section').style.display = 'block';
}

function readOptionGroupsFromForm(){
  const groups = [];
  document.querySelectorAll('.option-group-row').forEach(function(row){
    const nom = row.querySelector('.og-nom').value.trim();
    const valeurs = row.querySelector('.og-valeurs').value.split(',').map(v => v.trim()).filter(Boolean);
    if (nom && valeurs.length) groups.push({ nom: nom, valeurs: valeurs });
  });
  return groups;
}

function renderVariantsTable(){
  const groups = readOptionGroupsFromForm();
  const section = document.getElementById('variants-section');
  const wrap = document.getElementById('variants-table-wrap');

  if (!groups.length){
    section.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }
  section.style.display = 'block';

  const combos = buildVariantCombos(groups);
  const basePrix = Number(document.getElementById('p-prix').value) || 0;

  wrap.innerHTML = `<table class="admin-table"><thead><tr>
    ${groups.map(g => `<th>${escapeHtml(g.nom)}</th>`).join('')}
    <th>Prix (FCFA)</th>
  </tr></thead><tbody>
    ${combos.map(function(combo, i){
      const existing = currentVariantes.find(v => combosEqual(v.combo, combo));
      const prix = existing ? existing.prix : basePrix;
      return `<tr>
        ${groups.map(g => `<td data-label="${escapeHtml(g.nom)}">${escapeHtml(combo[g.nom])}</td>`).join('')}
        <td data-label="Prix"><input type="number" min="0" class="variant-price-input" data-combo-index="${i}" value="${prix}"></td>
      </tr>`;
    }).join('')}
  </tbody></table>`;

  // On mémorise les combinaisons courantes pour pouvoir les relire à la soumission
  wrap.dataset.combos = JSON.stringify(combos);
}

async function submitProductForm(e){
  e.preventDefault();

  const specs = [];
  document.querySelectorAll('#spec-rows .spec-row').forEach(function(row){
    const label = row.querySelector('.spec-label').value.trim();
    const value = row.querySelector('.spec-value').value.trim();
    if (label && value) specs.push([label, value]);
  });

  const nom = document.getElementById('p-nom').value.trim();
  const existingId = document.getElementById('p-id').value;

  // Catégorie : soit une existante, soit une toute nouvelle tapée par l'utilisateur
  let categorie = document.getElementById('p-categorie').value;
  let categorieLabel;
  if (categorie === '__new__'){
    const nouvelleLabel = document.getElementById('p-categorie-nouvelle').value.trim();
    if (!nouvelleLabel){
      alert('Merci de donner un nom à la nouvelle catégorie.');
      return;
    }
    categorie = slugify(nouvelleLabel);
    categorieLabel = nouvelleLabel;
  } else {
    categorieLabel = getKnownCategories()[categorie] || categorie;
  }

  // Options à choix + variantes (prix par combinaison)
  const optionGroups = readOptionGroupsFromForm();
  let variantes = [];
  if (optionGroups.length){
    const wrap = document.getElementById('variants-table-wrap');
    const combos = wrap.dataset.combos ? JSON.parse(wrap.dataset.combos) : [];
    wrap.querySelectorAll('.variant-price-input').forEach(function(input){
      const idx = Number(input.dataset.comboIndex);
      if (combos[idx]) variantes.push({ combo: combos[idx], prix: Number(input.value) || 0 });
    });
  }

  // Colonnes en snake_case pour correspondre au schéma Supabase
  const row = {
    id: existingId || (slugify(nom) + '-' + Date.now().toString().slice(-5)),
    nom: nom,
    categorie: categorie,
    categorie_label: categorieLabel,
    prix: Number(document.getElementById('p-prix').value),
    etat: document.getElementById('p-etat').value.trim(),
    disponibilite: document.getElementById('p-disponibilite').value,
    badge: document.getElementById('p-badge').value.trim(),
    description: document.getElementById('p-description').value.trim(),
    specs: specs,
    poids_kg: document.getElementById('p-poids').value ? Number(document.getElementById('p-poids').value) : null,
    longueur_cm: document.getElementById('p-longueur').value ? Number(document.getElementById('p-longueur').value) : null,
    largeur_cm: document.getElementById('p-largeur').value ? Number(document.getElementById('p-largeur').value) : null,
    hauteur_cm: document.getElementById('p-hauteur').value ? Number(document.getElementById('p-hauteur').value) : null,
    images: currentProductImages,
    video_url: document.getElementById('p-video-url').value.trim() || null,
    option_groups: optionGroups,
    variantes: variantes
  };

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enregistrement...';

  const { error } = await supabaseClient.from('products').upsert(row);

  submitBtn.disabled = false;
  submitBtn.textContent = 'Enregistrer le produit';

  if (error){ alert('Erreur lors de l\'enregistrement : ' + error.message); return; }

  await loadAdminData();
  renderProductTable();
  closeProductModal();
}

/* ---------- Photos et vidéo du produit ---------- */
function renderImagePreviews(){
  const wrap = document.getElementById('p-images-preview');
  wrap.innerHTML = currentProductImages.map(function(url, i){
    return `<div class="thumb-item">
      <img src="${url}" alt="Photo produit ${i+1}">
      <button type="button" data-index="${i}" title="Retirer">✕</button>
    </div>`;
  }).join('');

  wrap.querySelectorAll('button').forEach(function(btn){
    btn.addEventListener('click', function(){
      currentProductImages.splice(Number(btn.dataset.index), 1);
      renderImagePreviews();
    });
  });
}

function safeFileName(name){
  return name.replace(/[^a-zA-Z0-9.]+/g, '-');
}

function bindMediaUploads(){
  document.getElementById('p-images-upload').addEventListener('change', async function(e){
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (const file of files){
      const path = `${currentUploadFolder}/${Date.now()}-${safeFileName(file.name)}`;
      const { error: upErr } = await supabaseClient.storage.from('product-images').upload(path, file);
      if (upErr){
        alert("Erreur lors de l'envoi de la photo « " + file.name + " » : " + upErr.message);
        continue;
      }
      const { data: pub } = supabaseClient.storage.from('product-images').getPublicUrl(path);
      if (pub && pub.publicUrl) currentProductImages.push(pub.publicUrl);
    }

    renderImagePreviews();
    e.target.value = '';
  });

  document.getElementById('p-video-upload').addEventListener('change', async function(e){
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('p-video-status');
    statusEl.textContent = 'Envoi de la vidéo en cours...';

    const path = `${currentUploadFolder}/${Date.now()}-${safeFileName(file.name)}`;
    const { error: upErr } = await supabaseClient.storage.from('product-videos').upload(path, file);

    if (upErr){
      statusEl.textContent = "Erreur lors de l'envoi : " + upErr.message;
      return;
    }

    const { data: pub } = supabaseClient.storage.from('product-videos').getPublicUrl(path);
    if (pub && pub.publicUrl){
      document.getElementById('p-video-url').value = pub.publicUrl;
      statusEl.textContent = '✓ Vidéo envoyée : ' + file.name;
    }
    e.target.value = '';
  });
}

/* ---------- Informations de contact ---------- */
function fillContactForm(){
  document.getElementById('c-whatsapp').value = adminContact.whatsappNumber || '';
  document.getElementById('c-tel').value = adminContact.telephone || '';
  document.getElementById('c-email').value = adminContact.email || '';
  document.getElementById('c-ville').value = adminContact.ville || '';
}

function bindContactForm(){
  document.getElementById('btn-save-contact').addEventListener('click', async function(){
    const btn = this;
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';

    adminContact = {
      whatsappNumber: document.getElementById('c-whatsapp').value.trim(),
      telephone: document.getElementById('c-tel').value.trim(),
      email: document.getElementById('c-email').value.trim(),
      ville: document.getElementById('c-ville').value.trim()
    };

    const { error } = await supabaseClient
      .from('site_settings')
      .upsert({ key: 'contact', value: adminContact });

    btn.disabled = false;
    btn.textContent = 'Enregistrer';

    if (error){ alert('Erreur lors de l\'enregistrement : ' + error.message); return; }

    const note = document.getElementById('contact-saved-note');
    note.style.display = 'block';
    setTimeout(function(){ note.style.display = 'none'; }, 2500);
  });
}

/* ---------- Commandes ---------- */
let adminOrders = [];
let currentOrderStatutFilter = '';

const STATUT_LABELS = {
  en_attente: 'En attente',
  confirmee: 'Confirmée',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée'
};

// Ordre strict des étapes — on ne peut avancer qu'à l'étape suivante, jamais revenir en arrière.
// "annulee" est une sortie possible à tout moment avant "livree", gérée séparément.
const STATUT_SEQUENCE = ['en_attente', 'confirmee', 'expediee', 'livree'];

function nextStatut(current){
  const idx = STATUT_SEQUENCE.indexOf(current);
  if (idx === -1 || idx === STATUT_SEQUENCE.length - 1) return null;
  return STATUT_SEQUENCE[idx + 1];
}

async function loadOrdersAdmin(){
  const { data, error } = await supabaseClient
    .from('orders').select('*').order('created_at', { ascending: false });
  if (error){ console.error('Erreur de chargement des commandes :', error); return; }
  adminOrders = data || [];
}

function renderOrderTable(){
  const tbody = document.getElementById('order-tbody');
  const list = currentOrderStatutFilter
    ? adminOrders.filter(o => o.statut === currentOrderStatutFilter)
    : adminOrders;

  document.getElementById('order-count').textContent = adminOrders.length;

  if (!list.length){
    tbody.innerHTML = '<tr><td colspan="8">Aucune commande pour le moment.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(function(o){
    const date = o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
    const total = o.cout_total != null ? Number(o.cout_total).toLocaleString('fr-FR') + ' FCFA' : '—';
    const next = nextStatut(o.statut);
    const isTerminal = (o.statut === 'livree' || o.statut === 'annulee');

    const statutHtml = `
      <span class="order-statut-badge statut-${o.statut}">${STATUT_LABELS[o.statut] || o.statut}</span>
      ${next ? `<button type="button" class="btn-next-statut" data-id="${o.id}" data-next="${next}">→ ${STATUT_LABELS[next]}</button>` : ''}
      ${!isTerminal ? `<button type="button" class="btn-cancel-statut" data-id="${o.id}">Annuler</button>` : ''}
    `;

    return `<tr>
      <td data-label="Date">${date}</td>
      <td data-label="Client">${escapeHtml(o.nom)}<br><span style="color:var(--slate-light); font-size:.78rem;">${escapeHtml(o.telephone)}</span></td>
      <td data-label="Produit">${escapeHtml(o.produit_nom)}</td>
      <td data-label="Qté">${o.quantite}</td>
      <td data-label="Transport">${o.transport_label ? escapeHtml(o.transport_label) : '—'}</td>
      <td data-label="Total estimé">${total}</td>
      <td data-label="Statut"><div class="order-statut-cell">${statutHtml}</div></td>
      <td data-label="Actions">
        <div class="row-actions">
          <button class="edit" data-action="voir-commande" data-id="${o.id}">Détails</button>
          <button class="danger" data-action="supprimer-commande" data-id="${o.id}">Supprimer</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-next-statut').forEach(function(btn){
    btn.addEventListener('click', function(){
      if (!confirm(`Faire passer cette commande à l'étape « ${STATUT_LABELS[btn.dataset.next]} » ? Cette étape ne pourra plus être annulée une fois passée.`)) return;
      updateOrderStatut(btn.dataset.id, btn.dataset.next);
    });
  });
  tbody.querySelectorAll('.btn-cancel-statut').forEach(function(btn){
    btn.addEventListener('click', function(){
      if (!confirm('Annuler cette commande ? Cette action est définitive.')) return;
      updateOrderStatut(btn.dataset.id, 'annulee');
    });
  });
  tbody.querySelectorAll('[data-action="voir-commande"]').forEach(function(btn){
    btn.addEventListener('click', function(){ openOrderModal(btn.dataset.id); });
  });
  tbody.querySelectorAll('[data-action="supprimer-commande"]').forEach(function(btn){
    btn.addEventListener('click', function(){ deleteOrder(btn.dataset.id); });
  });
}

async function updateOrderStatut(id, statut){
  const { error } = await supabaseClient.from('orders').update({ statut }).eq('id', id);
  if (error){ alert('Erreur lors de la mise à jour du statut : ' + error.message); return; }
  const order = adminOrders.find(o => o.id === id);
  if (order) order.statut = statut;
}

async function deleteOrder(id){
  if (!confirm('Supprimer définitivement cette commande de l\'historique ?')) return;
  const { error } = await supabaseClient.from('orders').delete().eq('id', id);
  if (error){ alert('Erreur lors de la suppression : ' + error.message); return; }
  adminOrders = adminOrders.filter(o => o.id !== id);
  renderOrderTable();
}

function bindOrderFilter(){
  const filterEl = document.getElementById('order-filter-statut');
  filterEl.addEventListener('change', function(){
    currentOrderStatutFilter = filterEl.value;
    renderOrderTable();
  });
}

function initOrderModal(){
  document.getElementById('btn-close-order-modal').addEventListener('click', function(){
    document.getElementById('order-modal').classList.remove('show');
  });
  document.getElementById('order-modal').addEventListener('click', function(e){
    if (e.target === this) this.classList.remove('show');
  });
}

function openOrderModal(id){
  const o = adminOrders.find(x => x.id === id);
  if (!o) return;
  const date = o.created_at ? new Date(o.created_at).toLocaleString('fr-FR') : '';
  const trackingUrl = `${window.location.origin}/suivi.html?id=${o.id}`;
  document.getElementById('order-detail-content').innerHTML = `
    <p><b>Date :</b> ${date}</p>
    <p><b>Client :</b> ${escapeHtml(o.nom)}</p>
    <p><b>Téléphone :</b> ${escapeHtml(o.telephone)}</p>
    <p><b>E-mail :</b> ${escapeHtml(o.email)}</p>
    <p><b>Produit :</b> ${escapeHtml(o.produit_nom)} (quantité : ${o.quantite})</p>
    <p><b>Transport :</b> ${o.transport_label ? escapeHtml(o.transport_label) : '—'}</p>
    <p><b>Sous-total produit :</b> ${o.cout_produit != null ? Number(o.cout_produit).toLocaleString('fr-FR') + ' FCFA' : '—'}</p>
    <p><b>Frais de transport estimés :</b> ${o.cout_transport != null ? Number(o.cout_transport).toLocaleString('fr-FR') + ' FCFA' : '—'}</p>
    <p><b>Total estimé :</b> ${o.cout_total != null ? Number(o.cout_total).toLocaleString('fr-FR') + ' FCFA' : '—'}</p>
    <p><b>Adresse de livraison :</b> ${escapeHtml(o.adresse)}</p>
    ${o.message ? `<p><b>Message du client :</b> ${escapeHtml(o.message)}</p>` : ''}
    <p><b>Statut actuel :</b> ${STATUT_LABELS[o.statut] || o.statut}</p>
    <div style="margin-top:14px; padding-top:14px; border-top:1px solid var(--line);">
      <p style="margin-bottom:8px;"><b>Lien de suivi à transmettre au client</b> (par WhatsApp par exemple) :</p>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <input type="text" readonly value="${trackingUrl}" id="tracking-url-input" style="flex:1; min-width:200px; padding:8px 10px; border:1px solid var(--line); border-radius:6px; font-size:.82rem;">
        <button type="button" class="btn btn-outline" id="btn-copy-tracking" style="padding:8px 14px; font-size:.82rem;">Copier</button>
      </div>
    </div>
  `;
  document.getElementById('btn-copy-tracking').addEventListener('click', function(){
    const input = document.getElementById('tracking-url-input');
    input.select();
    navigator.clipboard.writeText(input.value).then(function(){
      const btn = document.getElementById('btn-copy-tracking');
      const original = btn.textContent;
      btn.textContent = 'Copié !';
      setTimeout(function(){ btn.textContent = original; }, 1500);
    });
  });
  document.getElementById('order-modal').classList.add('show');
}

/* ---------- Avis clients (modération) ---------- */
let adminReviews = [];

async function loadReviewsAdmin(){
  const { data, error } = await supabaseClient
    .from('reviews').select('*').order('created_at', { ascending: false });
  if (error){ console.error('Erreur de chargement des avis :', error); return; }
  adminReviews = data || [];
}

function renderReviewTable(){
  const tbody = document.getElementById('review-tbody');
  document.getElementById('review-count').textContent = adminReviews.length;

  if (!adminReviews.length){
    tbody.innerHTML = '<tr><td colspan="7">Aucun avis pour le moment.</td></tr>';
    return;
  }

  tbody.innerHTML = adminReviews.map(function(r){
    const product = adminProducts.find(p => p.id === r.product_id);
    const stars = '★'.repeat(r.note) + '☆'.repeat(5 - r.note);
    const photosHtml = (r.photos || []).map(function(url){
      return `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="Photo avis" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--line);"></a>`;
    }).join(' ');
    const date = r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '';

    return `<tr>
      <td data-label="Produit">${escapeHtml(product ? product.nom : r.product_id)}</td>
      <td data-label="Client">${escapeHtml(r.nom)}</td>
      <td data-label="Note" style="color:#F5A623; letter-spacing:1px;">${stars}</td>
      <td data-label="Commentaire">${escapeHtml(r.commentaire || '—')}</td>
      <td data-label="Photos"><div style="display:flex; gap:4px; flex-wrap:wrap;">${photosHtml || '—'}</div></td>
      <td data-label="Date">${date}</td>
      <td data-label="Actions"><button class="danger" data-action="delete-review" data-id="${r.id}">Supprimer</button></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-action="delete-review"]').forEach(function(btn){
    btn.addEventListener('click', function(){ deleteReview(btn.dataset.id); });
  });
}

async function deleteReview(id){
  if (!confirm('Supprimer cet avis ? Cette action est immédiate et irréversible.')) return;

  const { error } = await supabaseClient.from('reviews').delete().eq('id', id);
  if (error){ alert('Erreur lors de la suppression : ' + error.message); return; }

  adminReviews = adminReviews.filter(r => r.id !== id);
  renderReviewTable();
}
function fillTransportForm(){
  const maritime = adminTransportModes.find(t => t.id === 'maritime');
  const normal = adminTransportModes.find(t => t.id === 'aerien-normal');
  const express = adminTransportModes.find(t => t.id === 'aerien-express');
  document.getElementById('t-maritime').value = maritime ? maritime.tarif : '';
  document.getElementById('t-aerien-normal').value = normal ? normal.tarif : '';
  document.getElementById('t-aerien-express').value = express ? express.tarif : '';
}

function bindTransportForm(){
  document.getElementById('btn-save-transport').addEventListener('click', async function(){
    const btn = this;
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';

    adminTransportModes = adminTransportModes.map(function(t){
      if (t.id === 'maritime') return Object.assign({}, t, { tarif: Number(document.getElementById('t-maritime').value) || 0 });
      if (t.id === 'aerien-normal') return Object.assign({}, t, { tarif: Number(document.getElementById('t-aerien-normal').value) || 0 });
      if (t.id === 'aerien-express') return Object.assign({}, t, { tarif: Number(document.getElementById('t-aerien-express').value) || 0 });
      return t;
    });

    const { error } = await supabaseClient
      .from('site_settings')
      .upsert({ key: 'transport_modes', value: adminTransportModes });

    btn.disabled = false;
    btn.textContent = 'Enregistrer';

    if (error){ alert("Erreur lors de l'enregistrement : " + error.message); return; }

    const note = document.getElementById('transport-saved-note');
    note.style.display = 'block';
    setTimeout(function(){ note.style.display = 'none'; }, 2500);
  });
}
