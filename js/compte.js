/* =========================================================
   PrecoTech237 — Compte client
   ========================================================= */

document.addEventListener('DOMContentLoaded', async function(){
  // Onglets Connexion / Inscription
  document.querySelectorAll('.auth-tabs button').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    });
  });

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session){
    showProfile(session);
  } else {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('profile-section').style.display = 'none';
  }

  // Connexion
  document.getElementById('login-form').addEventListener('submit', async function(e){
    e.preventDefault();
    const fd = new FormData(this);
    const errorBox = document.getElementById('login-error-box');
    errorBox.style.display = 'none';

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: fd.get('email'), password: fd.get('password')
    });
    if (error){
      errorBox.textContent = 'E-mail ou mot de passe incorrect.';
      errorBox.style.display = 'block';
      return;
    }
    showProfile(data.session);
  });

  // Inscription
  document.getElementById('signup-form').addEventListener('submit', async function(e){
    e.preventDefault();
    const fd = new FormData(this);
    const errorBox = document.getElementById('signup-error-box');
    errorBox.style.display = 'none';

    const { data, error } = await supabaseClient.auth.signUp({
      email: fd.get('email'), password: fd.get('password')
    });
    if (error){
      errorBox.textContent = "Impossible de créer le compte : " + error.message;
      errorBox.style.display = 'block';
      return;
    }

    // Crée immédiatement le profil associé (nom saisi à l'inscription)
    if (data.user){
      await supabaseClient.from('customer_profiles').upsert({
        id: data.user.id, nom: fd.get('nom')
      });
    }

    if (data.session){
      showProfile(data.session);
    } else {
      // Selon la configuration Supabase, une confirmation par e-mail peut être requise
      errorBox.style.display = 'block';
      errorBox.style.background = 'rgba(31,157,85,.08)';
      errorBox.style.color = 'var(--green-dark)';
      errorBox.textContent = 'Compte créé ! Si une confirmation par e-mail est requise, vérifiez votre boîte de réception, puis connectez-vous.';
    }
  });

  // Déconnexion
  document.getElementById('btn-logout').addEventListener('click', async function(){
    await supabaseClient.auth.signOut();
    window.location.reload();
  });

  // Mise à jour du profil
  document.getElementById('profile-form').addEventListener('submit', async function(e){
    e.preventDefault();
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const payload = {
      id: session.user.id,
      nom: document.getElementById('pf-nom').value.trim(),
      telephone: document.getElementById('pf-telephone').value.trim(),
      ville: document.getElementById('pf-ville').value.trim(),
      adresse: document.getElementById('pf-adresse').value.trim(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseClient.from('customer_profiles').upsert(payload);
    if (error){ alert('Erreur : ' + error.message); return; }

    document.getElementById('account-name').textContent = payload.nom || session.user.email;
    document.getElementById('account-initial').textContent = (payload.nom || session.user.email).charAt(0).toUpperCase();

    const note = document.getElementById('profile-saved-note');
    note.classList.add('show');
    setTimeout(function(){ note.classList.remove('show'); }, 2500);
  });
});

async function showProfile(session){
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('profile-section').style.display = 'block';

  document.getElementById('account-email').textContent = session.user.email;

  const { data: profile } = await supabaseClient
    .from('customer_profiles').select('*').eq('id', session.user.id).maybeSingle();

  const nom = (profile && profile.nom) || session.user.email;
  document.getElementById('account-name').textContent = nom;
  document.getElementById('account-initial').textContent = nom.charAt(0).toUpperCase();

  if (profile){
    document.getElementById('pf-nom').value = profile.nom || '';
    document.getElementById('pf-telephone').value = profile.telephone || '';
    document.getElementById('pf-ville').value = profile.ville || '';
    document.getElementById('pf-adresse').value = profile.adresse || '';
  }

  loadMyOrders(session.user.id);
}

async function loadMyOrders(userId){
  const wrap = document.getElementById('my-orders-list');
  const { data: orders, error } = await supabaseClient
    .from('orders').select('*').eq('customer_id', userId).order('created_at', { ascending: false });

  if (error){ wrap.innerHTML = '<p style="color:var(--slate);">Impossible de charger vos commandes pour le moment.</p>'; return; }
  if (!orders || !orders.length){ wrap.innerHTML = '<p style="color:var(--slate);">Vous n\'avez pas encore passé de commande.</p>'; return; }

  const STATUT_LABELS_FR = { en_attente:'En attente', confirmee:'Confirmée', expediee:'Expédiée', livree:'Livrée', annulee:'Annulée' };

  wrap.innerHTML = orders.map(function(o){
    const date = o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR') : '';
    return `<a class="order-mini" href="suivi.html?id=${o.id}">
      <div><b>${escapeHtmlCompte(o.produit_nom)}</b><br><span style="color:var(--slate-light); font-size:.78rem;">${date} · Qté ${o.quantite}</span></div>
      <span class="statut-tag">${STATUT_LABELS_FR[o.statut] || o.statut}</span>
    </a>`;
  }).join('');
}

function escapeHtmlCompte(str){
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
