-- ============================================================
--  DJIGUI — correctifs après constat en cours de développement
--  (PostgreSQL / Supabase).
--  Conversion de backend/sql/03-correctifs.sql (MariaDB/MySQL, gardé
--  intact pour référence). À importer une fois, après
--  01-creation.postgresql.sql et 02-parametres.sql (celui-ci ne change
--  pas : SQL déjà portable, clé primaire cle VARCHAR).
-- ============================================================

-- Correctif 1 — numéro principal confirmé dès l'inscription.
--
-- Avant ce correctif, tout numéro (principal comme secondaire) était
-- inséré en 'non_verifie'. Or le numéro principal a été saisi DEUX FOIS
-- à l'inscription, sans collage possible (règle RG25) : c'est déjà une
-- vérification. Le donneur vient de plus de s'en servir pour se
-- connecter. Le traiter comme douteux n'avait aucun sens, et avait un
-- effet grave : le ciblage d'un appel au don EXCLUAIT ces donneurs
-- (voir le correctif du ciblage dans requetes/alertes.js), refusant du
-- sang disponible pour une raison purement administrative.
--
-- auth.controleur.js insère désormais le numéro principal directement
-- en 'confirme'. Ce correctif aligne les comptes créés avant le
-- changement. Il ne touche jamais un numéro secondaire (rang > 1) :
-- ceux-là n'ont subi aucune double saisie, ils restent à vérifier par
-- un agent, normalement.
--
-- CONVERSION : MySQL écrit un UPDATE ... JOIN ... SET ... WHERE
-- (jointure directement dans l'UPDATE). PostgreSQL n'a pas cette
-- syntaxe : la jointure passe par une clause FROM, et les colonnes du
-- SET restent SANS le préfixe de la table cible (t.colonne = ... est
-- refusé par PostgreSQL dans un SET, seul colonne = ... est valide).
-- CURDATE() → CURRENT_DATE.
UPDATE telephone_donneur t
   SET statut_joignabilite = 'confirme',
       date_dernier_controle = CURRENT_DATE
  FROM donneur d
 WHERE d.id_donneur = t.id_donneur
   AND t.rang = 1
   AND t.statut_joignabilite = 'non_verifie';

-- Correctif 2 — durée du jeton donneur (verrou d'application).
--
-- Avant ce correctif, le jeton d'un donneur expirait après douze heures
-- fixes, sans jamais se renouveler : passé ce délai, quoi qu'il fasse,
-- le donneur devait tout ressaisir (numéro et mot de passe). Avec le
-- verrou d'application (mot de passe seul, à chaque retour), la
-- session peut désormais durer aussi longtemps que le donneur revient
-- de temps en temps : elle se prolonge à chaque appel, comme la
-- session professionnelle (RG39). Ce correctif ajoute le paramètre
-- pour une base créée avant son introduction dans 02-parametres.postgresql.sql.
-- Sans danger à réimporter : ON CONFLICT ne touche rien si la ligne existe déjà.
INSERT INTO parametre (cle, valeur, libelle, consequence, unite, categorie) VALUES
('session_donneur_jours', '400', 'Durée du jeton d''un donneur',
 'Renouvelée à chaque usage : un donneur actif ne se reconnecte jamais. Le verrou d''application protège l''appareil entre deux usages.', 'jours', 'securite')
ON CONFLICT (cle) DO NOTHING;

-- Correctif 3 — appel au don sans groupe précis (ciblage par zone ou à
-- tout le monde).
--
-- Avant ce correctif, groupe_cible était obligatoire : un appel visait
-- toujours un groupe précis, et la clause SQL « groupe_sanguin IN (...) »
-- qui en découle exclut structurellement tout donneur dont le groupe
-- n'est pas renseigné (IN ne retient jamais NULL, quel que soit son
-- contenu). Un donneur qui n'a pas encore précisé son groupe ne pouvait
-- donc JAMAIS recevoir un appel — y compris un appel voulu pour « tout
-- le monde ». mode_ciblage rend explicite l'intention de l'agent
-- (groupe précis, zone(s) sans distinction de groupe, ou tout le monde) ;
-- groupe_cible devient NULL pour les deux derniers cas, et le moteur de
-- ciblage (requetes/alertes.js) n'applique alors aucun filtre de groupe,
-- ce qui inclut naturellement les groupes NULL.
ALTER TABLE alerte ALTER COLUMN groupe_cible DROP NOT NULL;
ALTER TABLE alerte ADD COLUMN IF NOT EXISTS mode_ciblage VARCHAR(20) NOT NULL DEFAULT 'groupe'
  CONSTRAINT chk_alerte_mode_ciblage CHECK (mode_ciblage IN ('groupe', 'zone', 'tous'));

-- Correctif 4 — poids non obligatoire à l'inscription, comme le groupe
-- sanguin l'est déjà. Un donneur qui ne connaît pas son poids ne sera
-- simplement pas proposé comme éligible tant qu'il ne l'a pas complété
-- (au centre ou depuis Mon compte) : la règle RG5 sur le poids minimum
-- reste entière, elle s'applique juste plus tard.
ALTER TABLE donneur ALTER COLUMN poids_declare DROP NOT NULL;
