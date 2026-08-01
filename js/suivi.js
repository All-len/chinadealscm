/* =========================================================
   PrecoTech237 — Suivi de commande client
   ---------------------------------------------------------
   Sécurité : cette page n'utilise jamais de lecture directe sur
   la table "orders" (qui est réservée à l'admin). Elle passe par
   des fonctions Supabase dédiées (get_order_tracking /
   mark_order_received) qui ne renvoient jamais que les infos
   d'UNE commande précise (celle dont on connaît déjà l'identifiant
   dans le lien), jamais les données sensibles des autres clients.
   ========================================================= */

const TRACKING_STEPS = [
  { key: 'en_attente', label: 'Commande reçue', desc: 'Nous avons bien reçu votre commande.' },
  { key: 'confirmee',  label: 'Commande confirmée', desc: 'Votre commande a été validée par notre équipe.' },
  { key: 'expediee',   label: 'Commande expédiée', desc: 'Votre colis est en route vers vous.' },
  { key: 'livree',     label: 'Commande livrée', desc: 'Vous avez reçu votre commande.' }
];

document.addEventListener('sitedata:ready', async function(){
  const orderId = getUrlParam('id');
  const loadingEl = document.getElementById('tracker-loading');
  const errorEl = document.getElementById('tracker-error');
  const contentEl = document.getElementById('tracker-content');

  if (!orderId){
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    return;
  }

  // Le bouton de contact de la page d'erreur utilise le vrai numéro WhatsApp
  const errorWaBtn = errorEl.querySelector('a');
  if (errorWaBtn) errorWaBtn.href = `https://wa.me/${CONTACT.whatsappNumber}`;

  const order = await fetchOrderTracking(orderId);
  loadingEl.style.display = 'none';

  if (!order){
    errorEl.style.display = 'block';
    return;
  }

  contentEl.style.display = 'block';
  renderTracker(order);
});

async function fetchOrderTracking(orderId){
  const { data, error } = await supabaseClient.rpc('get_order_tracking', { p_order_id: orderId });
  if (error || !data || !data.length) return null;
  return data[0];
}

function renderTracker(order){
  document.getElementById('tp-nom').textContent = order.produit_nom;
  document.getElementById('tp-qte').textContent = order.quantite;
  document.getElementById('tp-date').textContent = order.created_at
    ? new Date(order.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })
    : '';

  const stepsContainer = document.getElementById('steps-container');
  const actionEl = document.getElementById('tracker-action');
  const cancelledBanner = document.getElementById('tracker-cancelled-banner');

  if (order.statut === 'annulee'){
    cancelledBanner.style.display = 'block';
    stepsContainer.style.display = 'none';
    actionEl.style.display = 'none';
    return;
  }

  const currentIndex = TRACKING_STEPS.findIndex(function(s){ return s.key === order.statut; });

  stepsContainer.innerHTML = TRACKING_STEPS.map(function(step, i){
    let cls = '';
    let marker = i + 1;
    if (i < currentIndex){ cls = 'done'; marker = '✓'; }
    else if (i === currentIndex){ cls = 'current'; }
    return `<div class="step-v ${cls}">
      <div class="marker"><div class="dot">${marker}</div><div class="line"></div></div>
      <div class="content"><h4>${step.label}</h4><p>${step.desc}</p></div>
    </div>`;
  }).join('');

  if (order.statut === 'expediee'){
    actionEl.style.display = 'block';
    actionEl.innerHTML = `
      <p style="margin-bottom:14px;">Vous avez bien reçu votre colis ?</p>
      <button type="button" class="btn btn-primary" id="btn-mark-received">J'ai reçu ma commande</button>
    `;
    document.getElementById('btn-mark-received').addEventListener('click', function(){
      handleMarkReceived(order, this);
    });
  } else {
    actionEl.style.display = 'none';
  }

  if (order.statut === 'livree'){
    revealReviewForm(order.produit_id);
  }
}

async function handleMarkReceived(order, btn){
  btn.disabled = true;
  btn.textContent = 'Confirmation...';

  const { data, error } = await supabaseClient.rpc('mark_order_received', { p_order_id: order.id });

  if (error || !data){
    alert("Une erreur est survenue. Réessayez, ou contactez-nous si le problème persiste.");
    btn.disabled = false;
    btn.textContent = "J'ai reçu ma commande";
    return;
  }

  order.statut = 'livree';
  renderTracker(order);
}

function revealReviewForm(productId){
  const section = document.getElementById('tracker-review-section');
  section.style.display = 'block';
  bindReviewFormOnTracker(productId);
}

/* ---------- Formulaire d'avis (même logique que sur la fiche produit) ---------- */
function bindReviewFormOnTracker(productId){
  const form = document.getElementById('review-form');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';

    try {
      const nom = form.querySelector('[name="nom"]').value.trim();
      const noteChecked = form.querySelector('input[name="note"]:checked');
      const note = noteChecked ? Number(noteChecked.value) : 5;
      const commentaire = form.querySelector('[name="commentaire"]').value.trim();
      const fileInput = form.querySelector('[name="photos"]');
      const files = fileInput.files;

      const photoUrls = [];
      for (let i = 0; i < files.length && i < 4; i++){
        const file = files[i];
        const safeName = file.name.replace(/[^a-zA-Z0-9.]+/g, '-');
        const path = `${productId}/${Date.now()}-${i}-${safeName}`;

        const { error: upErr } = await supabaseClient.storage.from('review-photos').upload(path, file);
        if (upErr){ console.error('Erreur upload photo :', upErr); continue; }

        const { data: pub } = supabaseClient.storage.from('review-photos').getPublicUrl(path);
        if (pub && pub.publicUrl) photoUrls.push(pub.publicUrl);
      }

      const { error } = await supabaseClient.from('reviews').insert({
        product_id: productId,
        nom: nom,
        note: note,
        commentaire: commentaire,
        photos: photoUrls
      });
      if (error) throw error;

      form.reset();
      const success = document.getElementById('review-success');
      success.classList.add('show');
      setTimeout(function(){ success.classList.remove('show'); }, 3500);

    } catch(err){
      alert("Erreur lors de l'envoi de votre avis : " + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}
