-- =====================================================================
-- 0004 — Qualification biologique du don (chaîne du laboratoire)
--
-- Jusqu'ici, `analyses` ne gardait qu'un verdict résumé : un groupe
-- sanguin et « conforme / non conforme ». C'est insuffisant pour un
-- laboratoire de qualification : la loi et la pratique exigent de
-- tracer CHAQUE examen, qui l'a fait et quand.
--
-- Cette migration ajoute les trois étapes réelles de la chaîne :
--   1. réception et contrôle de conformité des tubes ;
--   2. immuno-hématologie : groupage ABO/RhD en double détermination ;
--   3. qualification biologique : sérologie des maladies transmissibles.
--
-- La table `analyses` existante n'est pas touchée : elle reste le
-- verdict final, écrit à la libération. Les tables ajoutées ici la
-- documentent. Les anciennes poches restent donc lisibles.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Réception des tubes au laboratoire
-- ---------------------------------------------------------------------
-- Une poche arrive accompagnée de tubes d'échantillon. Si les tubes sont
-- absents, mal étiquetés, hémolysés ou en quantité insuffisante, la poche
-- ne peut pas être qualifiée : elle est écartée immédiatement.
create table if not exists receptions_laboratoire (
  id            uuid primary key default gen_random_uuid(),
  poche_id      uuid not null unique references poches(id),
  conforme      boolean not null,
  -- Renseigné seulement si conforme = false.
  motif         text check (motif in (
    'tubes_absents', 'etiquetage_illisible', 'echantillon_hemolyse',
    'volume_insuffisant', 'chaine_du_froid_rompue', 'autre'
  )),
  precisions    text not null default '',
  technicien_id uuid not null references utilisateurs(id),
  cree_le       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Immuno-hématologie : groupage ABO/RhD
-- ---------------------------------------------------------------------
-- Règle de sécurité transfusionnelle : le groupe n'est validé que si
-- DEUX déterminations indépendantes concordent. La contrainte ci-dessous
-- empêche d'enregistrer un groupe validé sur une seule lecture.
create table if not exists groupages (
  id              uuid primary key default gen_random_uuid(),
  poche_id        uuid not null unique references poches(id),
  -- Première détermination (épreuve globulaire, dite Beth-Vincent).
  determination_1 text not null check (determination_1 in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  -- Seconde détermination (épreuve plasmatique, dite Simonin), faite
  -- par un second technicien ou sur un second réactif.
  determination_2 text not null check (determination_2 in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  -- Recherche d'agglutinines irrégulières : positive = sang réservé à
  -- certains receveurs, jamais utilisé en urgence vitale sans contrôle.
  rai_positive    boolean not null default false,
  phenotype       text not null default '',   -- ex. « RH:1,2,-3,4,5 K:-1 »
  technicien_id   uuid not null references utilisateurs(id),
  cree_le         timestamptz not null default now(),
  -- Un groupage n'est enregistré que si les deux lectures concordent ;
  -- une discordance se résout au laboratoire, pas dans la base.
  constraint determinations_concordantes check (determination_1 = determination_2)
);

-- ---------------------------------------------------------------------
-- 3. Qualification biologique : sérologie
-- ---------------------------------------------------------------------
-- Marqueurs obligatoires avant toute transfusion. Un seul résultat
-- positif rend la poche non conforme, définitivement.
create table if not exists serologies (
  id            uuid primary key default gen_random_uuid(),
  poche_id      uuid not null references poches(id),
  marqueur      text not null check (marqueur in (
    'vih', 'hepatite_b', 'hepatite_c', 'syphilis', 'htlv', 'paludisme'
  )),
  resultat      text not null check (resultat in ('negatif', 'positif', 'ininterpretable')),
  technicien_id uuid not null references utilisateurs(id),
  cree_le       timestamptz not null default now(),
  -- Un marqueur n'est testé qu'une fois par poche ; un contrôle qui
  -- infirme un résultat remplace la ligne plutôt que d'en ajouter une.
  unique (poche_id, marqueur)
);

create index if not exists idx_serologies_poche on serologies(poche_id);

-- ---------------------------------------------------------------------
-- Statut de poche : l'étape « reçue au laboratoire »
-- ---------------------------------------------------------------------
-- Entre « prelevee » (au centre) et le verdict, la poche passe par le
-- laboratoire. Le statut 'en_analyse' existait déjà dans le CHECK mais
-- n'était jamais utilisé : la chaîne s'en sert désormais.
-- Aucun changement de contrainte n'est nécessaire.

-- ---------------------------------------------------------------------
-- Événements : tracer les étapes du laboratoire
-- ---------------------------------------------------------------------
alter table evenements drop constraint if exists evenements_type_check;
alter table evenements add constraint evenements_type_check check (type in (
  'prelevement', 'analyse', 'preparation', 'expedition', 'reception',
  'delivrance', 'destruction', 'reinitialisation', 'inscription',
  'connexion', 'alerte', 'cloture_alerte', 'pause', 'modification',
  -- Ajouts de la chaîne du laboratoire :
  'reception_labo', 'groupage', 'serologie'
));

-- ---------------------------------------------------------------------
-- Suivi médical : motif normalisé
-- ---------------------------------------------------------------------
-- Une sérologie positive impose de recontacter le donneur par un
-- médecin. Le résultat ne lui est JAMAIS transmis par l'application.
comment on table suivis_medicaux is
  'Donneurs à recontacter par un médecin (sérologie positive, ajournement médical). '
  'Le motif ne doit jamais être exposé à l''application du donneur.';
