-- ============================================================
--  DJIGUI — seed des 40 quartiers de Ouagadougou (table zone, T3).
--  Contrainte C3 du cahier des charges : la base démarre vide, tout se
--  crée par les écrans en usage normal. Ce fichier est l'exception
--  volontaire de la phase de déploiement (le porteur du projet en a
--  décidé ainsi) — jamais chargé automatiquement, seulement à la main
--  ici, une fois, avant la mise en service.
--
--  ON CONFLICT (nom, ville) DO NOTHING : la contrainte réelle de la
--  table (uk_zone) porte sur (nom, ville) ensemble, pas sur nom seul.
--  Toutes les lignes ci-dessous partagent ville = 'Ouagadougou', donc
--  l'effet revient à un contrôle par nom en pratique, mais c'est bien
--  la paire qui est ciblée pour correspondre exactement à la
--  contrainte — un seed ré-exécutable sans erreur ni doublon, utile
--  pour le reset final avant la mise en service.
-- ============================================================

INSERT INTO zone (nom, ville) VALUES
  ('Gounghin', 'Ouagadougou'),
  ('Dapoya', 'Ouagadougou'),
  ('Larlé', 'Ouagadougou'),
  ('Paspanga', 'Ouagadougou'),
  ('Koulouba', 'Ouagadougou'),
  ('Kamsonghin', 'Ouagadougou'),
  ('Samandin', 'Ouagadougou'),
  ('Bilbalogo', 'Ouagadougou'),
  ('Zangouettin', 'Ouagadougou'),
  ('Ouidi', 'Ouagadougou'),
  ('Hamdalaye', 'Ouagadougou'),
  ('Kologh-Naaba', 'Ouagadougou'),
  ('Sankariaré', 'Ouagadougou'),
  ('Nonsin', 'Ouagadougou'),
  ('Zogona', 'Ouagadougou'),
  ('Zone du Bois', 'Ouagadougou'),
  ('Wemtenga', 'Ouagadougou'),
  ('Dassasgho', 'Ouagadougou'),
  ('1200 Logements', 'Ouagadougou'),
  ('Karpala', 'Ouagadougou'),
  ('Ouaga 2000', 'Ouagadougou'),
  ('Bendogo', 'Ouagadougou'),
  ('Balkuy', 'Ouagadougou'),
  ('Nagrin', 'Ouagadougou'),
  ('Cissin', 'Ouagadougou'),
  ('Pissy', 'Ouagadougou'),
  ('Rimkiéta', 'Ouagadougou'),
  ('Kilwin', 'Ouagadougou'),
  ('Sandogo', 'Ouagadougou'),
  ('Zagtouli', 'Ouagadougou'),
  ('Tanghin', 'Ouagadougou'),
  ('Somgandé', 'Ouagadougou'),
  ('Kossodo', 'Ouagadougou'),
  ('Wayalghin', 'Ouagadougou'),
  ('Nioko', 'Ouagadougou'),
  ('Polesgo', 'Ouagadougou'),
  ('Tampouy', 'Ouagadougou'),
  ('Kamboinsé', 'Ouagadougou'),
  ('Yagma', 'Ouagadougou'),
  ('Bassinko', 'Ouagadougou')
ON CONFLICT (nom, ville) DO NOTHING;
