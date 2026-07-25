# Activer Google Analytics — guide pas à pas

Google Analytics te permet de voir combien de visiteurs viennent sur ton site, quelles pages ils consultent, d'où ils viennent (TikTok, WhatsApp, recherche Google...), et sur quel appareil.

## Étape 1 — Créer ton compte Google Analytics (gratuit)

1. Va sur **https://analytics.google.com**
2. Connecte-toi avec un compte Google (le même que Gmail si tu en as un)
3. Clique sur **"Commencer à mesurer"** (ou "Créer un compte" si tu en as déjà un)
4. Nom du compte : `PrecoTech237` → Continuer
5. Nom de la propriété : `PrecoTech237` → choisis ton fuseau horaire (Cameroun) et la devise (FCFA / XAF) → Continuer
6. Renseigne les infos sur ton activité (secteur "Shopping" ou "Commerce", taille de l'entreprise) → Continuer → Créer

## Étape 2 — Créer un flux de données pour ton site web

1. Choisis **"Web"** comme plateforme
2. URL du site : `https://chinadealscm.netlify.app` (ou ton nom de domaine si tu l'as déjà connecté)
3. Nom du flux : `Site PrecoTech237`
4. Clique sur **"Créer le flux"**

## Étape 3 — Récupérer ton identifiant de mesure

Une fois le flux créé, Google affiche directement un **"ID de mesure"** en haut à droite, du type :
```
G-ABC1234XYZ
```
Copie-le.

## Étape 4 — Coller ton identifiant dans le site

Ouvre le fichier **`js/analytics.js`**, et remplace cette ligne :
```js
const GA_MEASUREMENT_ID = "";
```
par :
```js
const GA_MEASUREMENT_ID = "G-ABC1234XYZ"; // ton vrai identifiant
```

Republie ensuite le dossier sur Netlify (glisser-déposer comme d'habitude, ou push Git si tu as connecté GitHub).

## Étape 5 — Vérifier que ça fonctionne

1. Ouvre ton site en ligne dans un nouvel onglet
2. Retourne dans Google Analytics → menu de gauche → **"Rapports"** → **"Temps réel"**
3. Tu dois te voir apparaître comme visiteur actif en quelques secondes

---

## Ce que tu pourras suivre ensuite

- **Rapports → Cycle de vie → Acquisition** : d'où viennent tes visiteurs (TikTok, WhatsApp, recherche Google, lien direct...)
- **Rapports → Cycle de vie → Engagement → Pages et écrans** : quelles pages/produits sont les plus consultés
- **Rapports → Temps réel** : qui est sur le site maintenant

## Vie privée
Aucune configuration de bannière de cookies n'est incluse par défaut. Si tu vises un public en Europe ou veux être rigoureux sur la conformité RGPD, il faudrait ajouter un bandeau de consentement avant de charger Google Analytics — dis-le-moi si tu veux qu'on l'ajoute.
