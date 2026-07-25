# Brancher une vraie base de données (Supabase) — Guide pas à pas

Ce guide te fait passer de "produits stockés dans localStorage" à "produits stockés dans une vraie base de données cloud", visible instantanément par tous tes visiteurs.

---

## Étape 1 — Créer ton compte Supabase (2 min)

1. Va sur **https://supabase.com**
2. Clique sur **"Start your project"**
3. Connecte-toi avec GitHub, Google, ou un e-mail
4. Clique sur **"New project"**
   - Nom du projet : `precotech237`
   - Mot de passe de base de données : choisis-en un solide et **note-le quelque part** (tu n'en auras pas besoin tout de suite, mais garde-le)
   - Région : choisis **Europe (Frankfurt)** ou **Europe (Paris)** si disponible (le plus proche du Cameroun)
5. Attends 1-2 minutes que le projet se crée.

## Étape 2 — Créer les tables (3 min)

1. Dans le menu de gauche, clique sur **"SQL Editor"**
2. Clique sur **"New query"**
3. Ouvre le fichier `supabase-schema.sql` (fourni à côté de ce guide), copie tout son contenu, colle-le dans l'éditeur
4. Clique sur **"Run"** (ou Ctrl+Entrée)
5. Tu dois voir "Success. No rows returned" — c'est normal, ça veut dire que les tables sont créées. Tes 8 produits actuels sont automatiquement insérés dedans.

Pour vérifier : clique sur **"Table Editor"** dans le menu de gauche, tu dois voir les tables `products` et `site_settings` avec des données dedans.

## Étape 3 — Récupérer tes clés d'accès (1 min)

1. Clique sur l'icône **⚙️ Project Settings** (en bas à gauche)
2. Clique sur **"API"** dans le menu
3. Note ces deux informations :
   - **Project URL** (ressemble à `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public key** (une longue chaîne de caractères commençant par `eyJ...`)

⚠️ Ne partage **jamais** la clé `service_role` (différente de la clé `anon public`) — elle donne un accès total à ta base sans restriction. Seule la clé `anon public` doit être utilisée dans le site.

## Étape 4 — Me transmettre ces informations

Colle-moi ici :
```
Project URL : https://xxxxxxxxxxxx.supabase.co
anon public key : eyJ....................
```

Je m'occupe ensuite de brancher ton site dessus (fichiers `js/data.js`, `js/admin.js`, `js/main.js`).

---

## Ce qui va changer concrètement pour toi après le branchement

- **`admin.html`** : quand tu ajoutes/modifies/supprimes un produit, ça part directement dans la base Supabase.
- **Le site public** (`produits.html`, `produit.html`, `index.html`...) : charge les produits directement depuis Supabase à chaque visite. Plus besoin de télécharger/remplacer `js/data.js` !
- **Sécurité** : la clé `anon public` est volontairement limitée en lecture pour tout le monde. Pour l'écriture (ajout/modif/suppression), on gardera le code d'accès de l'espace admin comme filtre côté interface — correct pour un usage TPE/PME, mais garde à l'esprit que ce n'est pas un niveau de sécurité "entreprise". Si un jour tu veux une vraie authentification robuste (comptes utilisateurs, rôles), Supabase le permet aussi (Supabase Auth) — on pourra le rajouter plus tard sans tout casser.

## Le plan gratuit Supabase, ça suffit pour toi ?
Oui largement : 500 Mo de base de données et 5 Go de bande passante par mois gratuits — pour un catalogue de quelques dizaines/centaines de produits et un trafic de démarrage, c'est très confortable.
