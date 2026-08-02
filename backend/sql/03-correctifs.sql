-- ============================================================
--  DJIGUI — correctifs après constat en cours de développement.
--  À importer une fois, après 01-creation.sql et 02-parametres.sql.
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
UPDATE telephone_donneur t
  JOIN donneur d ON d.id_donneur = t.id_donneur
   SET t.statut_joignabilite = 'confirme',
       t.date_dernier_controle = CURDATE()
 WHERE t.rang = 1 AND t.statut_joignabilite = 'non_verifie';
