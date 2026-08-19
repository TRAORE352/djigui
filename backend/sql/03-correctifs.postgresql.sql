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
