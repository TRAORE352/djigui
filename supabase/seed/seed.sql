-- =====================================================================
-- Seed : données de test (semaine 3).
--
-- Contenu (cahier des charges, calendrier S3) :
--   - zones (4 villes du Burkina Faso) et sites de Ouagadougou ;
--   - les 3 types de produits ;
--   - les valeurs provisoires de l'Annexe E (règles) ;
--   - les premiers comptes d'agents (en attendant l'espace administrateur).
--
-- Aucune vraie donnée de donneur ici.
--
-- MOT DE PASSE DE TEST (à changer dès que l'espace administrateur existe) :
--   ChangeMoi2026!
-- Le hash bcrypt est généré par pgcrypto (compatible bcryptjs côté backend).
--
-- Script rejouable : ON CONFLICT DO NOTHING partout.
-- =====================================================================

-- ---------- Zones (4 villes du Burkina Faso) ----------
insert into zones (nom, ville) values
  -- Ouagadougou
  ('Kamsonghin', 'Ouagadougou'),
  ('Tanghin', 'Ouagadougou'),
  ('Dassasgho', 'Ouagadougou'),
  ('Gounghin', 'Ouagadougou'),
  ('Paspanga', 'Ouagadougou'),
  ('Koulouba', 'Ouagadougou'),
  -- Bobo-Dioulasso
  ('Accart-ville', 'Bobo-Dioulasso'),
  ('Bolomakoté', 'Bobo-Dioulasso'),
  ('Dafra', 'Bobo-Dioulasso'),
  ('Dô', 'Bobo-Dioulasso'),
  ('Konsa', 'Bobo-Dioulasso'),
  ('Tounouma', 'Bobo-Dioulasso'),
  -- Koudougou
  ('Secteur 1', 'Koudougou'),
  ('Secteur 2', 'Koudougou'),
  ('Secteur 3', 'Koudougou'),
  ('Secteur 4', 'Koudougou'),
  ('Secteur 5', 'Koudougou'),
  -- Ouahigouya
  ('Secteur 1', 'Ouahigouya'),
  ('Secteur 2', 'Ouahigouya'),
  ('Secteur 3', 'Ouahigouya'),
  ('Secteur 4', 'Ouahigouya'),
  ('Secteur 5', 'Ouahigouya')
on conflict (nom, ville) do nothing;

-- ---------- Sites ----------
insert into sites (code, nom, type, adresse, zone_id, telephone, horaires) values
  ('OUA', 'CNTS Ouagadougou', 'centre',
   'Avenue de l''Hôpital Yalgado', (select id from zones where nom='Kamsonghin'),
   '+226 25 30 60 00', 'Lundi au vendredi, 7h30 à 15h30'),
  ('YAL', 'Dépôt CHU Yalgado', 'depot',
   'CHU Yalgado Ouédraogo', (select id from zones where nom='Koulouba'),
   '+226 25 31 00 00', 'Tous les jours, 24h/24'),
  -- Centres de transfusion des autres villes
  ('BOB', 'CNTS Bobo-Dioulasso', 'centre', 'CHU Sourô Sanou',
   (select id from zones where ville='Bobo-Dioulasso' order by nom limit 1), '', 'Lundi au vendredi, 7h30 à 15h30'),
  ('KDG', 'CNTS Koudougou', 'centre', 'CHR Koudougou',
   (select id from zones where ville='Koudougou' order by nom limit 1), '', 'Lundi au vendredi, 7h30 à 15h30'),
  ('OHG', 'CNTS Ouahigouya', 'centre', 'CHR Ouahigouya',
   (select id from zones where ville='Ouahigouya' order by nom limit 1), '', 'Lundi au vendredi, 7h30 à 15h30'),
  -- Centres de santé publics (hôpitaux) qui adressent des demandes
  ('CYG', 'CHU Yalgado Ouédraogo', 'hopital', 'Ouagadougou',
   (select id from zones where ville='Ouagadougou' order by nom limit 1), '', ''),
  ('CBG', 'CHU de Bogodogo', 'hopital', 'Ouagadougou',
   (select id from zones where ville='Ouagadougou' order by nom limit 1), '', ''),
  ('CTG', 'CHU de Tengandogo', 'hopital', 'Ouagadougou',
   (select id from zones where ville='Ouagadougou' order by nom limit 1), '', ''),
  ('HSC', 'Hôpital Saint Camille', 'hopital', 'Ouagadougou',
   (select id from zones where ville='Ouagadougou' order by nom limit 1), '', ''),
  ('CPY', 'CMA de Pissy', 'hopital', 'Ouagadougou',
   (select id from zones where ville='Ouagadougou' order by nom limit 1), '', ''),
  ('CDS', 'CSPS de Dassasgho', 'hopital', 'Ouagadougou',
   (select id from zones where ville='Ouagadougou' order by nom limit 1), '', ''),
  ('CGN', 'CSPS de Gounghin', 'hopital', 'Ouagadougou',
   (select id from zones where ville='Ouagadougou' order by nom limit 1), '', ''),
  ('CSS', 'CHU Sourô Sanou', 'hopital', 'Bobo-Dioulasso',
   (select id from zones where ville='Bobo-Dioulasso' order by nom limit 1), '', ''),
  ('CDF', 'CMA de Dafra', 'hopital', 'Bobo-Dioulasso',
   (select id from zones where ville='Bobo-Dioulasso' order by nom limit 1), '', ''),
  ('CBM', 'CSPS de Bolomakoté', 'hopital', 'Bobo-Dioulasso',
   (select id from zones where ville='Bobo-Dioulasso' order by nom limit 1), '', ''),
  ('CTM', 'CSPS de Tounouma', 'hopital', 'Bobo-Dioulasso',
   (select id from zones where ville='Bobo-Dioulasso' order by nom limit 1), '', ''),
  ('CKD', 'CHR de Koudougou', 'hopital', 'Koudougou',
   (select id from zones where ville='Koudougou' order by nom limit 1), '', ''),
  ('CKK', 'CMA de Koudougou', 'hopital', 'Koudougou',
   (select id from zones where ville='Koudougou' order by nom limit 1), '', ''),
  ('CDP', 'CSPS de Dapoya', 'hopital', 'Koudougou',
   (select id from zones where ville='Koudougou' order by nom limit 1), '', ''),
  ('CRO', 'CHR de Ouahigouya', 'hopital', 'Ouahigouya',
   (select id from zones where ville='Ouahigouya' order by nom limit 1), '', ''),
  ('CMO', 'CMA de Ouahigouya', 'hopital', 'Ouahigouya',
   (select id from zones where ville='Ouahigouya' order by nom limit 1), '', '')
on conflict (code) do nothing;

-- ---------- Types de produits ----------
-- duree_conservation_jours : Annexe E #3 « à définir » par le CNTS, laissée null.
insert into types_produits (code, nom, duree_conservation_jours) values
  ('GR', 'Globules rouges', null),
  ('PL', 'Plasma', null),
  ('PQ', 'Plaquettes', null)
on conflict (code) do nothing;

-- ---------- Règles (valeurs provisoires, Annexe E + chapitre 4) ----------
insert into regles (cle, valeur, description) values
  ('delai_homme_mois', '3', 'Délai entre deux dons pour un homme (mois) — Annexe E #1'),
  ('delai_femme_mois', '4', 'Délai entre deux dons pour une femme (mois) — Annexe E #1'),
  ('code_validite_minutes', '10', 'Durée de validité d''un code de vérification'),
  ('code_essais_max', '5', 'Essais maximum par code avant annulation'),
  ('code_demandes_max_jour', '5', 'Demandes de code maximum par numéro et par jour'),
  ('delai_min_alerte_jours', '7', 'Une alerte par donneur et par semaine (règle anti-lassitude)')
on conflict (cle) do nothing;

-- ---------- Comptes agents (e-mail + mot de passe) ----------
-- Le hash bcrypt est identique pour tous (ChangeMoi2026!) ; chaque compte
-- devra changer son mot de passe à la première connexion réelle.
do $$
declare
  hash text := crypt('ChangeMoi2026!', gen_salt('bf', 10));
  site_oua uuid := (select id from sites where code='OUA');
  site_yal uuid := (select id from sites where code='YAL');
begin
  -- Administrateur (CNTS)
  insert into utilisateurs (nom, prenom, email, telephone, mot_de_passe, site_id)
  values ('CNTS', 'Admin', 'admin@cnts.bf', '+226 70 00 00 00', hash, site_oua)
  on conflict (email) do nothing;
  insert into utilisateur_roles (utilisateur_id, role)
  select id, 'admin' from utilisateurs where email='admin@cnts.bf'
  on conflict do nothing;

  -- Agent d'accueil / prélèvement (centre)
  insert into utilisateurs (nom, prenom, email, telephone, mot_de_passe, site_id)
  values ('Agent', 'Accueil', 'accueil@cnts.bf', '+226 70 00 00 01', hash, site_oua)
  on conflict (email) do nothing;
  insert into utilisateur_roles (utilisateur_id, role)
  select id, 'agent_accueil' from utilisateurs where email='accueil@cnts.bf'
  on conflict do nothing;
  insert into utilisateur_roles (utilisateur_id, role)
  select id, 'agent_prelevement' from utilisateurs where email='accueil@cnts.bf'
  on conflict do nothing;

  -- Technicien de laboratoire (centre)
  insert into utilisateurs (nom, prenom, email, telephone, mot_de_passe, site_id)
  values ('Technicien', 'Labo', 'labo@cnts.bf', '+226 70 00 00 02', hash, site_oua)
  on conflict (email) do nothing;
  insert into utilisateur_roles (utilisateur_id, role)
  select id, 'agent_labo' from utilisateurs where email='labo@cnts.bf'
  on conflict do nothing;

  -- Gestionnaire de stock (centre + dépôt)
  insert into utilisateurs (nom, prenom, email, telephone, mot_de_passe, site_id)
  values ('Gestionnaire', 'Stock', 'stock@cnts.bf', '+226 70 00 00 03', hash, site_oua)
  on conflict (email) do nothing;
  insert into utilisateur_roles (utilisateur_id, role)
  select id, 'agent_stock' from utilisateurs where email='stock@cnts.bf'
  on conflict do nothing;
  insert into utilisateur_roles (utilisateur_id, role)
  select id, 'agent_depot' from utilisateurs where email='stock@cnts.bf'
  on conflict do nothing;

  -- Agent du dépôt de l'hôpital
  insert into utilisateurs (nom, prenom, email, telephone, mot_de_passe, site_id)
  values ('Agent', 'Depot', 'depot@yalgado.bf', '+226 70 00 00 04', hash, site_yal)
  on conflict (email) do nothing;
  insert into utilisateur_roles (utilisateur_id, role)
  select id, 'agent_depot' from utilisateurs where email='depot@yalgado.bf'
  on conflict do nothing;
end $$;

-- ---------- Contrôles (le seed doit montrer ce qu'il a créé) ----------
select 'zones' as objet, count(*)::text as nb from zones
union all select 'sites', count(*)::text from sites
union all select 'types_produits', count(*)::text from types_produits
union all select 'regles', count(*)::text from regles
union all select 'utilisateurs', count(*)::text from utilisateurs
union all select 'utilisateur_roles', count(*)::text from utilisateur_roles;
