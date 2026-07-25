/* =========================================================
   PrecoTech237 — Démarrage de la page
   Charge les données (produits, contact, transport) depuis
   Supabase, puis prévient le reste du site que c'est prêt.
   ========================================================= */

document.addEventListener('DOMContentLoaded', async function(){
  await loadSiteData();
  renderWaFloat();
  document.dispatchEvent(new Event('sitedata:ready'));
});
