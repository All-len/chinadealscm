-- =========================================================
-- PrecoTech237 — Migration : photos et vidéo produit
-- À exécuter UNE SEULE FOIS : Supabase > SQL Editor > New query > Run
-- (Sûr à exécuter même si des données existent déjà)
-- =========================================================

-- ---------------------------------------------------------
-- 1) Colonnes photos (plusieurs) et vidéo (une seule, lien ou fichier)
-- ---------------------------------------------------------
alter table products add column if not exists images jsonb default '[]'::jsonb;
alter table products add column if not exists video_url text;

-- ---------------------------------------------------------
-- 2) Espace de stockage pour les photos produits
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Lecture publique photos produits" on storage.objects;
create policy "Lecture publique photos produits" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "Upload photos produits (admin)" on storage.objects;
create policy "Upload photos produits (admin)" on storage.objects
  for insert with check (bucket_id = 'product-images');

drop policy if exists "Suppression photos produits (admin)" on storage.objects;
create policy "Suppression photos produits (admin)" on storage.objects
  for delete using (bucket_id = 'product-images');

-- ---------------------------------------------------------
-- 3) Espace de stockage pour les vidéos produits (fichier téléversé,
--    optionnel — vous pouvez aussi simplement coller un lien YouTube/TikTok)
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-videos', 'product-videos', true)
on conflict (id) do nothing;

drop policy if exists "Lecture publique vidéos produits" on storage.objects;
create policy "Lecture publique vidéos produits" on storage.objects
  for select using (bucket_id = 'product-videos');

drop policy if exists "Upload vidéos produits (admin)" on storage.objects;
create policy "Upload vidéos produits (admin)" on storage.objects
  for insert with check (bucket_id = 'product-videos');

drop policy if exists "Suppression vidéos produits (admin)" on storage.objects;
create policy "Suppression vidéos produits (admin)" on storage.objects
  for delete using (bucket_id = 'product-videos');
