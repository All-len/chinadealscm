/* =========================================================
   PrecoTech237 — Démarrage de la page
   ---------------------------------------------------------
   Ne charge QUE les données légères (contact + tarifs transport)
   sur TOUTES les pages. Le catalogue produit n'est PAS chargé ici :
   chaque page qui en a besoin (index.html, produits.html,
   produit.html, commander.html) le charge elle-même via les
   fonctions fetchProductsPage / fetchFeaturedProducts /
   fetchProductById / fetchSimilarProducts définies dans js/data.js,
   une fois que l'évènement 'sitedata:ready' (déclenché ici) a eu
   lieu.
   ========================================================= */

document.addEventListener('DOMContentLoaded', async function(){
  await loadSettings();
  renderWaFloat();
  renderContactInfo();
  renderStaticWaLinks();
  renderAccountNav();
  document.dispatchEvent(new Event('sitedata:ready'));
});
