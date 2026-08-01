-- =========================================================
-- PrecoTech237 — Migration : suivi de commande côté client
-- À exécuter UNE SEULE FOIS : Supabase > SQL Editor > New query > Run
-- ---------------------------------------------------------
-- Pourquoi des fonctions plutôt qu'une simple règle de lecture publique ?
-- Si on autorisait la lecture publique de la table "orders", n'importe qui
-- pourrait interroger l'API Supabase directement et récupérer TOUTES les
-- commandes (noms, téléphones, adresses de tous vos clients) — pas
-- seulement la sienne. Les fonctions ci-dessous ne renvoient que les
-- informations d'UNE commande précise (celle dont on connaît déjà l'ID,
-- un identifiant unique impossible à deviner), et jamais les données
-- sensibles (téléphone, e-mail, adresse) — uniquement ce qui est utile
-- pour le suivi (produit, quantité, statut).
-- =========================================================

-- Étapes possibles, dans l'ordre (on ne peut jamais revenir en arrière)
-- en_attente -> confirmee -> expediee -> livree
-- (annulee peut survenir à tout moment avant livree)

create or replace function get_order_tracking(p_order_id uuid)
returns table (
  id uuid,
  produit_id text,
  produit_nom text,
  quantite int,
  transport_label text,
  statut text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select o.id, o.produit_id, o.produit_nom, o.quantite, o.transport_label, o.statut, o.created_at
  from orders o
  where o.id = p_order_id;
$$;

grant execute on function get_order_tracking(uuid) to anon, authenticated;

-- Le client ne peut marquer "reçu" QUE si la commande est au statut "expediee"
-- (impossible de sauter une étape ou de revenir en arrière depuis cette fonction)
create or replace function mark_order_received(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut text;
begin
  select statut into v_statut from orders where id = p_order_id;
  if v_statut = 'expediee' then
    update orders set statut = 'livree' where id = p_order_id;
    return true;
  end if;
  return false;
end;
$$;

grant execute on function mark_order_received(uuid) to anon, authenticated;
