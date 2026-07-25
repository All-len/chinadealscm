-- =========================================================
-- PrecoTech237 — Migration : disponibilité (stock) des produits
-- À exécuter UNE SEULE FOIS : Supabase > SQL Editor > New query > Run
-- =========================================================

alter table products add column if not exists disponibilite text default 'en_stock';
-- Valeurs possibles : 'en_stock', 'sur_commande', 'rupture'

update products set disponibilite = 'en_stock' where disponibilite is null;
