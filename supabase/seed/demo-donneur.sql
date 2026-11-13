-- =====================================================================
-- COMPTE DE DÉMONSTRATION — application des donneurs
--
-- Identifiants (à ne pas confondre avec les comptes agents, qui se
-- connectent par e-mail sur la plateforme) :
--
--     Téléphone : 70 00 00 01
--     Mot de passe : donneur2026
--
-- Ce que le compte contient, pour que CHAQUE écran ait quelque chose à
-- montrer pendant un test ou une démonstration :
--   · fiche complète (O+, zone Paspanga, Ouagadougou) ;
--   · 5 dons « apte » dans l'historique (D11) et 1 ajournement ancien ;
--   · éligible aujourd'hui (carte D8) → peut répondre à une alerte ;
--   · 1 alerte OUVERTE à laquelle il n'a pas encore répondu (D9/D10) ;
--   · 1 alerte CLOSE déjà répondue (historique des alertes) ;
--   · 3 notifications, dont 1 non lue (D14).
--
-- Le numéro 70 00 00 01 est un numéro FICTIF : il n'est attribué à
-- personne. C'est le même couple que celui du simulateur
-- (apps/donneur/src/lib/simulateur.ts), pour que la démonstration en
-- local et la démonstration en ligne se ressemblent.
--
-- SCRIPT REJOUABLE : il remet le compte dans son état de départ et ne
-- touche à AUCUNE autre ligne de la base.
-- =====================================================================

begin;

do $$
declare
  v_donneur   uuid := 'd0000000-0000-4000-8000-000000000001';
  v_alerte_1  uuid := 'a0000000-0000-4000-8000-000000000001';  -- ouverte
  v_alerte_2  uuid := 'a0000000-0000-4000-8000-000000000002';  -- close
  v_admin     uuid;
  v_zone      uuid;
  v_site      uuid;
begin
  select id into v_admin from utilisateurs where email = 'admin@cnts.bf' limit 1;
  select id into v_zone  from zones  where nom = 'Paspanga' and ville = 'Ouagadougou' limit 1;
  select id into v_site  from sites  where code = 'OUA' limit 1;

  if v_zone is null or v_site is null then
    raise exception 'Zones ou sites absents : appliquez d''abord supabase/seed/seed.sql';
  end if;

  -- ---------- Remise à zéro du compte de démonstration ----------
  delete from alerte_reponses  where donneur_id = v_donneur;
  delete from passages         where donneur_id = v_donneur;
  delete from alerte_envois    where donneur_id = v_donneur;
  delete from messages_donneurs where donneur_id = v_donneur;
  delete from alertes          where id in (v_alerte_1, v_alerte_2);
  delete from donneurs         where id = v_donneur;
  -- Un ancien compte aurait pu être créé par l'application avec ce numéro.
  delete from donneurs         where telephone = '+22670000001';

  -- ---------- Le donneur ----------
  insert into donneurs (
    id, numero_donneur, nom, prenom, sexe, date_naissance, telephone,
    telephone_verifie, mot_de_passe, zone_id, groupe_sanguin, canaux,
    prochaine_eligibilite, origine, actif
  ) values (
    v_donneur, 'DDS-DEMO-0001', 'Démo', 'Awa', 'F', date '1994-06-14', '+22670000001',
    true, crypt('donneur2026', gen_salt('bf', 10)), v_zone, 'O+',
    array['whatsapp', 'appel'],
    (current_date - interval '1 month')::date, 'application', true
  );

  -- ---------- Historique des dons (D11) ----------
  insert into passages (donneur_id, site_id, date, resultat, agent_id) values
    (v_donneur, v_site, (current_date - interval '41 months')::date, 'apte',   v_admin),
    (v_donneur, v_site, (current_date - interval '32 months')::date, 'apte',   v_admin),
    (v_donneur, v_site, (current_date - interval '23 months')::date, 'apte',   v_admin),
    (v_donneur, v_site, (current_date - interval '14 months')::date, 'apte',   v_admin),
    (v_donneur, v_site, (current_date - interval '5 months')::date,  'apte',   v_admin),
    (v_donneur, v_site, (current_date - interval '50 months')::date, 'ajourne', v_admin);

  -- ---------- Alerte ouverte (D9/D10) ----------
  insert into alertes (id, site_id, groupe_sanguin, urgence, objectif_donneurs,
                       date_limite, statut, agent_id, message, cree_le)
  values (
    v_alerte_1, v_site, 'O+', 'urgente', 3,
    date_trunc('day', now()) + interval '5 days 18 hours', 'ouverte', v_admin,
    'Le CNTS Ouagadougou manque de sang O+. Si vous êtes disponible cette semaine, '
      || 'répondez à cette alerte : un don peut sauver jusqu''à trois vies.',
    now() - interval '3 hours'
  );
  insert into alerte_zones (alerte_id, zone_id) values (v_alerte_1, v_zone);
  insert into alerte_envois (alerte_id, donneur_id, envoye_le)
  values (v_alerte_1, v_donneur, now() - interval '3 hours');

  -- ---------- Alerte close, déjà répondue ----------
  insert into alertes (id, site_id, groupe_sanguin, urgence, objectif_donneurs,
                       date_limite, statut, agent_id, message, cree_le, cloture_le)
  values (
    v_alerte_2, v_site, null, 'normale', 5,
    date_trunc('day', now()) - interval '35 days', 'cloturee', v_admin,
    'Collecte au CNTS Ouagadougou : merci de votre mobilisation.',
    now() - interval '40 days', now() - interval '34 days'
  );
  insert into alerte_zones (alerte_id, zone_id) values (v_alerte_2, v_zone);
  insert into alerte_envois (alerte_id, donneur_id, envoye_le)
  values (v_alerte_2, v_donneur, now() - interval '40 days');
  insert into alerte_reponses (alerte_id, donneur_id, reponse, moment_passage,
                               besoin_transport, moyen_deplacement, repondu_le)
  values (v_alerte_2, v_donneur, 'je_viens', '10h-12h', false, 'deux_roues',
          now() - interval '38 days');

  -- ---------- Notifications (D14) ----------
  insert into messages_donneurs (donneur_id, type, titre, message, lue, lien, cree_le) values
    (v_donneur, 'alerte', 'Le CNTS a besoin de vous',
     'Une collecte O+ est ouverte au CNTS Ouagadougou. Répondez avant la date limite.',
     false, '/alertes/' || v_alerte_1, now() - interval '3 hours'),
    (v_donneur, 'eligibilite', 'Vous pouvez donner à nouveau',
     'Votre dernier don date de cinq mois : vous êtes de nouveau éligible.',
     true, '/carte', now() - interval '12 days'),
    (v_donneur, 'compte', 'Bienvenue sur Djigui',
     'Votre numéro est vérifié. Vous serez prévenu quand votre groupe sera recherché près de chez vous.',
     true, '/carte', now() - interval '40 days');
end $$;

-- ---------- Contrôle : le compte doit être joignable ----------
select d.numero_donneur, d.telephone, d.telephone_verifie, d.groupe_sanguin,
       z.nom as zone, z.ville,
       (select count(*)::int from passages p where p.donneur_id = d.id) as passages,
       (select count(*)::int from alerte_envois e where e.donneur_id = d.id) as alertes_recues,
       (select count(*)::int from messages_donneurs m where m.donneur_id = d.id) as notifications
  from donneurs d
  left join zones z on z.id = d.zone_id
 where d.id = 'd0000000-0000-4000-8000-000000000001';

commit;
