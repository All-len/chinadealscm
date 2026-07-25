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
  initTabs();
  initModal();
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
    tbody.innerHTML = '<tr><td colspan="5">Aucun produit pour le moment. Cliquez sur « Ajouter un produit ».</td></tr>';
    return;
  }

  const catLabels = { 'laptops':'Laptops', 'pc-gaming':'PC Gaming', 'telephones':'Téléphones' };

  tbody.innerHTML = adminProducts.map(function(p){
    const poidsVol = p.poidsKg
      ? `${p.poidsKg} kg${(p.longueurCm && p.largeurCm && p.hauteurCm) ? ` · ${calcCBM(p).toFixed(3)} CBM` : ''}`
      : '—';
    return `<tr>
      <td><b>${escapeHtml(p.nom)}</b></td>
      <td>${catLabels[p.categorie] || p.categorie}</td>
      <td>${Number(p.prix).toLocaleString('fr-FR')} FCFA</td>
      <td>${poidsVol}</td>
      <td>${p.badge ? escapeHtml(p.badge) : '—'}</td>
      <td>
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
  document.getElementById('product-form').addEventListener('submit', submitProductForm);
  bindMediaUploads();

  document.getElementById('product-modal').addEventListener('click', function(e){
    if (e.target === this) closeProductModal();
  });
}

function openProductModal(id){
  editingProductId = id;
  const form = document.getElementById('product-form');
  form.reset();
  document.getElementById('spec-rows').innerHTML = '';
  document.getElementById('p-video-status').textContent = '';

  if (id){
    const p = adminProducts.find(x => x.id === id);
    document.getElementById('modal-title').textContent = 'Modifier le produit';
    document.getElementById('p-id').value = p.id;
    document.getElementById('p-nom').value = p.nom;
    document.getElementById('p-categorie').value = p.categorie;
    document.getElementById('p-prix').value = p.prix;
    document.getElementById('p-badge').value = p.badge || '';
    document.getElementById('p-etat').value = p.etat || '';
    document.getElementById('p-description').value = p.description || '';
    document.getElementById('p-poids').value = p.poidsKg || '';
    document.getElementById('p-longueur').value = p.longueurCm || '';
    document.getElementById('p-largeur').value = p.largeurCm || '';
    document.getElementById('p-hauteur').value = p.hauteurCm || '';
    document.getElementById('p-video-url').value = p.videoUrl || '';
    currentProductImages = (p.images || []).slice();
    currentUploadFolder = p.id;
    (p.specs || []).forEach(function(s){ addSpecRow(s[0], s[1]); });
  } else {
    document.getElementById('modal-title').textContent = 'Ajouter un produit';
    document.getElementById('p-id').value = '';
    document.getElementById('p-video-url').value = '';
    currentProductImages = [];
    currentUploadFolder = 'new-' + Date.now();
    addSpecRow('', '');
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

function slugify(text){
  return text.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 30);
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
  const categorie = document.getElementById('p-categorie').value;
  const catLabels = { 'laptops':'Laptops', 'pc-gaming':'PC Gaming', 'telephones':'Téléphones' };

  // Colonnes en snake_case pour correspondre au schéma Supabase
  const row = {
    id: existingId || (slugify(nom) + '-' + Date.now().toString().slice(-5)),
    nom: nom,
    categorie: categorie,
    categorie_label: catLabels[categorie],
    prix: Number(document.getElementById('p-prix').value),
    etat: document.getElementById('p-etat').value.trim(),
    badge: document.getElementById('p-badge').value.trim(),
    description: document.getElementById('p-description').value.trim(),
    specs: specs,
    poids_kg: document.getElementById('p-poids').value ? Number(document.getElementById('p-poids').value) : null,
    longueur_cm: document.getElementById('p-longueur').value ? Number(document.getElementById('p-longueur').value) : null,
    largeur_cm: document.getElementById('p-largeur').value ? Number(document.getElementById('p-largeur').value) : null,
    hauteur_cm: document.getElementById('p-hauteur').value ? Number(document.getElementById('p-hauteur').value) : null,
    images: currentProductImages,
    video_url: document.getElementById('p-video-url').value.trim() || null
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
      <td>${escapeHtml(product ? product.nom : r.product_id)}</td>
      <td>${escapeHtml(r.nom)}</td>
      <td style="color:#F5A623; letter-spacing:1px;">${stars}</td>
      <td style="max-width:220px;">${escapeHtml(r.commentaire || '—')}</td>
      <td><div style="display:flex; gap:4px; flex-wrap:wrap;">${photosHtml || '—'}</div></td>
      <td>${date}</td>
      <td><button class="danger" data-action="delete-review" data-id="${r.id}">Supprimer</button></td>
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
