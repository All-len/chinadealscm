# Déploiement automatique via GitHub + Netlify

Ce guide connecte ton code à GitHub pour que chaque mise à jour se publie automatiquement sur Netlify, sans jamais re-glisser un dossier.

Le dossier que je t'ai donné contient déjà un dépôt Git initialisé (dossier caché `.git`) avec un premier "commit" (= une sauvegarde de l'état actuel du site). Il ne te reste qu'à le connecter à ton compte.

---

## Étape 1 — Créer ton compte GitHub (2 min)

1. Va sur **https://github.com**
2. Crée un compte gratuit
3. Confirme ton e-mail

## Étape 2 — Créer un nouveau dépôt (repository) (2 min)

1. Clique sur le **+** en haut à droite → **"New repository"**
2. Nom du dépôt : `precotech237-site`
3. Visibilité : **Public** (pas de souci de sécurité — voir encadré ci-dessous)
4. ⚠️ **Ne coche AUCUNE case** ("Add a README", "Add .gitignore", "Add license") — le dépôt doit rester complètement vide, sinon la connexion avec ton dossier existant échouera
5. Clique sur **"Create repository"**
6. GitHub affiche une page avec des commandes — garde cette page ouverte, tu vas avoir besoin de l'URL du type `https://github.com/ton-nom-utilisateur/precotech237-site.git`

> **Le dépôt peut être public sans risque particulier** : la clé Supabase visible dans `js/supabase-config.js` est la clé `anon public`, conçue pour être visible côté client — la vraie protection de tes données vient des règles RLS côté Supabase, pas du secret de cette clé. Le seul élément à considérer est le code d'accès de `admin.html` (`ADMIN_PASSWORD` dans `js/admin.js`) : il est de toute façon déjà visible dans le code source de ton site en ligne, donc le mettre sur un dépôt public ne change rien à son niveau de protection réel. Si un jour tu veux le rendre invisible, il faudra passer à une vraie authentification (Supabase Auth).

## Étape 3 — Envoyer ton code sur GitHub

Ouvre un terminal (**Terminal** sur Mac, **Git Bash** ou **PowerShell** sur Windows — installe [Git](https://git-scm.com/downloads) si la commande `git` n'est pas reconnue), place-toi dans le dossier `precotech237`, puis exécute :

```bash
cd chemin/vers/precotech237
git remote add origin https://github.com/TON-NOM-UTILISATEUR/precotech237-site.git
git push -u origin main
```

GitHub va te demander de te connecter (identifiant + mot de passe, ou un "Personal Access Token" si demandé — GitHub t'explique comment en créer un si besoin, c'est automatique la première fois).

Une fois terminé, actualise la page GitHub : tu dois voir tous tes fichiers (`index.html`, `js/`, `css/`, etc.).

> 💡 Pas envie d'utiliser le terminal ? Alternative plus visuelle : installe **GitHub Desktop** (https://desktop.github.com), connecte-toi, "Add local repository" → sélectionne le dossier `precotech237` → "Publish repository".

## Étape 4 — Connecter Netlify à ce dépôt GitHub

Puisque ton site est déjà en ligne (déployé par glisser-déposer), on va **relier ce même site** à GitHub pour ne pas changer d'adresse :

1. Va sur ton tableau de bord Netlify → ouvre ton site `precotech237`
2. **Site configuration** (ou "Site settings") → **Build & deploy**
3. Cherche la section **"Link repository"** ou **"Continuous deployment"**
4. Clique sur **"Link site to Git"** (ou équivalent selon la version de l'interface)
5. Choisis **GitHub**, autorise Netlify à accéder à ton compte, puis sélectionne le dépôt `precotech237-site`
6. Paramètres de build :
   - **Build command** : laisse vide (ce site n'a pas de build, c'est du HTML/CSS/JS pur)
   - **Publish directory** : laisse `/` (ou vide)
7. Clique sur **"Deploy site"** / **"Save"**

## Étape 5 — Tester le déploiement automatique

1. Modifie un petit détail dans un fichier (par exemple change un texte dans `index.html`)
2. Dans le terminal, toujours dans le dossier `precotech237` :
   ```bash
   git add -A
   git commit -m "Test de déploiement automatique"
   git push
   ```
3. Retourne sur Netlify → onglet **"Deploys"** : tu dois voir un nouveau déploiement démarrer tout seul, en quelques secondes
4. Une fois terminé (statut "Published"), recharge ton site en ligne : le changement doit être visible

---

## Ton nouveau flux de travail, résumé

| Type de changement | Comment procéder |
|---|---|
| Produit, prix, photo, vidéo, coordonnées, tarifs transport | `admin.html` → instantané, rien à publier |
| Design, texte fixe, nouvelle page, correction de bug | Modifier le fichier → `git add -A && git commit -m "..." && git push` → Netlify publie automatiquement en quelques secondes |

Pour tester une modification de code **avant** de la publier, lance un petit serveur local (voir `LISEZ-MOI.md`) plutôt que d'ouvrir les fichiers directement (`file://` bloque les appels à Supabase, comme tu l'as déjà remarqué avec l'upload de photos).
