/* =========================================================
   PrecoTech237 — Script principal
   ========================================================= */

function formatFCFA(n){
  return n.toLocaleString('fr-FR').replace(/,/g,' ') + ' FCFA';
}

/* --- Menu mobile (ne dépend pas des données, s'exécute immédiatement) --- */
document.addEventListener('DOMContentLoaded', function(){
  const burger = document.querySelector('.burger');
  const nav = document.querySelector('nav.main-nav');
  if (burger && nav){
    burger.addEventListener('click', function(){
      nav.classList.toggle('open');
    });
  }
});

/* --- Bouton WhatsApp flottant (appelé par js/app-init.js une fois les données chargées) --- */
function renderWaFloat(){
  if (document.querySelector('.wa-float')) return;
  const waLink = document.createElement('a');
  waLink.href = `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent('Bonjour PrecoTech237, je souhaite avoir des informations sur vos produits.')}`;
  waLink.target = '_blank';
  waLink.rel = 'noopener';
  waLink.className = 'wa-float';
  waLink.setAttribute('aria-label', 'Discuter sur WhatsApp');
  waLink.innerHTML = `<svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 3C9 3 3.3 8.7 3.3 15.7c0 2.5.7 4.9 2 7L3 29l6.5-2.2c2 .1 4.1.2 6.5.2 7 0 12.7-5.7 12.7-12.7C28.7 8.7 23 3 16 3zm0 23.1c-2.1 0-4.1-.6-5.8-1.6l-.4-.2-3.9 1.3 1.3-3.8-.3-.4c-1.1-1.8-1.7-3.8-1.7-5.9 0-6 4.9-10.9 10.8-10.9 5.9 0 10.8 4.9 10.8 10.9S21.9 26.1 16 26.1zm5.9-8.1c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-2-1.8-2.3-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.2 3.4 5.4 4.7.8.3 1.4.5 1.8.7.8.2 1.5.2 2 .1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.3.2-1.5-.1-.1-.3-.2-.6-.4z"/></svg>`;
  document.body.appendChild(waLink);
}

/* --- Rendu d'une carte produit (utilisé en accueil et catalogue) --- */
function productCardHTML(p){
  const hasImage = p.images && p.images.length > 0;
  const thumbContent = hasImage
    ? `<img src="${p.images[0]}" alt="${p.nom}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">`
    : productIconSVG(p.categorie);
  return `
  <a class="card product-card reveal" href="produit.html?id=${p.id}" style="color:inherit;">
    <div class="thumb">
      ${p.badge ? `<span class="badge-tag">${p.badge}</span>` : ''}
      ${thumbContent}
    </div>
    <div class="body">
      <div class="cat">${p.categorieLabel}</div>
      <h3>${p.nom}</h3>
      <div class="price">${formatFCFA(p.prix)} <small>selon transport</small></div>
      <span class="btn btn-outline btn-block">Voir le produit</span>
    </div>
  </a>`;
}

function productIconSVG(categorie){
  const icons = {
    'laptops': `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#1B4F8C" stroke-width="1.5"><rect x="4" y="4" width="16" height="10" rx="1"/><path d="M2 18h20l-1.5-2H3.5L2 18z"/></svg>`,
    'pc-gaming': `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#1B4F8C" stroke-width="1.5"><rect x="3" y="5" width="18" height="12" rx="1"/><path d="M8 20h8M12 17v3"/><circle cx="8" cy="11" r="1"/><circle cx="16" cy="11" r="1"/></svg>`,
    'telephones': `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#1B4F8C" stroke-width="1.5"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>`
  };
  return icons[categorie] || icons['laptops'];
}

/* --- Filtrage du catalogue (utilisé sur produits.html) --- */
function filterProducts(categorie, tri){
  let list = [...PRODUCTS];
  if (categorie && categorie !== 'all') list = list.filter(p => p.categorie === categorie);
  if (tri === 'prix-asc') list.sort((a,b)=>a.prix-b.prix);
  if (tri === 'prix-desc') list.sort((a,b)=>b.prix-a.prix);
  return list;
}

/* --- Lecture d'un paramètre d'URL --- */
function getUrlParam(name){
  return new URLSearchParams(window.location.search).get(name);
}
