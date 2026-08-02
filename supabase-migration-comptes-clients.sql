-- =========================================================
-- PrecoTech237 — Migration : comptes clients + correction sécurité admin
-- À exécuter UNE SEULE FOIS : Supabase > SQL Editor > New query > Run
-- ---------------------------------------------------------
-- ⚠️ POURQUOI CETTE CORRECTION EST NÉCESSAIRE :
-- Jusqu'ici, les règles admin vérifiaient juste "auth.role() = 'authenticated'"
-- (= une personne est connectée). Ça fonctionnait tant que VOUS étiez la
-- seule personne à pouvoir vous connecter. Maintenant que les CLIENTS
-- vont aussi pouvoir créer un compte et se connecter, cette règle
-- deviendrait dangereuse : n'importe quel client connecté aurait pu
-- modifier vos produits ou vos commandes ! On introduit donc une vraie
-- notion d'administrateur (table "admins"), distincte des clients.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Table des administrateurs + fonction is_admin()
-- ---------------------------------------------------------
create table if not exists admins (
  id uuid primary key references auth.users(id) on delete cascade
);

alter table admins enable row level security;
drop policy if exists "Aucun accès direct" on admins;
create policy "Aucun accès direct" on admins for all using (false);

create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists(select 1 from admins where id = auth.uid());
$$;

-- ⚠️ ÉTAPE MANUELLE OBLIGATOIRE : ajoutez votre propre compte admin ici.
-- Remplacez YOUR-USER-ID par l'UUID de votre compte, visible dans
-- Supabase > Authentication > Users > (cliquez sur votre compte) > User UID
-- insert into admins (id) values ('YOUR-USER-ID');

-- ---------------------------------------------------------
-- 2) Remplacement de TOUTES les règles admin existantes
--    (auth.role()='authenticated' -> is_admin(), plus précis et plus sûr)
--    Chaque DROP couvre tous les noms historiques possibles selon les
--    migrations précédemment exécutées, pour éviter tout conflit.
-- ---------------------------------------------------------
drop policy if exists "Écriture produits (admin)" on products;
drop policy if exists "Écriture produits (admin connecté)" on products;
create policy "Écriture produits (admin)" on products
  for all using (is_admin()) with check (is_admin());

drop policy if exists "Écriture réglages (admin)" on site_settings;
drop policy if exists "Écriture réglages (admin connecté)" on site_settings;
create policy "Écriture réglages (admin)" on site_settings
  for all using (is_admin()) with check (is_admin());

drop policy if exists "Suppression des avis (admin)" on reviews;
drop policy if exists "Suppression avis (admin)" on reviews;
drop policy if exists "Suppression avis (admin connecté)" on reviews;
create policy "Suppression avis (admin)" on reviews
  for delete using (is_admin());

drop policy if exists "Upload photos produits (admin)" on storage.objects;
drop policy if exists "Upload photos produits (admin connecté)" on storage.objects;
drop policy if exists "Suppression photos produits (admin)" on storage.objects;
drop policy if exists "Suppression photos produits (admin connecté)" on storage.objects;
create policy "Upload photos produits (admin)" on storage.objects
  for insert with check (bucket_id = 'product-images' and is_admin());
create policy "Suppression photos produits (admin)" on storage.objects
  for delete using (bucket_id = 'product-images' and is_admin());

drop policy if exists "Upload vidéos produits (admin)" on storage.objects;
drop policy if exists "Upload vidéos produits (admin connecté)" on storage.objects;
drop policy if exists "Suppression vidéos produits (admin)" on storage.objects;
drop policy if exists "Suppression vidéos produits (admin connecté)" on storage.objects;
create policy "Upload vidéos produits (admin)" on storage.objects
  for insert with check (bucket_id = 'product-videos' and is_admin());
create policy "Suppression vidéos produits (admin)" on storage.objects
  for delete using (bucket_id = 'product-videos' and is_admin());

drop policy if exists "Suppression des photos d'avis (admin)" on storage.objects;
drop policy if exists "Suppression photos avis (admin)" on storage.objects;
drop policy if exists "Suppression photos avis (admin connecté)" on storage.objects;
create policy "Suppression photos avis (admin)" on storage.objects
  for delete using (bucket_id = 'review-photos' and is_admin());

drop policy if exists "Lecture commandes (admin)" on orders;
drop policy if exists "Lecture commandes (admin connecté)" on orders;
create policy "Lecture commandes (admin)" on orders
  for select using (is_admin());

drop policy if exists "Modification commandes (admin)" on orders;
drop policy if exists "Modification commandes (admin connecté)" on orders;
create policy "Modification commandes (admin)" on orders
  for update using (is_admin()) with check (is_admin());

drop policy if exists "Suppression commandes (admin)" on orders;
drop policy if exists "Suppression commandes (admin connecté)" on orders;
create policy "Suppression commandes (admin)" on orders
  for delete using (is_admin());

-- ---------------------------------------------------------
-- 3) Profils clients (infos réutilisées automatiquement à chaque commande)
-- ---------------------------------------------------------
create table if not exists customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text,
  telephone text,
  ville text,
  adresse text,
  updated_at timestamptz default now()
);

alter table customer_profiles enable row level security;

drop policy if exists "Client lit son propre profil" on customer_profiles;
create policy "Client lit son propre profil" on customer_profiles
  for select using (auth.uid() = id);

drop policy if exists "Client crée son propre profil" on customer_profiles;
create policy "Client crée son propre profil" on customer_profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Client modifie son propre profil" on customer_profiles;
create policy "Client modifie son propre profil" on customer_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------
-- 4) Lien entre une commande et le compte client qui l'a passée
--    (nullable : la commande "invité" sans compte reste possible)
-- ---------------------------------------------------------
alter table orders add column if not exists customer_id uuid references auth.users(id);

drop policy if exists "Client lit ses propres commandes" on orders;
create policy "Client lit ses propres commandes" on orders
  for select using (auth.uid() = customer_id);
-- (Cette règle s'ajoute à celle de l'admin ci-dessus, sans la remplacer :
--  un client authentifié voit UNIQUEMENT ses propres commandes.)
