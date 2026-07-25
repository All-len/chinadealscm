/* =========================================================
   PrecoTech237 — Apparition en douceur au défilement
   ========================================================= */

(function(){
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supported = 'IntersectionObserver' in window;
  let obs = null;

  if (supported && !reduced){
    obs = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting){
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  }

  // Observe tout élément .reveal pas encore traité (marqué data-reveal-bound)
  window.watchReveal = function(){
    document.querySelectorAll('.reveal:not([data-reveal-bound])').forEach(function(e, i){
      e.setAttribute('data-reveal-bound', '1');
      if (!obs){ e.classList.add('in-view'); return; }
      e.style.transitionDelay = Math.min(i % 4, 3) * 0.06 + 's';
      obs.observe(e);
    });
  };

  document.addEventListener('DOMContentLoaded', window.watchReveal);

  // Filet de sécurité : capte les cartes injectées après coup (ex: filtrage du catalogue)
  new MutationObserver(function(){ window.watchReveal(); })
    .observe(document.body, { childList:true, subtree:true });
})();
