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

  form.addEventListener('submit', function(e){
    e.preventDefault();

    const fd = new FormData(form);
    const transportInput = form.querySelector('input[name="transport"]:checked');
    const transportMode = TRANSPORT_MODES.find(t => t.id === (transportInput ? transportInput.value : ''));
    const produitId = fd.get('produitId');
    const quantite = fd.get('quantite') || '1';
    const linkedProduct = produitId ? PRODUCTS.find(p => p.id === produitId) : null;

    // Le prix unitaire est celui de la variante choisie sur la fiche produit si transmis,
    // sinon le prix de base du produit lié.
    const prixUnitaireParam = fd.get('prixUnitaire');
    const prixUnitaire = prixUnitaireParam ? Number(prixUnitaireParam) : (linkedProduct ? linkedProduct.prix : null);

    let estimation = '';
    if (linkedProduct && transportMode && prixUnitaire != null){
      const frais = calcTransportCost(linkedProduct, transportMode.id, quantite);
      const sousTotal = prixUnitaire * (Number(quantite) || 1);
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

    // 1) Ouvre WhatsApp immédiatement (synchrone, pour éviter que le navigateur
    //    bloque la pop-up si on attendait la réponse de la base de données avant)
    const waUrl = `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent(texte)}`;
    window.open(waUrl, '_blank');

    // 2) Prépare le lien e-mail (mailto) — le visiteur peut l'envoyer en un clic
    const mailUrl = `mailto:${CONTACT.email}?subject=${encodeURIComponent('Nouvelle commande - PrecoTech237')}&body=${encodeURIComponent(texte)}`;
    const emailBtn = document.getElementById('send-email-copy');
    if (emailBtn) emailBtn.href = mailUrl;

    // 3) Enregistre la commande dans Supabase pour qu'elle apparaisse dans
    //    l'espace admin (onglet "Commandes"), avec un statut modifiable.
    //    Se fait en arrière-plan : si ça échoue (ex: pas de réseau), la
    //    commande reste tout de même transmise via WhatsApp/e-mail ci-dessus.
    let coutProduit = null, coutTransport = null, coutTotal = null;
    if (linkedProduct && transportMode && prixUnitaire != null){
      coutProduit = prixUnitaire * (Number(quantite) || 1);
      coutTransport = calcTransportCost(linkedProduct, transportMode.id, quantite);
      coutTotal = coutProduit + (coutTransport || 0);
    }
    supabaseClient.from('orders').insert({
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
    }).select().single().then(function(res){
      if (res.error){
        console.error('Erreur enregistrement commande (Supabase) :', res.error);
        return;
      }
      // Affiche le lien de suivi que le client peut enregistrer/mettre en favoris
      const trackingUrl = `${window.location.origin}/suivi.html?id=${res.data.id}`;
      const wrap = document.getElementById('tracking-link-wrap');
      const link = document.getElementById('tracking-link');
      if (wrap && link){
        link.href = trackingUrl;
        link.textContent = trackingUrl;
        wrap.style.display = 'block';
      }
    });

    // Affiche le message de confirmation
    const success = document.getElementById('form-success');
    if (success) success.classList.add('show');

    form.reset();
  });
});
