# Sécuriser l'espace admin — vraie authentification (Supabase Auth)

Ce guide remplace le simple "code d'accès" (qui ne protégeait pas réellement tes données) par un vrai compte protégé, e-mail + mot de passe.

## Ce qui change concrètement

**Avant :** n'importe qui connaissant ta clé Supabase `anon` (visible dans le code source public de ton site) pouvait modifier ou supprimer tes produits en envoyant une requête directement à Supabase — en contournant totalement le code d'accès de `admin.html`.

**Après :** seule une personne connectée avec ton compte (e-mail + mot de passe) peut écrire ou supprimer quoi que ce soit. La protection est maintenant appliquée **côté serveur** (Supabase), pas seulement côté site.

**Ce qui reste public, volontairement :**
- La lecture du catalogue, des avis, des tarifs (sinon le site ne s'afficherait pas)
- L'ajout d'un avis + photo par un client (un visiteur n'a pas de compte — sinon plus personne ne pourrait laisser d'avis)

---

## Étape 1 — Exécuter le script SQL

Dans Supabase → **SQL Editor** → colle le contenu de **`supabase-migration-auth.sql`** → **Run**.

⚠️ **Ne t'arrête pas là** : tant que l'étape 2 n'est pas faite, personne (même toi) ne pourra plus se connecter à `admin.html`, puisqu'aucun compte n'existe encore.

## Étape 2 — Créer ton compte administrateur

1. Dans Supabase, va dans **Authentication** (menu de gauche) → onglet **Users**
2. Clique sur **"Add user"** → **"Create new user"**
3. Renseigne :
   - **Email** : ton adresse e-mail (ex : celle que tu utilises déjà pour PrecoTech237)
   - **Password** : un mot de passe solide (que tu retiens ou notes en lieu sûr)
   - ✅ Coche **"Auto Confirm User"** — sinon Supabase attend une confirmation par e-mail que tu n'as pas configurée, et tu ne pourrais pas te connecter
4. Clique sur **"Create user"**

## Étape 3 — Se connecter

1. Ouvre `admin.html`
2. Tu vois maintenant un écran de connexion avec **e-mail + mot de passe** (à la place de l'ancien code d'accès)
3. Connecte-toi avec le compte créé à l'étape 2
4. Tout doit fonctionner normalement (produits, contact, tarifs, avis) — mais maintenant réellement protégé

Un bouton **"Se déconnecter"** est disponible en haut à droite une fois connecté.

---

## Si tu veux donner l'accès à quelqu'un d'autre plus tard
(un employé, un associé...) : répète l'étape 2 avec son adresse e-mail — chaque personne a son propre compte, pas besoin de partager le tien.

## Si tu perds ton mot de passe
Supabase → Authentication → Users → clique sur ton utilisateur → tu peux lui définir un nouveau mot de passe directement depuis le tableau de bord (pas besoin d'e-mail de récupération, tant que tu as accès à ton compte Supabase).

## Vérification que tout est bien protégé
Essaie ceci : déconnecte-toi de `admin.html`, puis tente de recharger la page produits (`produits.html`) — le catalogue doit toujours s'afficher normalement (lecture publique, normal). Mais si tu essaies d'ajouter un produit sans être connecté, ça doit être refusé.
