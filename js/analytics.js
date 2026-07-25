/* =========================================================
   PrecoTech237 — Google Analytics (GA4)
   ---------------------------------------------------------
   Remplacez la valeur ci-dessous par votre identifiant de mesure
   (Measurement ID), du type "G-XXXXXXXXXX", que vous trouvez dans
   Google Analytics > Admin > Flux de données > votre site web.
   Voir GUIDE-ANALYTICS.md pour la marche à suivre complète.

   Si GA_MEASUREMENT_ID reste vide, le suivi est simplement désactivé
   (aucune erreur, le site fonctionne normalement) — pratique pour
   tester en local sans polluer vos statistiques.
   ========================================================= */

const GA_MEASUREMENT_ID = ""; // Ex : "G-ABC1234XYZ"

(function initAnalytics(){
  if (!GA_MEASUREMENT_ID) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID);
})();
