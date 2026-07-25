/* =========================================================
   PrecoTech237 — Avis clients (avec photos)
   Fonctionne indépendamment du chargement des produits :
   ne nécessite que supabaseClient (déjà disponible dès le
   chargement de js/supabase-config.js).
   ========================================================= */

document.addEventListener('DOMContentLoaded', function(){
  const productId = getUrlParam('id');
  if (!productId) return;
  loadReviews(productId);
  bindReviewForm(productId);
});

function escapeHtmlReview(str){
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function loadReviews(productId){
  const list = document.getElementById('reviews-list');
  if (!list) return;
  list.innerHTML = '<p>Chargement des avis...</p>';

  const { data, error } = await supabaseClient
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error){
    list.innerHTML = '<p>Impossible de charger les avis pour le moment.</p>';
    return;
  }

  renderReviewsSummary(data || []);

  if (!data || !data.length){
    list.innerHTML = '<p>Aucun avis pour le moment. Soyez le premier à donner votre avis !</p>';
    return;
  }

  list.innerHTML = data.map(function(r){
    const stars = '★'.repeat(r.note) + '☆'.repeat(5 - r.note);
    const photosHtml = (r.photos || []).map(function(url){
      return `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="Photo client" class="review-photo" loading="lazy"></a>`;
    }).join('');
    const date = r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '';

    return `
    <div class="review-card">
      <div class="review-head">
        <b>${escapeHtmlReview(r.nom)}</b>
        <span class="review-stars">${stars}</span>
      </div>
      ${r.commentaire ? `<p style="margin-bottom:0;">${escapeHtmlReview(r.commentaire)}</p>` : ''}
      ${photosHtml ? `<div class="review-photos">${photosHtml}</div>` : ''}
      <div class="review-date">${date}</div>
    </div>`;
  }).join('');
}

function renderReviewsSummary(reviews){
  const el = document.getElementById('reviews-summary');
  if (!el) return;
  if (!reviews.length){ el.innerHTML = 'Aucun avis pour le moment.'; return; }
  const avg = reviews.reduce(function(sum, r){ return sum + r.note; }, 0) / reviews.length;
  const rounded = Math.round(avg);
  const stars = '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
  el.innerHTML = `<span class="review-stars-big">${stars}</span> <b>${avg.toFixed(1)}/5</b> · ${reviews.length} avis`;
}

function bindReviewForm(productId){
  const form = document.getElementById('review-form');
  if (!form) return;

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';

    try{
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

        const { error: upErr } = await supabaseClient.storage
          .from('review-photos')
          .upload(path, file);

        if (upErr){
          console.error('Erreur upload photo :', upErr);
          continue; // on continue avec les autres photos plutôt que d'échouer tout l'avis
        }

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

      if (error){ throw error; }

      form.reset();
      const success = document.getElementById('review-success');
      if (success){
        success.classList.add('show');
        setTimeout(function(){ success.classList.remove('show'); }, 3500);
      }
      loadReviews(productId);

    } catch(err){
      alert("Erreur lors de l'envoi de votre avis : " + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}
