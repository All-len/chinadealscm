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
    videoUrl: row.video_url || '',
    disponibilite: row.disponibilite || 'en_stock',
    optionGroups: row.option_groups || [],
    variantes: row.variantes || [],
    ratingAvg: 0,
    ratingCount: 0
  };
}

const DISPONIBILITE_LABELS = {
  'en_stock': { label: 'En stock', className: 'stock-ok' },
  'sur_commande': { label: 'Sur commande', className: 'stock-order' },
  'rupture': { label: 'Rupture temporaire', className: 'stock-out' }
};

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

    // Note moyenne par produit, calculée à partir de tous les avis
    const { data: reviewRows, error: revErr } = await supabaseClient
      .from('reviews')
      .select('product_id, note');

    if (!revErr && reviewRows){
      const grouped = {};
      reviewRows.forEach(function(r){
        if (!grouped[r.product_id]) grouped[r.product_id] = [];
        grouped[r.product_id].push(r.note);
      });
      PRODUCTS.forEach(function(p){
        const notes = grouped[p.id];
        if (notes && notes.length){
          p.ratingAvg = Math.round((notes.reduce((a,b) => a+b, 0) / notes.length) * 10) / 10;
          p.ratingCount = notes.length;
        }
      });
    }

  } catch(err){
    console.error('Erreur de chargement Supabase, utilisation des valeurs par défaut :', err);
  }
}

/* =========================================================
   Variantes de produits (caractéristiques à choix, prix variable)
   ========================================================= */

/* Produit cartésien de toutes les valeurs possibles de chaque groupe.
   Ex: [{nom:"Couleur",valeurs:["Rouge","Noir"]},{nom:"Stockage",valeurs:["128Go","256Go"]}]
   -> [{Couleur:"Rouge",Stockage:"128Go"}, {Couleur:"Rouge",Stockage:"256Go"}, ...] */
function buildVariantCombos(optionGroups){
  if (!optionGroups || !optionGroups.length) return [];
  return optionGroups.reduce(function(combos, group){
    const next = [];
    combos.forEach(function(combo){
      group.valeurs.forEach(function(valeur){
        next.push(Object.assign({}, combo, { [group.nom]: valeur }));
      });
    });
    return next;
  }, [{}]);
}

/* Compare deux combinaisons pour savoir si elles désignent la même variante */
function combosEqual(a, b){
  const keysA = Object.keys(a), keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(function(k){ return a[k] === b[k]; });
}

/* Trouve le prix correspondant à une combinaison choisie par le client.
   Renvoie null si aucune variante ne correspond (ne devrait pas arriver
   si toutes les combinaisons ont été générées côté admin). */
function findVariantPrice(product, selectedCombo){
  if (!product.variantes || !product.variantes.length) return product.prix;
  const match = product.variantes.find(function(v){ return combosEqual(v.combo, selectedCombo); });
  return match ? Number(match.prix) : null;
}
