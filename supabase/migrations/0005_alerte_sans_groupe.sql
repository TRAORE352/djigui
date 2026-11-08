-- =====================================================================
-- 0005 — Un appel au don peut cibler SANS groupe sanguin
--
-- Le ciblage réel n'a jamais regardé le groupe : `donneursEligibles()`
-- sélectionne par zone, éligibilité et délai depuis le dernier appel —
-- le commentaire du code le disait déjà (« Le groupe n'est jamais un
-- critère »). Mais le formulaire IMPOSAIT de choisir un groupe, et la
-- colonne était `not null` : l'interface affirmait donc une précision
-- que le métier n'applique pas.
--
-- C'est faux sur le terrain, et contre-productif : la plupart des
-- donneurs ignorent leur groupe, et c'est le laboratoire qui le
-- déterminera après le prélèvement. Exiger un groupe pour appeler
-- revenait à exclure d'avance ceux qu'on cherche justement à faire venir.
--
-- Désormais : groupe_sanguin est NULLABLE.
--   · NULL  = appel ouvert à tous les donneurs de la zone (cas normal) ;
--   · 'O-'  = appel qui MENTIONNE un groupe, pour le message au donneur
--             (« nous manquons de O- ») — sans restreindre l'envoi.
--
-- Les alertes existantes gardent leur valeur : rien à migrer.
-- =====================================================================

alter table alertes
  alter column groupe_sanguin drop not null;

-- La contrainte de valeur reste, mais doit désormais tolérer NULL.
alter table alertes
  drop constraint if exists alertes_groupe_sanguin_check;

alter table alertes
  add constraint alertes_groupe_sanguin_check
  check (groupe_sanguin is null
         or groupe_sanguin in ('A+','A-','B+','B-','AB+','AB-','O+','O-'));

comment on column alertes.groupe_sanguin is
  'Groupe MENTIONNÉ dans l''appel, ou NULL pour un appel ouvert à tous. '
  'N''a jamais servi à filtrer les destinataires : le ciblage se fait par '
  'zone et par éligibilité, le groupe étant déterminé au laboratoire après '
  'le prélèvement.';
