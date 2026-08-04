/* =========================================================
   PrecoTech237 — Chargement des données depuis Supabase
   ---------------------------------------------------------
   IMPORTANT (perf, catalogue > 100 produits) :
   - loadSettings() est LÉGER (contact + tarifs transport) et
     est appelé sur TOUTES les pages via js/app-init.js.
   - Le catalogue produit N'EST PLUS chargé automatiquement en
     entier sur chaque page. Chaque page qui a besoin de produits
     appelle explicitement l'une des fonctions ci-dessous, qui ne
     renvoient QUE les colonnes et QUE le nombre de lignes utiles :
       - fetchProductsPage()   → page paginée pour produits.html
       - fetchFeaturedProducts() → 8 produits pour l'accueil
       - fetchProductById()    → fiche produit complète (1 ligne)
       - fetchSimilarProducts()→ 4 produits "voir aussi"
       - fetchCategories()     → liste des catégories existantes
   ========================================================= */

const PAGE_SIZE = 24; // nb de produits par page dans le catalogue

// Colonnes nécessaires pour une CARTE produit (accueil, catalogue, similaires)
// -> pas de description, specs, variantes, option_groups, video_url : ces
//    champs pèsent lourd et ne servent que sur la fiche produit détaillée.
const CARD_COLUMNS = 'id, nom, categorie, categorie_label, prix, badge, disponibilite, images';

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

/* Conservé pour compatibilité : certaines pages/scripts historiques lisent
   encore un tableau global PRODUCTS. Il n'est plus rempli automatiquement —
   chaque page le peuple elle-même avec seulement ce dont elle a besoin
   (voir fonctions fetch* plus bas). */
let PRODUCTS = [];

/* Transforme une ligne Supabase (colonnes en snake_case) en objet produit
   utilisé partout ailleurs dans le site (camelCase). Fonctionne aussi bien
   pour une ligne "carte" allégée que pour une ligne complète : les champs
   non sélectionnés en base restent simplement undefined/valeur par défaut. */
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

/* =========================================================
   1) Données LÉGÈRES — appelées sur TOUTES les pages
   ========================================================= */
async function loadSettings(){
  try{
    const { data: settings, error } = await supabaseClient
      .from('site_settings')
      .select('*');
    if (error) throw error;
    (settings || []).forEach(function(row){
      if (row.key === 'contact') Object.assign(CONTACT, row.value);
      if (row.key === 'transport_modes') TRANSPORT_MODES = row.value;
    });
  } catch(err){
    console.error('Erreur de chargement des réglages (Supabase), valeurs par défaut utilisées :', err);
  }
}

/* =========================================================
   2) Notes moyennes — uniquement pour un lot précis de produits
   (jamais toute la table "reviews" d'un coup)
   ========================================================= */
async function attachRatings(products){
  if (!products.length) return products;
  const ids = products.map(p => p.id);
  try{
    const { data: reviewRows, error } = await supabaseClient
      .from('reviews')
      .select('product_id, note')
      .in('product_id', ids);
    if (error) throw error;

    const grouped = {};
    (reviewRows || []).forEach(function(r){
      if (!grouped[r.product_id]) grouped[r.product_id] = [];
      grouped[r.product_id].push(r.note);
    });
    products.forEach(function(p){
      const notes = grouped[p.id];
      if (notes && notes.length){
        p.ratingAvg = Math.round((notes.reduce((a,b) => a+b, 0) / notes.length) * 10) / 10;
        p.ratingCount = notes.length;
      }
    });
  } catch(err){
    console.error('Erreur de chargement des avis :', err);
  }
  return products;
}

/* =========================================================
   3) Catégories disponibles (pour les filtres / pastilles)
   Colonnes ultra-légères, pas de select('*').
   ========================================================= */
async function fetchCategories(){
  try{
    const { data, error } = await supabaseClient
      .from('products')
      .select('categorie, categorie_label');
    if (error) throw error;
    const map = {};
    (data || []).forEach(function(row){
      if (row.categorie && !map[row.categorie]) map[row.categorie] = row.categorie_label || row.categorie;
    });
    return map; // { 'laptops': 'Laptops', ... }
  } catch(err){
    console.error('Erreur de chargement des catégories :', err);
    return {};
  }
}

/* =========================================================
   4) Catalogue PAGINÉ côté serveur (produits.html)
   Filtre catégorie + recherche + tri sont appliqués par la
   requête Supabase elle-même (pas de scan d'un gros tableau
   côté navigateur), et seule la page demandée est transférée.
   ========================================================= */
async function fetchProductsPage({ categorie = 'all', recherche = '', tri = 'default', page = 0 } = {}){
  try{
    let query = supabaseClient
      .from('products')
      .select(CARD_COLUMNS, { count: 'exact' });

    if (categorie && categorie !== 'all'){
      query = query.eq('categorie', categorie);
    }
    if (recherche && recherche.trim()){
      const q = recherche.trim();
      // recherche sur le nom OU la description, insensible à la casse
      query = query.or(`nom.ilike.%${q}%,description.ilike.%${q}%`);
    }
    if (tri === 'prix-asc') query = query.order('prix', { ascending: true });
    else if (tri === 'prix-desc') query = query.order('prix', { ascending: false });
    else query = query.order('created_at', { ascending: true });

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    const products = (data || []).map(mapDbProduct);
    await attachRatings(products);

    return {
      products,
      total: count || 0,
      hasMore: (from + products.length) < (count || 0)
    };
  } catch(err){
    console.error('Erreur de chargement du catalogue :', err);
    return { products: [], total: 0, hasMore: false };
  }
}

/* =========================================================
   5) Produits mis en avant sur l'accueil (8 max, une page)
   ========================================================= */
async function fetchFeaturedProducts(categorie = 'all', limit = 8){
  const { products } = await fetchProductsPage({ categorie, page: 0 });
  return products.slice(0, limit);
}

/* =========================================================
   6) Fiche produit complète (une seule ligne, toutes colonnes)
   ========================================================= */
async function fetchProductById(id){
  if (!id) return null;
  try{
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const product = mapDbProduct(data);
    await attachRatings([product]);
    return product;
  } catch(err){
    console.error('Erreur de chargement du produit :', err);
    return null;
  }
}

/* =========================================================
   7) Produits similaires (même catégorie, colonnes allégées)
   ========================================================= */
async function fetchSimilarProducts(categorie, excludeId, limit = 4){
  try{
    const { data, error } = await supabaseClient
      .from('products')
      .select(CARD_COLUMNS)
      .eq('categorie', categorie)
      .neq('id', excludeId)
      .limit(limit);
    if (error) throw error;
    const products = (data || []).map(mapDbProduct);
    await attachRatings(products);
    return products;
  } catch(err){
    console.error('Erreur de chargement des produits similaires :', err);
    return [];
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
