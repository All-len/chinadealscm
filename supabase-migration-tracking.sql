-- =========================================================
-- PrecoTech237 — Migration : suivi de commande client
-- À exécuter UNE SEULE FOIS : Supabase > SQL Editor > New query > Run
-- ---------------------------------------------------------
-- Principe de sécurité : la table `orders` reste strictement
-- réservée à l'administrateur connecté (comme avant). Pour
-- permettre à un client de suivre SA commande sans compte, on
-- passe par deux fonctions dédiées (RPC) qui ne donnent accès
-- qu'à la commande correspondant à son code de suivi personnel
-- — jamais à la liste complète des commandes.
-- =========================================================

-- Code de suivi unique par commande (ex: "A3F9K2LQ")
alter table orders add column if not exists tracking_code text unique;

-- Remplit un code de suivi pour les commandes existantes qui n'en ont pas encore
update orders set tracking_code = substr(md5(random()::text || id::text), 1, 8)
where tracking_code is null;

-- ---------------------------------------------------------
-- Fonction 1 : un client consulte SA commande via son code
-- ---------------------------------------------------------
create or replace function get_order_by_tracking(p_code text)
returns setof orders
language sql
security definer
set search_path = public
as $$
  select * from orders where tracking_code = p_code;
$$;

grant execute on function get_order_by_tracking(text) to anon, authenticated;

-- ---------------------------------------------------------
-- Fonction 2 : le client confirme lui-même la réception
-- (uniquement possible si la commande est au statut "expediee",
-- pour respecter la progression à sens unique)
-- ---------------------------------------------------------
create or replace function mark_order_delivered(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut text;
begin
  select statut into v_statut from orders where tracking_code = p_code;
  if v_statut is null or v_statut <> 'expediee' then
    return false;
  end if;
  update orders set statut = 'livree' where tracking_code = p_code;
  return true;
end;
$$;

grant execute on function mark_order_delivered(text) to anon, authenticated;
