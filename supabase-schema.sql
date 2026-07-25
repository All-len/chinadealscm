-- =========================================================
-- PrecoTech237 — Schéma de base de données Supabase
-- À coller dans : Supabase > SQL Editor > New query > Run
-- =========================================================

-- Table des produits
create table if not exists products (
  id text primary key,
  nom text not null,
  categorie text not null,
  categorie_label text not null,
  prix numeric not null,
  etat text,
  badge text,
  description text,
  specs jsonb default '[]'::jsonb,
  poids_kg numeric default 0,
  longueur_cm numeric default 0,
  largeur_cm numeric default 0,
  hauteur_cm numeric default 0,
  created_at timestamptz default now()
);

-- Table des réglages du site (coordonnées de contact, modes de transport)
create table if not exists site_settings (
  key text primary key,
  value jsonb not null
);

-- Activation de la sécurité au niveau des lignes (RLS)
alter table products enable row level security;
alter table site_settings enable row level security;

-- Lecture publique (tout le monde peut voir le catalogue, sans compte)
create policy "Lecture publique des produits" on products
  for select using (true);

create policy "Lecture publique des réglages" on site_settings
  for select using (true);

-- Écriture depuis l'espace admin (voir avertissement dans GUIDE-SUPABASE.md :
-- cette politique reste permissive car la clé "anon" est utilisée côté client ;
-- la protection réelle reste le code d'accès de admin.html, pas une vraie
-- authentification serveur).
create policy "Écriture produits (admin)" on products
  for all using (true) with check (true);

create policy "Écriture réglages (admin)" on site_settings
  for all using (true) with check (true);

-- ---------------------------------------------------------
-- Insertion de vos 8 produits actuels
-- ---------------------------------------------------------
insert into products (id, nom, categorie, categorie_label, prix, etat, badge, description, specs, poids_kg, longueur_cm, largeur_cm, hauteur_cm) values
('lap-014', 'HP Pavilion 15 — i7 / 16Go / 512Go SSD', 'laptops', 'Laptops', 285000, 'Neuf, scellé d''usine', 'Populaire',
 'Ce laptop HP Pavilion 15 est idéal pour un usage professionnel comme personnel. Processeur Intel Core i7 de dernière génération, 16 Go de RAM pour un multitâche fluide, et 512 Go de stockage SSD pour un démarrage rapide. Écran Full HD 15,6 pouces, clavier rétroéclairé, autonomie longue durée.',
 '[["Processeur","Intel Core i7 (12e génération)"],["RAM","16 Go"],["Stockage","512 Go SSD"],["Écran","15,6\" Full HD"],["Système","Windows 11"],["Garantie","6 mois PrecoTech237"]]'::jsonb,
 2.5, 45, 35, 8),

('lap-009', 'Lenovo ThinkPad E14 — i5 / 8Go / 256Go SSD', 'laptops', 'Laptops', 195000, 'Neuf', '',
 'Le Lenovo ThinkPad E14 allie robustesse et efficacité pour un usage bureautique intensif. Clavier confortable, châssis renforcé, autonomie fiable pour toute une journée de travail.',
 '[["Processeur","Intel Core i5 (11e génération)"],["RAM","8 Go"],["Stockage","256 Go SSD"],["Écran","14\" Full HD"],["Système","Windows 11"],["Garantie","6 mois PrecoTech237"]]'::jsonb,
 2.2, 40, 30, 7),

('pcg-022', 'PC Gamer RTX 4060 — i7 / 16Go / 1To SSD', 'pc-gaming', 'PC Gaming', 520000, 'Neuf', 'Best-seller',
 'Configuration puissante conçue pour les jeux exigeants et le montage vidéo. Carte graphique RTX 4060, refroidissement optimisé, châssis RGB personnalisable.',
 '[["Processeur","Intel Core i7 (13e génération)"],["Carte graphique","NVIDIA RTX 4060 8 Go"],["RAM","16 Go DDR5"],["Stockage","1 To SSD NVMe"],["Alimentation","650W certifiée"],["Garantie","6 mois PrecoTech237"]]'::jsonb,
 12, 55, 25, 50),

('pcg-018', 'PC Gamer RTX 3060 — Ryzen 5 / 16Go / 512Go SSD', 'pc-gaming', 'PC Gaming', 410000, 'Neuf', '',
 'Excellent rapport performance/prix pour jouer en 1080p/1440p dans de bonnes conditions. Idéal pour les gamers qui veulent une machine fiable sans se ruiner.',
 '[["Processeur","AMD Ryzen 5 5600X"],["Carte graphique","NVIDIA RTX 3060 12 Go"],["RAM","16 Go DDR4"],["Stockage","512 Go SSD NVMe"],["Alimentation","550W"],["Garantie","6 mois PrecoTech237"]]'::jsonb,
 11, 52, 24, 48),

('tel-031', 'Samsung Galaxy A55 5G — 128 Go', 'telephones', 'Téléphones', 165000, 'Neuf sous scellé', 'Populaire',
 'Le Galaxy A55 5G combine un bel écran AMOLED, un appareil photo performant et une autonomie confortable, dans un châssis résistant IP67.',
 '[["Écran","6,6\" Super AMOLED"],["Stockage","128 Go"],["RAM","8 Go"],["Caméra","50 MP triple capteur"],["Batterie","5000 mAh"],["Garantie","6 mois PrecoTech237"]]'::jsonb,
 0.4, 17, 8, 6),

('tel-027', 'iPhone 13 — 128 Go (Reconditionné Grade A)', 'telephones', 'Téléphones', 245000, 'Reconditionné — Grade A', '',
 'iPhone 13 reconditionné, testé et vérifié avant expédition. Batterie certifiée au-dessus de 85% de capacité. Aspect proche du neuf.',
 '[["Écran","6,1\" Super Retina XDR"],["Stockage","128 Go"],["Puce","Apple A15 Bionic"],["Caméra","Double capteur 12 MP"],["État batterie","≥ 85%"],["Garantie","3 mois PrecoTech237"]]'::jsonb,
 0.4, 16, 8, 6),

('lap-031', 'Dell Inspiron 15 — i5 / 12Go / 512Go SSD', 'laptops', 'Laptops', 230000, 'Neuf', '',
 'Un laptop polyvalent pour les études et le travail de bureau, avec un bon équilibre entre puissance et autonomie.',
 '[["Processeur","Intel Core i5 (12e génération)"],["RAM","12 Go"],["Stockage","512 Go SSD"],["Écran","15,6\" Full HD"],["Système","Windows 11"],["Garantie","6 mois PrecoTech237"]]'::jsonb,
 2.4, 42, 32, 8),

('tel-040', 'Xiaomi Redmi Note 13 Pro — 256 Go', 'telephones', 'Téléphones', 130000, 'Neuf sous scellé', 'Prix mini',
 'Un excellent rapport qualité-prix avec un grand écran AMOLED, une charge rapide et un appareil photo 200 MP.',
 '[["Écran","6,67\" AMOLED 120Hz"],["Stockage","256 Go"],["RAM","8 Go"],["Caméra","200 MP"],["Batterie","5100 mAh, charge 67W"],["Garantie","6 mois PrecoTech237"]]'::jsonb,
 0.45, 17, 8, 6)

on conflict (id) do nothing;

-- ---------------------------------------------------------
-- Réglages du site : coordonnées de contact et modes de transport
-- ---------------------------------------------------------
insert into site_settings (key, value) values
('contact', '{"whatsappNumber":"237600000000","email":"contact@precotech237.com","telephone":"+237 6XX XXX XXX","ville":"Bafoussam, Cameroun"}'::jsonb),
('transport_modes', '[
  {"id":"maritime","label":"Maritime","delai":"45 à 60 jours","note":"Le plus économique, idéal pour les grosses commandes","unite":"CBM","tarif":360000},
  {"id":"aerien-normal","label":"Aérien normal","delai":"15 à 21 jours","note":"Bon équilibre entre coût et rapidité","unite":"kg","tarif":8500},
  {"id":"aerien-express","label":"Aérien express","delai":"7 jours maximum","note":"Livraison rapide pour les besoins urgents","unite":"kg","tarif":14000}
]'::jsonb)
on conflict (key) do nothing;
