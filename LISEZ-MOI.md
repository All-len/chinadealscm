# PrecoTech237 — Guide de mise en ligne et de personnalisation

## ✅ Ce site est maintenant connecté à une vraie base de données (Supabase)
Fini le localStorage / téléchargement de fichier : tout changement fait dans `admin.html` (ajout, modification, suppression de produit, changement de coordonnées) est **immédiatement visible par tous vos clients**, sur n'importe quel appareil.

## Contenu du dossier
```
precotech237/
├── index.html                 → Page d'accueil
├── produits.html               → Catalogue (avec filtres)
├── produit.html                 → Fiche produit (une seule page pour tous les produits, via ?id=)
├── suivi.html                    → Page de suivi de commande côté client (via ?id=)
├── transport.html               → Page transport
├── comment-ca-marche.html       → Page processus
├── a-propos.html                 → Page à propos
├── contact.html                  → Page contact
├── commander.html               → Formulaire de commande complet
├── admin.html                    → 🔐 Espace administrateur (produits + coordonnées, en direct sur Supabase)
├── css/style.css                 → Tout le design du site
├── js/supabase-config.js         → 🔑 Clés de connexion à votre base Supabase
├── js/data.js                    → Chargement des produits/coordonnées depuis Supabase
├── js/app-init.js                → Charge les données puis affiche le site
├── js/icons.js                   → Bibliothèque d'icônes SVG
├── js/reveal.js                  → Animations d'apparition au défilement
├── js/main.js                    → Navigation, bouton WhatsApp flottant, cartes produits
├── js/admin.js                   → Logique de l'espace administrateur (branché sur Supabase)
├── js/order.js                   → Traitement du formulaire de commande
├── js/reviews.js                 → Avis clients avec photos (fiche produit)
├── js/suivi.js                   → Logique de la page de suivi de commande client
├── supabase-schema.sql            → Script de création des tables (à exécuter en premier)
├── supabase-migration-transport-avis.sql → Poids/volume produits + tarifs transport + avis clients (à exécuter après supabase-schema.sql)
├── supabase-migration-media.sql   → Photos multiples + vidéo produit (à exécuter en 3ème)
├── supabase-migration-auth.sql    → Vraie authentification admin (à exécuter en 4ème)
├── supabase-migration-orders.sql  → Suivi des commandes (à exécuter en 5ème)
├── supabase-migration-suivi.sql   → Fonctions sécurisées de suivi client (à exécuter en 6ème)
├── GUIDE-SUPABASE.md              → Pas-à-pas pour créer/configurer votre projet Supabase
├── GUIDE-AUTH.md                  → Pas-à-pas pour créer votre compte administrateur sécurisé
└── GUIDE-GITHUB-NETLIFY.md        → Pas-à-pas pour le déploiement automatique (GitHub + Netlify)
```

## 1. Vos coordonnées et votre catalogue vivent maintenant dans Supabase
Vous n'éditez plus `js/data.js` à la main : tout se gère depuis **`admin.html`** (voir point 2). Le fichier `js/data.js` sert uniquement à aller chercher les données à jour dans votre base à chaque chargement de page.

## 2. Espace administrateur — ajouter/modifier/supprimer produits et coordonnées
Ouvrez **`admin.html`** dans votre navigateur.

- Connexion avec un **vrai compte** (e-mail + mot de passe) créé dans Supabase Auth — voir **`GUIDE-AUTH.md`** pour la mise en place (à faire une seule fois).
- Onglet **Produits** : ajouter, modifier, supprimer (nom, catégorie, prix, état, badge, description, caractéristiques, photos, vidéo).
- Onglet **Informations du site** : numéro WhatsApp, téléphone, e-mail, ville.
- Onglet **Tarifs transport** : FCFA/kg (aérien) et FCFA/CBM (maritime).
- Onglet **Avis clients** : modération (suppression) des avis publiés par vos visiteurs.

Chaque clic sur "Enregistrer" écrit directement dans votre base Supabase : **le changement est visible instantanément par tous vos visiteurs**, sans rien télécharger ni remplacer.

✅ **Sécurité** : seules les personnes connectées avec un compte administrateur (créé dans Supabase Auth) peuvent écrire ou supprimer des données — la protection est appliquée côté serveur (Supabase), pas seulement par un mot de passe côté site. Ne partagez jamais votre clé Supabase `service_role` (différente de la clé `anon public` utilisée sur le site) — elle donne un accès total sans restriction à votre base, en contournant toute règle de sécurité.

## 3. Configurer votre propre base Supabase (si ce n'est pas déjà fait)
Suivez **`GUIDE-SUPABASE.md`** : créer le compte, exécuter `supabase-schema.sql`, récupérer votre Project URL et votre clé `anon public`, puis les coller dans `js/supabase-config.js` :
```js
const SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJ....................";
```

⚠️ **Ne testez jamais en ouvrant un fichier directement (double-clic)** : l'adresse commence alors par `file:///...` et les navigateurs bloquent les appels vers Supabase depuis ce protocole (upload de photos/vidéos notamment). Pour tester en local avant de publier, lancez un petit serveur local depuis le dossier `precotech237` :
```bash
python -m http.server 8000
```
puis ouvrez `http://localhost:8000` dans votre navigateur. (Node.js : `npx serve` fonctionne aussi si Python n'est pas installé.)

## 4. Tarification du transport au poids/volume (nouveau)
Le coût de transport est maintenant calculé automatiquement pour chaque commande :
- **Aérien normal** : facturé au kilo (par défaut 8 500 FCFA/kg)
- **Aérien express** : facturé au kilo (par défaut 14 000 FCFA/kg)
- **Maritime** : facturé au volume, en CBM/mètre cube (par défaut 360 000 FCFA/CBM)

Pour que ce calcul fonctionne, **chaque produit doit avoir un poids et des dimensions de carton renseignés** — vous les ajoutez depuis `admin.html`, onglet **Produits** (champs "Poids" et "Dimensions carton L × l × H"). Si ces champs sont vides pour un produit, le site indique simplement que le tarif sera confirmé par WhatsApp, sans bloquer la commande.

Vous pouvez changer les tarifs (FCFA/kg, FCFA/CBM) à tout moment depuis `admin.html`, onglet **Tarifs transport** — le changement s'applique immédiatement à toutes les fiches produits et au formulaire de commande.

Si vous exécutez ce site pour la première fois avec cette fonctionnalité, exécutez **`supabase-migration-transport-avis.sql`** dans Supabase (SQL Editor), après avoir déjà exécuté `supabase-schema.sql`.

## 5. Avis clients avec photos (nouveau)
Chaque fiche produit affiche maintenant une section "Avis clients" : note moyenne, liste des avis, et un formulaire permettant à vos visiteurs de laisser un avis avec nom, note (1 à 5 étoiles), commentaire et jusqu'à 4 photos.

- Les avis sont stockés dans la table `reviews` et les photos dans le bucket de stockage `review-photos` (public, gratuit jusqu'à 1 Go sur le plan gratuit Supabase).
- **Modération** : depuis `admin.html`, onglet **Avis clients**, vous voyez tous les avis (tous produits confondus) avec leurs photos, et pouvez supprimer un avis inapproprié ou indésirable en un clic.
- ⚠️ Comme le formulaire d'avis est ouvert à tous les visiteurs sans compte, surveillez cet onglet régulièrement pour retirer tout contenu abusif ou indésirable (spam, photos hors-sujet).

## 6. Photos multiples et vidéo produit
Depuis `admin.html` → onglet **Produits** → en ajoutant/modifiant un produit :
- **Photos** : cliquez sur le champ "Photos du produit" pour envoyer une ou plusieurs images depuis votre téléphone/ordinateur. Elles s'affichent en miniatures avec un bouton ✕ pour en retirer une avant d'enregistrer. La première photo devient la photo principale du catalogue.
- **Vidéo** : deux options, au choix —
  1. Collez un lien **YouTube** ou **TikTok** dans le champ "Vidéo du produit" (le lien TikTok s'affiche comme un bouton cliquable, YouTube s'intègre directement dans la page).
  2. Ou envoyez directement un fichier vidéo (bouton en dessous) — le lien se remplit alors automatiquement, et la vidéo s'affiche avec un lecteur intégré sur la fiche produit.

Ces médias sont stockés dans votre projet Supabase (buckets `product-images` et `product-videos`, gratuits jusqu'à 1 Go sur le plan gratuit — préférez des vidéos courtes pour ne pas consommer trop d'espace).

Si vous configurez cette fonctionnalité pour la première fois, exécutez **`supabase-migration-media.sql`** dans Supabase (SQL Editor), après avoir déjà exécuté `supabase-schema.sql` et `supabase-migration-transport-avis.sql`.

## 7. Suivi des commandes (mis à jour — suivi client inclus)
Chaque commande passée par un client est **enregistrée automatiquement** dans Supabase (en plus d'être transmise par WhatsApp/e-mail comme avant).

**Côté admin** (`admin.html` → onglet **"Commandes"**, premier onglet) :
- Voir toutes les commandes (client, produit, quantité, transport, total estimé)
- Filtrer par statut
- **Faire avancer le statut étape par étape** : En attente → Confirmée → Expédiée → Livrée — impossible de revenir en arrière une fois une étape passée (bouton "Annuler" disponible séparément à tout moment avant livraison)
- Cliquer sur "Détails" pour voir l'adresse complète, le message du client, **et copier le lien de suivi** à transmettre au client par WhatsApp
- Supprimer une commande de l'historique si besoin

**Côté client** (nouvelle page `suivi.html`) : après avoir commandé, le client reçoit un lien unique de suivi (affiché sur la page de confirmation, et copiable par vous depuis l'admin). Cette page lui permet de :
- Voir où en est sa commande (mêmes étapes que côté admin, affichées visuellement)
- Cliquer sur **"J'ai reçu ma commande"** une fois le statut "Expédiée" atteint — passe alors automatiquement à "Livrée"
- **Laisser directement un avis** (avec photos) une fois la commande marquée comme reçue, sans avoir à retourner chercher la fiche produit

Si vous configurez cette fonctionnalité pour la première fois, exécutez dans l'ordre : **`supabase-migration-orders.sql`** puis **`supabase-migration-suivi.sql`** dans Supabase (SQL Editor). Le second ajoute les fonctions sécurisées qui permettent au client de voir/mettre à jour uniquement SA commande, jamais celles des autres.

## 8. Galerie photo produit (améliorée)
Sur chaque fiche produit, la galerie photo dispose maintenant de :
- **Flèches ‹ ›** pour naviguer entre les photos directement sur l'image principale (en plus des miniatures)
- **Clic sur la photo** pour l'ouvrir en plein écran (visionneuse avec zoom, navigation flèches, fermeture par ✕, clic extérieur ou touche Échap)
- Un recadrage cohérent (les photos de tailles différentes s'affichent toutes proprement, sans déformation)

## 8bis. Catégories de produits dynamiques (nouveau)
Vous n'êtes plus limité aux 3 catégories de départ (Laptops, PC Gaming, Téléphones). Dans `admin.html`, en ajoutant ou modifiant un produit, le champ Catégorie propose désormais **"+ Nouvelle catégorie..."** : tapez simplement le nom de la nouvelle catégorie (ex : "Accessoires", "Tablettes") et elle sera créée automatiquement. Le catalogue (page Produits) et les pastilles de la page d'accueil s'adaptent tout seuls pour afficher exactement les catégories réellement utilisées par vos produits.

## 9. Comment fonctionne l'envoi des commandes
- **WhatsApp** : dès que le client clique sur "Envoyer ma commande", un nouvel onglet WhatsApp s'ouvre avec le message de commande déjà rédigé, prêt à être envoyé à votre numéro.
- **E-mail** : un bouton "Envoyer aussi une copie par e-mail" apparaît après l'envoi ; il ouvre le client e-mail du visiteur (Gmail, Outlook...) avec le message déjà rempli.

⚠️ **Un site statique (HTML/CSS/JS pur) ne peut pas envoyer un e-mail automatiquement "en silence"** depuis le serveur : il faut soit un serveur avec un script d'envoi, soit un service tiers. Deux options si vous voulez un e-mail 100% automatique, sans aucune action du client :
- **Formspree** (gratuit pour commencer) : créez un compte sur formspree.io, remplacez l'action du formulaire par l'URL fournie ; Formspree envoie l'e-mail à votre place.
- **WordPress + WooCommerce** : migrez le contenu de ce site vers WordPress avec un plugin comme "WhatsApp Order Button" ou "Order Notification via WhatsApp" + WP Mail SMTP pour l'e-mail automatique. C'est la solution recommandée si vous voulez aussi une interface d'administration standard type CMS.

## 10. Mettre le site en ligne
Trois façons simples et gratuites/pas chères :
- **Netlify / Vercel** : glissez-déposez le dossier `precotech237/` sur netlify.com (fonctionne en 1 minute, gratuit).
- **GitHub Pages** : mettez le dossier dans un dépôt GitHub, activez "Pages" dans les paramètres.
- **Hébergement classique (cPanel/OVH/Hostinger...)** : envoyez le contenu du dossier dans le répertoire `public_html` via FTP.

Le dossier `precotech237/` que vous déployez contient déjà `js/supabase-config.js` avec vos clés — inutile de reconfigurer quoi que ce soit après le déploiement : produits et coordonnées viendront automatiquement de votre base Supabase.

**Pour ne plus jamais avoir à re-glisser le dossier manuellement**, suivez **`GUIDE-GITHUB-NETLIFY.md`** : une fois connecté à GitHub, chaque modification de code publiée (`git push`) déclenche automatiquement un nouveau déploiement sur Netlify.

## 11. Nom de domaine
Une fois hébergé, associez un nom de domaine du type `precotech237.com` ou `.cm` pour plus de crédibilité auprès de vos clients.

## 12. Prochaines améliorations possibles

**Déjà fait** (ne plus proposer) : photos/vidéos produits, Google Analytics (script prêt, ID à renseigner), recherche catalogue, indicateur de stock, note moyenne, favicon, image de partage, robots.txt/sitemap, pages FAQ/Garantie/Mentions légales, responsive complet (site + admin), palette de couleurs alignée sur le logo.

**Encore à faire, par ordre d'impact suggéré :**
- **Nom de domaine personnalisé** (`precotech237.com` / `.cm`) — pas encore acheté/connecté
- **GitHub + déploiement automatique** — dépôt Git préparé dans le dossier, connexion à Netlify pas encore faite
- **Paiement Mobile Money en ligne** (MTN MoMo / Orange Money) — actuellement le paiement se négocie par WhatsApp ; une vraie intégration permettrait un paiement immédiat depuis le site
- **E-mail 100% automatique** (Formspree/EmailJS) — actuellement le client doit cliquer pour envoyer (mailto)
- **Indexation Google** (Search Console) — pour apparaître en cherchant "PrecoTech237" ou "China Deals CM"
- **Version anglaise du site** — utile pour une partie de la clientèle camerounaise bilingue
- **2FA sur le compte Netlify** et renommage de `admin.html` — protections légères supplémentaires
