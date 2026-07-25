/* =========================================================
   PrecoTech237 — Chargement des données depuis Supabase
   Ces variables sont vides au départ et remplies par
   loadSiteData() (appelée par js/app-init.js sur chaque page).
   ========================================================= */

let PRODUCTS = [];
let CONTACT = {
  whatsappNumber: "237600000000",
  email: "contact@precotech237.com",
  telephone: "+237 6XX XXX XXX",
  ville: "Bafoussam, Cameroun"
};
let TRANSPORT_MODES = [
  { id: "maritime", label: "Maritime", delai: "45 à 60 jours", note: "Le plus économique, idéal pour les grosses commandes", unite: "CBM", tarif: 360000 },
  { id: "aerien-normal", label: "Aérien normal", delai: "15 à 21 jours", note: "Bon équilibre entre coût et rapidité", unite: "kg", tarif: 8500 },
  { id: "aerien-express", label: "Aérien express", delai: "7 jours maximum", note: "Livraison rapide pour les besoins urgents", unite: "kg", tarif: 14000 }
];

/* Transforme une ligne Supabase (colonnes en snake_case) en objet produit
   utilisé partout ailleurs dans le site (camelCase) */
function mapDbProduct(row){
  return {
    id: row.id,
    nom: row.nom,
    categorie: row.categorie,
    categorieLabel: row.categorie_label,
    prix: Number(row.prix),
    etat: row.etat || '',
    badge: row.badge || '',
    description: row.description || '',
    specs: row.specs || [],
    poidsKg: Number(row.poids_kg) || 0,
    longueurCm: Number(row.longueur_cm) || 0,
    largeurCm: Number(row.largeur_cm) || 0,
    hauteurCm: Number(row.hauteur_cm) || 0,
    images: row.images || [],
    videoUrl: row.video_url || ''
  };
}

/* Volume d'un carton en CBM (mètres cubes) à partir de ses dimensions en cm */
function calcCBM(product){
  const l = product.longueurCm || 0, w = product.largeurCm || 0, h = product.hauteurCm || 0;
  return (l * w * h) / 1000000;
}

/* Coût de transport pour une quantité donnée, selon le mode choisi :
   - aérien (normal/express) : facturé au kg → poids total × tarif/kg
   - maritime : facturé au CBM → volume total × tarif/CBM */
function calcTransportCost(product, transportId, quantite){
  const mode = TRANSPORT_MODES.find(t => t.id === transportId);
  if (!mode) return 0;
  const qty = Number(quantite) || 1;

  if (mode.unite === 'kg'){
    return (product.poidsKg || 0) * qty * mode.tarif;
  }
  if (mode.unite === 'CBM'){
    return calcCBM(product) * qty * mode.tarif;
  }
  return 0;
}

/* Charge produits + réglages depuis Supabase. Renvoie une Promise.
   En cas d'erreur réseau, garde les valeurs par défaut ci-dessus
   pour que le site reste utilisable. */
async function loadSiteData(){
  try{
    const { data: products, error: prodErr } = await supabaseClient
      .from('products')
      .select('*')
      .order('created_at', { ascending: true });

    if (prodErr) throw prodErr;
    PRODUCTS = (products || []).map(mapDbProduct);

    const { data: settings, error: setErr } = await supabaseClient
      .from('site_settings')
      .select('*');

    if (setErr) throw setErr;
    (settings || []).forEach(function(row){
      if (row.key === 'contact') Object.assign(CONTACT, row.value);
      if (row.key === 'transport_modes') TRANSPORT_MODES = row.value;
    });

  } catch(err){
    console.error('Erreur de chargement Supabase, utilisation des valeurs par défaut :', err);
  }
}
