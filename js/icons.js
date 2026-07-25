/* =========================================================
   PrecoTech237 — Icônes SVG (remplacent les émojis)
   Usage : <span class="ic-inline" data-icon="check"></span>
           <div class="icon-badge" data-icon="chat"></div>
   ========================================================= */

const ICONS = {
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  truck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.4 8.4 8.5 8.5 0 0 1-3.8-.9L3 20l1.1-5a8.3 8.3 0 0 1-.9-3.8A8.4 8.4 0 0 1 11.6 3 8.4 8.4 0 0 1 21 11.5z"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`,
  target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none"/></svg>`,
  handshake: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2 12 4-4 4.5 4.5L12 11l3 3 4-4 3 3"/><path d="M9 14l2 2 3-3"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></svg>`,
  laptop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="10" rx="1"/><path d="M2 18h20l-1.5-2H3.5L2 18z"/></svg>`,
  gaming: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="12" rx="1"/><path d="M8 20h8M12 17v3"/><circle cx="8" cy="11" r="1"/><circle cx="16" cy="11" r="1"/></svg>`,
  mobile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>`,
  ship: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15h18l-2 5H5z"/><path d="M5 15V9h3l2-4h4l2 4h3v6"/><path d="M12 5v0"/></svg>`,
  plane: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13 21 5l-6.5 16-3-6-6.5-2z"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h6l-2 8 12-14h-7l1-6z"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5c0 8.3 6.7 15 15 15l3-4-6-2-2 2c-2.5-1.2-4.8-3.5-6-6l2-2-2-6z"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3.5 6 8.5 7 8.5-7"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.7 7-12a7 7 0 1 0-14 0c0 5.3 7 12 7 12z"/><circle cx="12" cy="9" r="2.3"/></svg>`
};

document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('[data-icon]').forEach(function(el){
    const name = el.getAttribute('data-icon');
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });
});
