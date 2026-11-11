-- Distribution : parcours « accepter → livrer ».
-- Une demande passe de « en_attente » à « acceptee » (le fournisseur accepte,
-- son stock sort) puis à « livree » (le demandeur réceptionne, son stock entre).
alter table demandes drop constraint demandes_statut_check;
alter table demandes add constraint demandes_statut_check
  check (statut in ('en_attente', 'acceptee', 'livree', 'preparee', 'expediee', 'receptionnee', 'annulee'));
