-- =========================================================
-- PrecoTech237 — Migration : suivi des commandes
-- À exécuter UNE SEULE FOIS : Supabase > SQL Editor > New query > Run
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text not null,
  email text not null,
  produit_id text references products(id),
  produit_nom text not null,
  quantite int not null default 1,
  transport_id text,
  transport_label text,
  cout_produit numeric,
  cout_transport numeric,
  cout_total numeric,
  adresse text not null,
  message text,
  statut text not null default 'en_attente', -- en_attente, confirmee, expediee, livree, annulee
  created_at timestamptz default now()
);

alter table orders enable row level security;

-- N'importe quel client peut enregistrer sa commande (aucun compte requis pour commander)
drop policy if exists "Ajout public d'une commande" on orders;
create policy "Ajout public d'une commande" on orders
  for insert with check (true);

-- Seul l'administrateur connecté peut consulter et gérer les commandes
-- (un client ne doit jamais pouvoir voir les commandes des autres)
drop policy if exists "Lecture commandes (admin connecté)" on orders;
create policy "Lecture commandes (admin connecté)" on orders
  for select using (auth.role() = 'authenticated');

drop policy if exists "Modification commandes (admin connecté)" on orders;
create policy "Modification commandes (admin connecté)" on orders
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Suppression commandes (admin connecté)" on orders;
create policy "Suppression commandes (admin connecté)" on orders
  for delete using (auth.role() = 'authenticated');

create index if not exists orders_created_at_idx on orders (created_at desc);
create index if not exists orders_statut_idx on orders (statut);
