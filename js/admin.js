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
  await loadCustomersAdmin();
  renderCustomerTable();
  renderDashboard();
  initTabs();
  initSidebarToggle();
  initModal();
  initOrderModal();
  bindBulkImportModal();
  document.querySelectorAll('[data-icon]').forEach(function(el){
    const name = el.getAttribute('data-icon');
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });
}

/* ---------- Onglets ---------- */
function initTabs(){
  const buttons = document.querySelectorAll('.admin-sidebar button[data-tab]');
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

/* =========================================================
   UTILISATEURS INSCRITS (customer_profiles)
   ---------------------------------------------------------
   Un utilisateur "inscrit" est un client ayant créé un compte
   (voir compte.html / compte.js), donc une ligne dans
   customer_profiles. Un client qui commande sans créer de compte
   n'apparaît pas ici (il apparaît seulement dans l'onglet
   Commandes) — c'est normal, on ne peut pas le forcer à créer
   un compte.
   ========================================================= */
let adminCustomers = [];

async function loadCustomersAdmin(){
  const { data, error } = await supabaseClient
    .from('customer_profiles')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error){
    console.error('Erreur de chargement des utilisateurs :', error);
    adminCustomers = [];
    return;
  }
  adminCustomers = data || [];
}

function renderCustomerTable(){
  const tbody = document.getElementById('customer-tbody');
  document.getElementById('customer-count').textContent = adminCustomers.length;

  if (!adminCustomers.length){
    tbody.innerHTML = '<tr><td colspan="6">Aucun utilisateur inscrit pour le moment.</td></tr>';
    return;
  }

  tbody.innerHTML = adminCustomers.map(function(c){
    const nbCommandes = adminOrders.filter(o => o.customer_id === c.id).length;
    const date = c.updated_at ? new Date(c.updated_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
    return `<tr>
      <td data-label="Nom">${escapeHtml(c.nom || '—')}</td>
      <td data-label="Téléphone">${escapeHtml(c.telephone || '—')}</td>
      <td data-label="Ville">${escapeHtml(c.ville || '—')}</td>
      <td data-label="Adresse">${escapeHtml(c.adresse || '—')}</td>
      <td data-label="Commandes">${nbCommandes}</td>
      <td data-label="Dernière mise à jour">${date}</td>
    </tr>`;
  }).join('');
}

/* =========================================================
   TABLEAU DE BORD (statistiques)
   ========================================================= */
function renderDashboard(){
  const totalCommandes = adminOrders.length;
  const commandesActives = adminOrders.filter(o => o.statut !== 'annulee' && o.statut !== 'livree').length;
  const commandesAnnulees = adminOrders.filter(o => o.statut === 'annulee').length;
  const chiffreAffaires = adminOrders
    .filter(o => o.statut !== 'annulee')
    .reduce((sum, o) => sum + (Number(o.cout_total) || 0), 0);

  const ruptureCount = adminProducts.filter(p => p.disponibilite === 'rupture').length;

  const totalNotes = adminReviews.length;
  const moyenneNotes = totalNotes ? (adminReviews.reduce((s, r) => s + (r.note || 0), 0) / totalNotes) : 0;

  // "Nouveau" = créé dans les 7 derniers jours
  const unSemaine = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const commandesSemaine = adminOrders.filter(o => o.created_at && new Date(o.created_at).getTime() >= unSemaine).length;
  const utilisateursSemaine = adminCustomers.filter(c => c.updated_at && new Date(c.updated_at).getTime() >= unSemaine).length;

  const stats = [
    { label: 'Chiffre d\'affaires', value: formatFCFA(chiffreAffaires), sub: 'commandes non annulées', accent: true },
    { label: 'Commandes', value: totalCommandes, sub: `${commandesSemaine} cette semaine` },
    { label: 'Commandes en cours', value: commandesActives, sub: `${commandesAnnulees} annulée(s)` },
    { label: 'Produits au catalogue', value: adminProducts.length, sub: ruptureCount ? `${ruptureCount} en rupture` : 'Aucune rupture' },
    { label: 'Utilisateurs inscrits', value: adminCustomers.length, sub: `${utilisateursSemaine} cette semaine` },
    { label: 'Avis clients', value: totalNotes, sub: totalNotes ? `Note moyenne ${moyenneNotes.toFixed(1)}/5` : 'Aucun avis' }
  ];

  document.getElementById('stat-grid-main').innerHTML = stats.map(function(s){
    return `<div class="stat-card${s.accent ? ' accent' : ''}">
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-sub">${s.sub}</div>
    </div>`;
  }).join('');

  // Répartition des commandes par statut (mini barres)
  const breakdown = STATUT_SEQUENCE.concat(['annulee']).map(function(key){
    const count = adminOrders.filter(o => o.statut === key).length;
    const pct = totalCommandes ? Math.round((count / totalCommandes) * 100) : 0;
    return `<div class="statut-breakdown-row">
      <span class="label">${STATUT_LABELS[key]}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;"></div></div>
      <span class="count">${count}</span>
    </div>`;
  }).join('');
  document.getElementById('statut-breakdown').innerHTML = breakdown || '<p style="color:var(--slate-light);">Aucune commande pour le moment.</p>';

  // Dernières commandes (aperçu rapide, 5 plus récentes)
  const recent = adminOrders.slice(0, 5);
  document.getElementById('dashboard-recent').innerHTML = recent.length
    ? recent.map(function(o){
        const date = o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
        return `<div style="display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px dashed var(--line); font-size:.86rem;">
          <span>${escapeHtml(o.nom)} — ${escapeHtml(o.produit_nom)}</span>
          <span style="color:var(--slate-light); flex-shrink:0;">${date}</span>
        </div>`;
      }).join('')
    : '<p style="color:var(--slate-light);">Aucune commande pour le moment.</p>';
}

/* =========================================================
   IMPORT EN MASSE (plusieurs produits collés depuis Excel/Sheets)
   ---------------------------------------------------------
   Colonnes attendues (voir aussi la modale HTML) :
   nom*, categorie*, categorie_label, prix*, etat, badge,
   disponibilite, poids_kg, longueur_cm, largeur_cm, hauteur_cm,
   description, images (URLs séparées par ";")
   * = obligatoire
   ========================================================= */
const BULK_IMPORT_COLUMNS = [
  'nom', 'categorie', 'categorie_label', 'prix', 'etat', 'badge',
  'disponibilite', 'poids_kg', 'longueur_cm', 'largeur_cm', 'hauteur_cm',
  'description'
];
const BULK_IMPORT_REQUIRED = ['nom', 'categorie', 'prix'];
const BULK_IMPORT_DISPO_VALUES = ['en_stock', 'sur_commande', 'rupture'];

let bulkImportParsedRows = []; // lignes valides prêtes à être insérées
let bulkImportFilesByRowId = {}; // { rowId: [File, File, ...] } — photos choisies par produit, avant upload

/* Découpe le texte collé en lignes/colonnes. Détecte automatiquement le
   séparateur : tabulation (copier/coller depuis Excel ou Google Sheets,
   le cas le plus courant et le plus fiable) sinon virgule. */
function parseBulkImportText(text){
  const lines = text.split(/\r\n|\r|\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (!lines.length){
    return { rows: [], errors: [], globalError: 'Aucune ligne détectée. Collez au moins une ligne d\'en-têtes et une ligne de produit.' };
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headerCells = lines[0].split(delimiter).map(h => h.trim().toLowerCase());

  const missingRequired = BULK_IMPORT_REQUIRED.filter(col => !headerCells.includes(col));
  if (missingRequired.length){
    return { rows: [], errors: [], globalError: `Colonne(s) obligatoire(s) manquante(s) dans l'en-tête : ${missingRequired.join(', ')}. Vérifiez l'orthographe exacte des colonnes (voir le tableau d'exemple ci-dessus).` };
  }

  const dataLines = lines.slice(1);
  const rows = [];
  const errors = [];

  dataLines.forEach(function(line, i){
    const cells = line.split(delimiter).map(c => c.trim());
    const raw = {};
    headerCells.forEach(function(colName, idx){
      if (BULK_IMPORT_COLUMNS.includes(colName)) raw[colName] = cells[idx] !== undefined ? cells[idx] : '';
    });

    const rowErrors = [];
    if (!raw.nom) rowErrors.push('nom manquant');
    if (!raw.categorie) rowErrors.push('categorie manquante');
    const prixNum = Number(raw.prix);
    if (!raw.prix || isNaN(prixNum) || prixNum < 0) rowErrors.push('prix invalide');

    let dispo = (raw.disponibilite || 'en_stock').trim();
    if (!BULK_IMPORT_DISPO_VALUES.includes(dispo)) dispo = 'en_stock';

    const nom = raw.nom || '';

    const product = {
      id: slugify(nom) + '-' + Date.now().toString().slice(-5) + '-' + i,
      nom: nom,
      categorie: raw.categorie || '',
      categorie_label: raw.categorie_label || (raw.categorie ? raw.categorie.charAt(0).toUpperCase() + raw.categorie.slice(1) : ''),
      prix: isNaN(prixNum) ? 0 : prixNum,
      etat: raw.etat || '',
      badge: raw.badge || '',
      disponibilite: dispo,
      poids_kg: raw.poids_kg ? Number(raw.poids_kg) || 0 : null,
      longueur_cm: raw.longueur_cm ? Number(raw.longueur_cm) || 0 : null,
      largeur_cm: raw.largeur_cm ? Number(raw.largeur_cm) || 0 : null,
      hauteur_cm: raw.hauteur_cm ? Number(raw.hauteur_cm) || 0 : null,
      description: raw.description || '',
      images: [], // rempli au moment de l'import, à partir des photos choisies dans l'aperçu
      specs: [],
      option_groups: [],
      variantes: []
    };

    if (rowErrors.length){
      errors.push({ line: i + 2, nom: nom || '(sans nom)', messages: rowErrors }); // +2 = ligne réelle dans le texte collé (1 = en-tête)
    } else {
      rows.push(product);
    }
  });

  return { rows, errors, globalError: null };
}

function renderBulkPreview(parsed){
  const wrap = document.getElementById('bulk-import-preview');
  const confirmBtn = document.getElementById('btn-bulk-confirm');

  if (parsed.globalError){
    wrap.innerHTML = `<p style="color:#C0272D; font-weight:600;">${escapeHtml(parsed.globalError)}</p>`;
    confirmBtn.style.display = 'none';
    bulkImportParsedRows = [];
    return;
  }

  const validCount = parsed.rows.length;
  const errorCount = parsed.errors.length;

  let html = `<p class="bulk-import-summary">${validCount} produit(s) prêt(s) à importer${errorCount ? `, ${errorCount} ligne(s) en erreur (ignorée(s) si vous continuez)` : ''}.</p>`;

  if (errorCount){
    html += `<div class="table-wrap" style="margin-bottom:16px;"><table class="admin-table" style="font-size:.82rem;">
      <thead><tr><th>Ligne</th><th>Produit</th><th>Problème(s)</th></tr></thead>
      <tbody>${parsed.errors.map(e => `<tr class="bulk-row-error"><td>${e.line}</td><td>${escapeHtml(e.nom)}</td><td>${e.messages.join(', ')}</td></tr>`).join('')}</tbody>
    </table></div>`;
  }

  if (validCount){
    html += `<div class="table-wrap"><table class="admin-table" style="font-size:.82rem;">
      <thead><tr><th>Nom</th><th>Catégorie</th><th>Prix</th><th>Disponibilité</th><th>Photos</th></tr></thead>
      <tbody>${parsed.rows.map(p => `<tr>
        <td>${escapeHtml(p.nom)}</td>
        <td>${escapeHtml(p.categorie_label)}</td>
        <td>${formatFCFA(p.prix)}</td>
        <td>${escapeHtml(p.disponibilite)}</td>
        <td class="bulk-photo-cell" data-row-id="${p.id}">
          <input type="file" accept="image/*" multiple data-row-id="${p.id}">
          <div class="bulk-photo-thumbs"></div>
          <span class="bulk-photo-count">Aucune photo choisie</span>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  wrap.innerHTML = html;
  bulkImportParsedRows = parsed.rows;
  bulkImportFilesByRowId = {};
  confirmBtn.style.display = validCount ? 'inline-flex' : 'none';
  confirmBtn.textContent = `Importer ${validCount} produit(s)`;

  // Sélection des photos par produit, depuis l'ordinateur de l'admin
  wrap.querySelectorAll('.bulk-photo-cell input[type="file"]').forEach(function(input){
    input.addEventListener('change', function(){
      const rowId = this.dataset.rowId;
      const files = Array.from(this.files || []);
      bulkImportFilesByRowId[rowId] = files;

      const cell = this.closest('.bulk-photo-cell');
      const thumbsEl = cell.querySelector('.bulk-photo-thumbs');
      const countEl = cell.querySelector('.bulk-photo-count');

      thumbsEl.innerHTML = files.map(function(file){
        const url = URL.createObjectURL(file);
        return `<img src="${url}" alt="">`;
      }).join('');
      countEl.textContent = files.length
        ? `${files.length} photo(s) sélectionnée(s)`
        : 'Aucune photo choisie';
    });
  });
}

function openBulkImportModal(){
  document.getElementById('bulk-import-text').value = '';
  document.getElementById('bulk-import-preview').innerHTML = '';
  document.getElementById('btn-bulk-confirm').style.display = 'none';
  document.getElementById('bulk-import-progress').style.display = 'none';
  bulkImportParsedRows = [];
  bulkImportFilesByRowId = {};
  document.getElementById('bulk-import-modal').classList.add('show');
}

function closeBulkImportModal(){
  document.getElementById('bulk-import-modal').classList.remove('show');
}

function bindBulkImportModal(){
  document.getElementById('btn-bulk-import').addEventListener('click', openBulkImportModal);
  document.getElementById('btn-cancel-bulk-import').addEventListener('click', closeBulkImportModal);

  document.getElementById('btn-bulk-analyze').addEventListener('click', function(){
    const text = document.getElementById('bulk-import-text').value;
    const parsed = parseBulkImportText(text);
    renderBulkPreview(parsed);
  });

  document.getElementById('btn-bulk-confirm').addEventListener('click', async function(){
    if (!bulkImportParsedRows.length) return;
    const btn = this;
    const progressEl = document.getElementById('bulk-import-progress');
    btn.disabled = true;
    progressEl.style.display = 'block';

    // 1) Téléverse d'abord les photos de chaque produit (si des fichiers ont été choisis),
    //    puis attache les URLs publiques obtenues au produit correspondant.
    for (let i = 0; i < bulkImportParsedRows.length; i++){
      const row = bulkImportParsedRows[i];
      const files = bulkImportFilesByRowId[row.id] || [];
      progressEl.textContent = `Envoi des photos : produit ${i + 1}/${bulkImportParsedRows.length} (${row.nom})...`;

      for (const file of files){
        const path = `${row.id}/${Date.now()}-${safeFileName(file.name)}`;
        const { error: upErr } = await supabaseClient.storage.from('product-images').upload(path, file);
        if (upErr){
          console.error(`Erreur upload photo pour ${row.nom} :`, upErr);
          continue; // on continue avec les autres photos plutôt que d'échouer tout l'import
        }
        const { data: pub } = supabaseClient.storage.from('product-images').getPublicUrl(path);
        if (pub && pub.publicUrl) row.images.push(pub.publicUrl);
      }
    }

    // 2) Insère tous les produits (avec leurs images déjà attachées) en une seule requête
    progressEl.textContent = `Enregistrement de ${bulkImportParsedRows.length} produit(s)...`;
    const { error } = await supabaseClient.from('products').insert(bulkImportParsedRows);

    btn.disabled = false;
    progressEl.style.display = 'none';

    if (error){
      alert("Erreur lors de l'import : " + error.message);
      btn.textContent = `Importer ${bulkImportParsedRows.length} produit(s)`;
      return;
    }

    await loadAdminData();
    renderProductTable();
    renderDashboard();
    closeBulkImportModal();
    alert(`${bulkImportParsedRows.length} produit(s) importé(s) avec succès.`);
  });
}

function formatFCFA(n){
  return Math.round(n).toLocaleString('fr-FR').replace(/,/g, ' ') + ' FCFA';
}

/* =========================================================
   SIDEBAR MOBILE (menu tiroir)
   ========================================================= */
function initSidebarToggle(){
  const sidebar = document.getElementById('admin-sidebar');
  const overlay = document.getElementById('admin-sidebar-overlay');
  const toggleBtn = document.getElementById('admin-sidebar-toggle');
  if (!sidebar || !toggleBtn) return;

  function openSidebar(){ sidebar.classList.add('open'); overlay.classList.add('show'); }
  function closeSidebar(){ sidebar.classList.remove('open'); overlay.classList.remove('show'); }

  toggleBtn.addEventListener('click', openSidebar);
  overlay.addEventListener('click', closeSidebar);
  // Referme automatiquement le tiroir après avoir choisi un onglet (mobile)
  sidebar.querySelectorAll('button[data-tab]').forEach(function(btn){
    btn.addEventListener('click', closeSidebar);
  });
}
