-- =====================================================================
-- 0006 — Entrées de stock externes (lots reçus)
--
-- Jusqu'ici, un produit ne pouvait naître que d'une poche prélevée sur
-- place puis qualifiée au laboratoire (`produits.poche_id not null`).
-- Or un centre de santé reçoit aussi des poches déjà qualifiées, livrées
-- par un laboratoire ou une banque de sang : il n'existait aucune porte
-- d'entrée pour elles, et le stock ne pouvait pas être alimenté.
--
-- Choix de modélisation : la SAISIE se fait par lot (« 40 × GR O+,
-- péremption au 15/12 »), mais le STOCKAGE reste unitaire. Le lot est
-- éclaté en autant de lignes `produits` que d'unités, avec un code
-- généré. Raison : toute la chaîne existante travaille à l'unité
-- (délivrance, expédition, destruction font `where id = $1`). Une ligne
-- « quantité 40 » aurait obligé à réécrire la distribution entière, et
-- surtout on aurait perdu la trace de QUELLE unité est partie où.
-- =====================================================================

-- Un produit reçu de l'extérieur n'a pas de poche dans NOTRE système.
-- La contrainte reste garantie autrement : voir le check ci-dessous.
alter table produits alter column poche_id drop not null;

-- Origine d'un lot reçu. On garde qui a livré, quand, et qui a validé
-- la réception : c'est la pièce justificative de l'entrée en stock.
create table lots_entrants (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null,              -- bordereau du fournisseur
  site_id           uuid not null references sites(id),        -- qui reçoit
  fournisseur_id    uuid references sites(id),                 -- site du réseau…
  fournisseur_libre text,                                      -- …ou nom libre
  recu_par          uuid not null references utilisateurs(id),
  recu_le           timestamptz not null default now(),
  note              text,
  cree_le           timestamptz not null default now(),
  -- Un fournisseur doit être identifié, d'une façon ou d'une autre.
  constraint lot_fournisseur_identifie
    check (fournisseur_id is not null or nullif(btrim(fournisseur_libre), '') is not null)
);

create index idx_lots_entrants_site on lots_entrants (site_id, recu_le desc);

-- Rattachement d'une unité à son lot d'origine.
alter table produits add column lot_id uuid references lots_entrants(id);

create index idx_produits_lot on produits (lot_id);

-- Un produit vient SOIT d'une poche prélevée ici, SOIT d'un lot reçu —
-- jamais des deux, jamais d'aucun des deux. C'est cette contrainte qui
-- remplace le `not null` retiré plus haut : l'origine reste obligatoire.
alter table produits add constraint produit_origine_unique
  check (
    (poche_id is not null and lot_id is null)
    or (poche_id is null and lot_id is not null)
  );

-- Le journal d'événements est immuable et son type est contraint : sans
-- cette valeur, l'entrée d'un lot ne pourrait pas être tracée (insert
-- refusé). Une entrée en stock est une action importante — elle doit
-- laisser une trace au même titre qu'une délivrance.
--
-- ATTENTION : la liste doit reprendre TOUS les types déjà utilisés, y
-- compris ceux ajoutés par 0004 pour la qualification biologique
-- ('groupage', 'reception_labo', 'serologie'). Les omettre fait échouer
-- la migration sur les lignes existantes (« is violated by some row ») :
-- le journal est immuable, on ne peut pas nettoyer ces lignes.
alter table evenements drop constraint if exists evenements_type_check;
alter table evenements add constraint evenements_type_check check (type in (
  'prelevement', 'analyse', 'preparation', 'expedition', 'reception',
  'delivrance', 'destruction', 'reinitialisation', 'inscription',
  'connexion', 'alerte', 'cloture_alerte', 'pause', 'modification',
  'groupage', 'reception_labo', 'serologie',
  'entree_stock'
));
