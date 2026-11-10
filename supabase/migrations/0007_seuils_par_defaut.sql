-- =====================================================================
-- 0007 — Seuils de stock par défaut, et besoins calculés
--
-- Constat : la table `seuils_stock` est VIDE. Or le niveau affiché
-- (« suffisant / bas / critique ») n'est calculé que si une ligne existe
-- pour le site, le type de produit ET le groupe — soit 24 lignes à
-- saisir par site avant que la colonne « Niveau » veuille dire quelque
-- chose. Résultat : tout s'affichait « suffisant », même à une unité, et
-- les appels au don ne pouvaient jamais être déclenchés par le stock.
--
-- Correction non destructive : des valeurs PAR DÉFAUT dans `regles`,
-- utilisées quand aucun seuil propre au site n'est défini. Un centre
-- fonctionne dès le premier jour ; un administrateur peut toujours
-- affiner site par site, et sa valeur l'emporte.
-- =====================================================================

insert into regles (cle, valeur, description) values
  ('seuil_bas_defaut', '10',
   'Unités en dessous desquelles un groupe est jugé « bas », faute de seuil propre au site.'),
  ('seuil_critique_defaut', '3',
   'Unités en dessous desquelles un groupe est jugé « critique », faute de seuil propre au site.'),
  -- Un appel au don vise des DONNEURS, pas des poches : tous ne viendront
  -- pas, et une venue ne donne qu'une poche. Ce coefficient traduit le
  -- manque en nombre de personnes à mobiliser.
  ('alerte_donneurs_par_poche', '3',
   'Donneurs à appeler pour obtenir une poche (tous les appelés ne viennent pas).')
on conflict (cle) do nothing;
