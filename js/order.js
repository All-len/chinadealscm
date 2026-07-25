/* =========================================================
   PrecoTech237 — Traitement du formulaire de commande
   Envoi vers WhatsApp (lien wa.me) + copie par e-mail (mailto)
   ---------------------------------------------------------
   Remarque : un site 100% statique ne peut pas envoyer un e-mail
   "en silence" depuis le serveur (il faut un serveur ou un service
   tiers). Deux solutions sont proposées :
   1) Solution immédiate (par défaut ici) : le formulaire ouvre le
      client e-mail du visiteur avec le message déjà rempli (mailto:).
   2) Solution automatique recommandée : brancher ce formulaire sur
      WordPress + WooCommerce (avec un plugin d'e-mail comme WP Mail
      SMTP) ou sur un service comme Formspree / EmailJS pour un envoi
      100% automatique sans action du client. Voir la partie
      "WordPress / WooCommerce" fournie séparément.
   ========================================================= */

function buildOrderMessage(data){
  return (
`Nouvelle commande - PrecoTech237

Nom : ${data.nom}
Téléphone : ${data.telephone}
E-mail : ${data.email}
Produit : ${data.produit}
Quantité : ${data.quantite}
Mode de transport : ${data.transportLabel}${data.estimation ? '\n' + data.estimation : ''}
Adresse de livraison : ${data.adresse}
${data.message ? '\nMessage : ' + data.message : ''}`
  );
}

document.addEventListener('sitedata:ready', function(){
  const form = document.getElementById('order-form');
  if (!form) return;

  // Pré-remplir le produit si arrivée depuis une fiche produit (?produit=...)
  const produitParam = getUrlParam('produit');
  if (produitParam){
    const produitField = form.querySelector('[name="produit"]');
    if (produitField) produitField.value = decodeURIComponent(produitParam);
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();

    const fd = new FormData(form);
    const transportInput = form.querySelector('input[name="transport"]:checked');
    const transportMode = TRANSPORT_MODES.find(t => t.id === (transportInput ? transportInput.value : ''));
    const produitId = fd.get('produitId');
    const quantite = fd.get('quantite') || '1';
    const linkedProduct = produitId ? PRODUCTS.find(p => p.id === produitId) : null;

    let estimation = '';
    if (linkedProduct && transportMode){
      const frais = calcTransportCost(linkedProduct, transportMode.id, quantite);
      const sousTotal = linkedProduct.prix * (Number(quantite) || 1);
      estimation = `Sous-total produit : ${formatFCFA(sousTotal)} | Frais transport estimés : ${formatFCFA(frais)} | Total estimé : ${formatFCFA(sousTotal + frais)}`;
    }

    const data = {
      nom: fd.get('nom') || '',
      telephone: fd.get('telephone') || '',
      email: fd.get('email') || '',
      produit: fd.get('produit') || '',
      quantite: quantite,
      transportLabel: transportMode ? `${transportMode.label} (${transportMode.delai})` : 'Non précisé',
      estimation: estimation,
      adresse: fd.get('adresse') || '',
      message: fd.get('message') || ''
    };

    const texte = buildOrderMessage(data);

    // 1) Ouvre WhatsApp avec le message prérempli
    const waUrl = `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent(texte)}`;
    window.open(waUrl, '_blank');

    // 2) Prépare le lien e-mail (mailto) — le visiteur peut l'envoyer en un clic
    const mailUrl = `mailto:${CONTACT.email}?subject=${encodeURIComponent('Nouvelle commande - PrecoTech237')}&body=${encodeURIComponent(texte)}`;
    const emailBtn = document.getElementById('send-email-copy');
    if (emailBtn) emailBtn.href = mailUrl;

    // Affiche le message de confirmation
    const success = document.getElementById('form-success');
    if (success) success.classList.add('show');

    form.reset();
  });
});
