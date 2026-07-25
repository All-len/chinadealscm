-- =========================================================
-- PrecoTech237 — Migration : poids/volume, tarifs transport, avis clients
-- À exécuter UNE SEULE FOIS : Supabase > SQL Editor > New query > Run
-- (Ce script est sûr à exécuter même si des données existent déjà :
--  il n'efface rien, il ajoute/complète.)
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- 1) Poids et dimensions carton sur chaque produit
--    (nécessaires pour calculer le coût de transport)
-- ---------------------------------------------------------
alter table products add column if not exists poids_kg numeric;
alter table products add column if not exists longueur_cm numeric;
alter table products add column if not exists largeur_cm numeric;
alter table products add column if not exists hauteur_cm numeric;

-- Valeurs de départ pour vos 8 produits actuels
-- (à ajuster librement depuis l'onglet "Produits" de admin.html)
update products set poids_kg = 2.5,  longueur_cm = 40, largeur_cm = 30, hauteur_cm = 8  where id = 'lap-014';
update products set poids_kg = 2.2,  longueur_cm = 38, largeur_cm = 28, hauteur_cm = 7  where id = 'lap-009';
update products set poids_kg = 10,   longueur_cm = 55, largeur_cm = 25, hauteur_cm = 50 where id = 'pcg-022';
update products set poids_kg = 9,    longueur_cm = 52, largeur_cm = 24, hauteur_cm = 48 where id = 'pcg-018';
update products set poids_kg = 0.4,  longueur_cm = 17, largeur_cm = 8,  hauteur_cm = 6  where id = 'tel-031';
update products set poids_kg = 0.35, longueur_cm = 16, largeur_cm = 8,  hauteur_cm = 6  where id = 'tel-027';
update products set poids_kg = 2.4,  longueur_cm = 42, largeur_cm = 32, hauteur_cm = 8  where id = 'lap-031';
update products set poids_kg = 0.45, longueur_cm = 17, largeur_cm = 8,  hauteur_cm = 6  where id = 'tel-040';

-- ---------------------------------------------------------
-- 2) Tarifs de transport
--    Aérien normal : 8 500 FCFA/kg — Aérien express : 14 000 FCFA/kg
--    Maritime : 360 000 FCFA/CBM (mètre cube)
-- ---------------------------------------------------------
insert into site_settings (key, value) values
('transport_modes', '[
  {"id":"maritime","label":"Maritime","delai":"45 à 60 jours","note":"Le plus économique, idéal pour les grosses commandes","unite":"CBM","tarif":360000},
  {"id":"aerien-normal","label":"Aérien normal","delai":"15 à 21 jours","note":"Bon équilibre entre coût et rapidité","unite":"kg","tarif":8500},
  {"id":"aerien-express","label":"Aérien express","delai":"7 jours maximum","note":"Livraison rapide pour les besoins urgents","unite":"kg","tarif":14000}
]'::jsonb)
on conflict (key) do update set value = excluded.value;

-- ---------------------------------------------------------
-- 3) Table des avis clients (avec photos)
-- ---------------------------------------------------------
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text references products(id) on delete cascade,
  nom text not null,
  note int not null check (note between 1 and 5),
  commentaire text,
  photos jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table reviews enable row level security;

drop policy if exists "Lecture publique des avis" on reviews;
create policy "Lecture publique des avis" on reviews for select using (true);

drop policy if exists "Ajout public d'un avis" on reviews;
create policy "Ajout public d'un avis" on reviews for insert with check (true);

-- Modération (suppression) depuis l'espace admin — voir avertissement
-- sur la sécurité dans LISEZ-MOI.md (clé anon utilisée côté client)
drop policy if exists "Suppression des avis (admin)" on reviews;
create policy "Suppression des avis (admin)" on reviews for delete using (true);

-- ---------------------------------------------------------
-- 4) Espace de stockage pour les photos jointes aux avis
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('review-photos', 'review-photos', true)
on conflict (id) do nothing;

drop policy if exists "Lecture publique photos avis" on storage.objects;
create policy "Lecture publique photos avis" on storage.objects
  for select using (bucket_id = 'review-photos');

drop policy if exists "Upload public photos avis" on storage.objects;
create policy "Upload public photos avis" on storage.objects
  for insert with check (bucket_id = 'review-photos');

drop policy if exists "Suppression photos avis (admin)" on storage.objects;
create policy "Suppression photos avis (admin)" on storage.objects
  for delete using (bucket_id = 'review-photos');
