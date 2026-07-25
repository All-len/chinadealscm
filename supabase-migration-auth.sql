-- =========================================================
-- PrecoTech237 — Migration : vraie authentification admin
-- À exécuter UNE SEULE FOIS : Supabase > SQL Editor > New query > Run
-- ---------------------------------------------------------
-- Avant/après :
-- AVANT : n'importe qui connaissant la clé "anon" (visible dans le
--         code source du site) pouvait modifier/supprimer produits,
--         coordonnées et avis, en contournant le mot de passe de
--         admin.html.
-- APRÈS : seule une personne connectée avec un vrai compte
--         (e-mail + mot de passe créé dans Supabase Auth) peut
--         écrire ou supprimer. La lecture reste publique (le site
--         doit rester visible par tous), et l'ajout d'un avis/photo
--         par un client reste public (pas de compte requis pour
--         laisser un avis).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Produits — lecture publique, écriture réservée aux connectés
-- ---------------------------------------------------------
drop policy if exists "Écriture produits (admin)" on products;

create policy "Écriture produits (admin connecté)" on products
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------
-- 2) Réglages du site (contact, tarifs transport) — idem
-- ---------------------------------------------------------
drop policy if exists "Écriture réglages (admin)" on site_settings;

create policy "Écriture réglages (admin connecté)" on site_settings
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------
-- 3) Avis clients — l'AJOUT reste public (un client n'a pas de
--    compte), seule la SUPPRESSION (modération) devient réservée
-- ---------------------------------------------------------
drop policy if exists "Suppression des avis (admin)" on reviews;

create policy "Suppression avis (admin connecté)" on reviews
  for delete
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------
-- 4) Photos/vidéos produits — upload et suppression réservés
--    (c'est vous qui gérez le catalogue, pas les visiteurs)
-- ---------------------------------------------------------
drop policy if exists "Upload photos produits (admin)" on storage.objects;
drop policy if exists "Suppression photos produits (admin)" on storage.objects;
create policy "Upload photos produits (admin connecté)" on storage.objects
  for insert with check (bucket_id = 'product-images' and auth.role() = 'authenticated');
create policy "Suppression photos produits (admin connecté)" on storage.objects
  for delete using (bucket_id = 'product-images' and auth.role() = 'authenticated');

drop policy if exists "Upload vidéos produits (admin)" on storage.objects;
drop policy if exists "Suppression vidéos produits (admin)" on storage.objects;
create policy "Upload vidéos produits (admin connecté)" on storage.objects
  for insert with check (bucket_id = 'product-videos' and auth.role() = 'authenticated');
create policy "Suppression vidéos produits (admin connecté)" on storage.objects
  for delete using (bucket_id = 'product-videos' and auth.role() = 'authenticated');

-- ---------------------------------------------------------
-- 5) Photos jointes aux avis — l'UPLOAD reste public (un client
--    ajoute sa photo sans compte), seule la SUPPRESSION (modération
--    d'une photo inappropriée) devient réservée
-- ---------------------------------------------------------
drop policy if exists "Suppression des photos d'avis (admin)" on storage.objects;

create policy "Suppression photos avis (admin connecté)" on storage.objects
  for delete using (bucket_id = 'review-photos' and auth.role() = 'authenticated');

-- ---------------------------------------------------------
-- Rien d'autre ne change : la lecture des produits, réglages et
-- avis reste publique (obligatoire pour que le site s'affiche),
-- ainsi que l'ajout d'un avis et de sa photo par un visiteur.
-- ---------------------------------------------------------
