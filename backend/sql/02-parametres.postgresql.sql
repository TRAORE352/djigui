-- ============================================================
--  DJIGUI — Valeurs initiales des paramètres réglables (T13).
--  Ces valeurs sont modifiables par l'administrateur en E30,
--  sans reprise du code.
--
--  ARBITRAGES retenus après analyse des maquettes :
--   - Délai entre deux dons : règle du cahier des charges,
--     3 mois pour un homme et 4 mois pour une femme, et non les
--     120 jours uniformes de la maquette. À faire confirmer par
--     un responsable du centre de transfusion avant mise en service.
--   - Mot de passe professionnel : 10 caractères (E14 disait 8,
--     le cahier des charges et E32 disent 10 : c'est 10).
--   - Alerte avant péremption : 7 jours, valeur de la maquette E30.
--   - Session inactive : 30 minutes (E30 et règle RG39).
--
--  CONVERSION (identique à 02-parametres.sql sinon) : la ligne
--  « USE djigui; » de l'original a été retirée. PostgreSQL n'a pas
--  d'instruction USE ; un projet Supabase fournit déjà sa base, les
--  INSERT s'exécutent directement dedans, dans le schéma public. Le
--  reste du fichier est du SQL déjà portable (INSERT paramétré,
--  aucun backtick, aucun INSERT IGNORE) — aucune valeur ni logique
--  n'a changé.
-- ============================================================

INSERT INTO parametre (cle, valeur, libelle, consequence, unite, categorie) VALUES
('age_min', '18', 'Âge minimum du donneur',
 'Un candidat plus jeune ne peut pas créer de compte.', 'ans', 'medical'),
('age_max', '60', 'Âge maximum du donneur',
 'Au-delà, la plateforme ne propose plus le donneur aux appels.', 'ans', 'medical'),
('poids_min', '50', 'Poids minimum du donneur',
 'En dessous, le centre décide sur place.', 'kg', 'medical'),
('delai_homme_mois', '3', 'Délai entre deux dons, homme',
 'Le donneur ne reçoit aucun appel avant ce délai.', 'mois', 'medical'),
('delai_femme_mois', '4', 'Délai entre deux dons, femme',
 'La donneuse ne reçoit aucun appel avant ce délai.', 'mois', 'medical'),
('max_dons_homme_an', '4', 'Nombre maximal de dons par an, homme',
 'Au-delà, le donneur n''est plus proposé jusqu''à la date anniversaire.', 'dons', 'medical'),
('max_dons_femme_an', '3', 'Nombre maximal de dons par an, femme',
 'Au-delà, la donneuse n''est plus proposée jusqu''à la date anniversaire.', 'dons', 'medical'),
('duree_conservation_jours', '35', 'Durée de conservation d''une poche',
 'La date de péremption est calculée à partir du prélèvement.', 'jours', 'conservation'),
('alerte_peremption_jours', '7', 'Alerte avant péremption',
 'Déclenche le signalement dans le tableau de bord de gestion.', 'jours', 'conservation'),
('nb_telephones_max', '4', 'Nombre maximal de numéros par donneur',
 'Le donneur ne peut pas enregistrer davantage de numéros.', 'numéros', 'securite'),
('recup_tentatives_heure', '3', 'Tentatives de récupération par heure',
 'Au-delà, le donneur doit se présenter au centre.', 'tentatives', 'securite'),
('mdp_longueur_min', '10', 'Longueur du mot de passe professionnel',
 'Un mot de passe plus court est refusé à l''enregistrement.', 'caractères', 'securite'),
('mdp_donneur_longueur_min', '8', 'Longueur du mot de passe du donneur',
 'Un mot de passe plus court est refusé à l''inscription.', 'caractères', 'securite'),
('echecs_avant_verrou', '5', 'Tentatives avant blocage',
 'Le compte est bloqué, puis rouvert seul.', 'tentatives', 'securite'),
('duree_verrou_minutes', '15', 'Durée du blocage',
 'Passé ce délai, le compte se rouvre sans intervention.', 'minutes', 'securite'),
('session_inactivite_minutes', '30', 'Fermeture d''une session inactive',
 'Au-delà, l''agent doit se reconnecter. Le poste partagé est protégé.', 'minutes', 'securite'),
('validite_provisoire_heures', '48', 'Validité du mot de passe provisoire',
 'Passé ce délai, l''administrateur doit en délivrer un autre.', 'heures', 'securite');
