/* =========================================================
   PrecoTech237 — Traitement du formulaire de commande
   ---------------------------------------------------------
   La commande est enregistrée dans Supabase, puis le client est
   redirigé vers confirmation.html où il voit le récapitulatif
   complet de sa commande et un lien de suivi. Le message WhatsApp
   n'est plus envoyé automatiquement : un bouton facultatif est
   proposé sur la page de confirmation pour ceux qui souhaitent
   contacter un conseiller tout de suite.
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

let loggedInCustomerId = null;

document.addEventListener('sitedata:ready', async function(){
  const form = document.getElementById('order-form');
  if (!form) return;

  // Pré-remplir le produit si arrivée depuis une fiche produit (?produit=...)
  const produitParam = getUrlParam('produit');
  if (produitParam){
    const produitField = form.querySelector('[name="produit"]');
    if (produitField) produitField.value = decodeURIComponent(produitParam);
  }

  // Si le client est connecté : pré-remplir ses informations depuis son profil
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session){
    loggedInCustomerId = session.user.id;
    const { data: profile } = await supabaseClient
      .from('customer_profiles').select('*').eq('id', session.user.id).maybeSingle();

    form.querySelector('[name="email"]').value = session.user.email || '';
    if (profile){
      if (profile.nom) form.querySelector('[name="nom"]').value = profile.nom;
      if (profile.telephone) form.querySelector('[name="telephone"]').value = profile.telephone;
      if (profile.adresse || profile.ville){
        form.querySelector('[name="adresse"]').value = [profile.ville, profile.adresse].filter(Boolean).join(' — ');
      }
    }

    const note = document.createElement('p');
    note.style.cssText = 'font-size:.82rem; color:var(--green-dark); margin:-10px 0 18px; font-weight:600;';
    note.textContent = '✓ Vos informations ont été pré-remplies depuis votre compte.';
    form.insertBefore(note, form.firstChild);
  }

  form.addEventListener('submit', async function(e){
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enregistrement de votre commande...';

    const fd = new FormData(form);
    const transportInput = form.querySelector('input[name="transport"]:checked');
    const transportMode = TRANSPORT_MODES.find(t => t.id === (transportInput ? transportInput.value : ''));
    const produitId = fd.get('produitId');
    const quantite = fd.get('quantite') || '1';
    // Chargé par commander.html (fetchProductById) au chargement de la page,
    // plutôt que recherché dans un catalogue global non chargé en entier.
    const linkedProduct = produitId ? window.linkedProduct : null;

    // Le prix unitaire est celui de la variante choisie sur la fiche produit si transmis,
    // sinon le prix de base du produit lié.
    const prixUnitaireParam = fd.get('prixUnitaire');
    const prixUnitaire = prixUnitaireParam ? Number(prixUnitaireParam) : (linkedProduct ? linkedProduct.prix : null);

    let estimation = '';
    let coutProduit = null, coutTransport = null, coutTotal = null;
    if (linkedProduct && transportMode && prixUnitaire != null){
      coutTransport = calcTransportCost(linkedProduct, transportMode.id, quantite);
      coutProduit = prixUnitaire * (Number(quantite) || 1);
      coutTotal = coutProduit + (coutTransport || 0);
      estimation = `Sous-total produit : ${formatFCFA(coutProduit)} | Frais transport estimés : ${formatFCFA(coutTransport)} | Total estimé : ${formatFCFA(coutTotal)}`;
    }

    const data = {
      nom: fd.get('nom') || '',
      telephone: fd.get('telephone') || '',
      email: fd.get('email') || '',
      produit: fd.get('produit') || '',
      quantite: quantite,
      transportLabel: transportMode ? `${transportMode.label} (${transportMode.delai})` : 'Non précisé',
      estimation: estimation,
      coutProduit: coutProduit,
      coutTransport: coutTransport,
      coutTotal: coutTotal,
      adresse: fd.get('adresse') || '',
      message: fd.get('message') || ''
    };

    const texte = buildOrderMessage(data);

    // Enregistre la commande dans Supabase pour qu'elle apparaisse dans
    // l'espace admin (onglet "Commandes"), avec un statut modifiable, et
    // pour récupérer son identifiant (utilisé par la page de confirmation
    // et le lien de suivi).
    const res = await supabaseClient.from('orders').insert({
      nom: data.nom,
      telephone: data.telephone,
      email: data.email,
      produit_id: produitId || null,
      produit_nom: data.produit,
      quantite: Number(quantite) || 1,
      transport_id: transportMode ? transportMode.id : null,
      transport_label: data.transportLabel,
      cout_produit: coutProduit,
      cout_transport: coutTransport,
      cout_total: coutTotal,
      adresse: data.adresse,
      message: data.message || null,
      customer_id: loggedInCustomerId
    }).select().single();

    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;

    if (res.error){
      console.error('Erreur enregistrement commande (Supabase) :', res.error);
      alert("Une erreur est survenue lors de l'enregistrement de votre commande. Vérifiez votre connexion puis réessayez, ou contactez-nous directement sur WhatsApp si le problème persiste.");
      return;
    }

    // Le récapitulatif est transmis à confirmation.html via sessionStorage
    // (propre au navigateur du client, pas besoin de relire Supabase avec
    // des colonnes sensibles côté page publique).
    sessionStorage.setItem('lastOrder', JSON.stringify({
      orderId: res.data.id,
      nom: data.nom,
      telephone: data.telephone,
      email: data.email,
      produit: data.produit,
      quantite: data.quantite,
      transportLabel: data.transportLabel,
      coutProduit: data.coutProduit,
      coutTransport: data.coutTransport,
      coutTotal: data.coutTotal,
      adresse: data.adresse,
      message: data.message,
      waMessage: texte
    }));

    window.location.href = 'confirmation.html?id=' + res.data.id;
  });
});
