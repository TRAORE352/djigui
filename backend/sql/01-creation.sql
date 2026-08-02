-- ============================================================
--  DJIGUI — Création de la base de données
--  Source : cahier des charges v1.1, annexe B, corrigée après
--  analyse des trois maquettes (donneur, gestion, administration).
--  Moteur : MariaDB sous XAMPP. InnoDB, utf8mb4.
--  SQL écrit à la main, sans outil de génération (règles C1, K1).
--
--  CORRECTIONS APPORTÉES À L'ANNEXE B, chacune justifiée :
--   1. utilisateur.nom et .prenom  : E28 et E15 affichent le nom
--      des agents ; l'annexe B ne les stockait nulle part.
--   2. utilisateur.fonction        : saisie en E27, affichée en E15.
--   3. utilisateur.provisoire_*    : E27 bis impose un mot de passe
--      provisoire visible une seule fois et valable 48 heures.
--   4. journal_activite.resultat   : E31 affiche une colonne
--      Réussie / Refusée / Échouée.
--   5. donneur.groupe_sanguin NULL : E4 offre « Je ne sais pas ».
--   6. reponse_alerte.motif_refus  : E19 compte les refus par motif.
--   7. poche_historique.poste      : E23 et E27 affichent le poste.
--   8. alerte.heure_limite         : E18 sépare date et heure.
-- ============================================================

CREATE DATABASE IF NOT EXISTS djigui
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE djigui;

/* ---------- T4 : structures ---------- */
CREATE TABLE structure_sang (
  id_structure   INT AUTO_INCREMENT PRIMARY KEY,
  nom            VARCHAR(150) NOT NULL,
  type           ENUM('crts','depot','banque_hopital') NOT NULL,
  ville          VARCHAR(100) NOT NULL,
  adresse        VARCHAR(200),
  telephone      VARCHAR(20),
  horaires       VARCHAR(120),
  date_creation  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

/* ---------- T3 : zones ---------- */
CREATE TABLE zone (
  id_zone       INT AUTO_INCREMENT PRIMARY KEY,
  nom           VARCHAR(100) NOT NULL,
  ville         VARCHAR(100) NOT NULL,
  date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_zone (nom, ville)
) ENGINE=InnoDB;

/* ---------- T1 : utilisateurs ---------- */
CREATE TABLE utilisateur (
  id_utilisateur            INT AUTO_INCREMENT PRIMARY KEY,
  identifiant               VARCHAR(120) NOT NULL UNIQUE,
  mot_de_passe              VARCHAR(255) NOT NULL,
  role                      ENUM('donneur','gestionnaire','admin') NOT NULL,
  nom                       VARCHAR(80)  NULL,   -- correction 1
  prenom                    VARCHAR(80)  NULL,   -- correction 1
  fonction                  VARCHAR(120) NULL,   -- correction 2
  id_structure              INT NULL,
  statut                    ENUM('actif','suspendu','desactive') NOT NULL DEFAULT 'actif',
  doit_changer_mot_de_passe BOOLEAN  NOT NULL DEFAULT 0,
  provisoire_expire_le      DATETIME NULL,       -- correction 3
  provisoire_deja_affiche   BOOLEAN  NOT NULL DEFAULT 0,
  nb_echecs_connexion       INT      NOT NULL DEFAULT 0,
  verrouille_jusqu_a        DATETIME NULL,
  derniere_connexion        DATETIME NULL,
  date_creation             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_utilisateur_structure FOREIGN KEY (id_structure)
    REFERENCES structure_sang(id_structure)
) ENGINE=InnoDB;

/* ---------- T2 : donneurs ---------- */
CREATE TABLE donneur (
  id_donneur                 INT AUTO_INCREMENT PRIMARY KEY,
  id_utilisateur             INT NOT NULL UNIQUE,
  nom                        VARCHAR(80) NOT NULL,
  prenom                     VARCHAR(80) NOT NULL,
  sexe                       ENUM('M','F') NOT NULL,
  date_naissance             DATE NOT NULL,
  groupe_sanguin             ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NULL, -- correction 5
  poids_declare              DECIMAL(5,2) NOT NULL,
  id_zone                    INT NOT NULL,
  repere_position            VARCHAR(200) NULL,
  question_securite          VARCHAR(200) NOT NULL,
  reponse_securite           VARCHAR(255) NOT NULL,
  accepte_sms                BOOLEAN NOT NULL DEFAULT 1,
  accepte_messagerie         BOOLEAN NOT NULL DEFAULT 0,
  date_dernier_don           DATE NULL,
  date_prochaine_eligibilite DATE NULL,
  statut                     ENUM('actif','suspendu','desactive') NOT NULL DEFAULT 'actif',
  date_consentement          DATETIME NOT NULL,
  date_creation              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_donneur_utilisateur FOREIGN KEY (id_utilisateur)
    REFERENCES utilisateur(id_utilisateur),
  CONSTRAINT fk_donneur_zone FOREIGN KEY (id_zone)
    REFERENCES zone(id_zone),
  INDEX idx_ciblage (statut, groupe_sanguin, id_zone)
) ENGINE=InnoDB;

/* ---------- T15 : téléphones du donneur ---------- */
CREATE TABLE telephone_donneur (
  id_telephone          INT AUTO_INCREMENT PRIMARY KEY,
  id_donneur            INT NOT NULL,
  numero                VARCHAR(20) NOT NULL UNIQUE,
  rang                  TINYINT NOT NULL,
  statut_joignabilite   ENUM('non_verifie','confirme','injoignable')
                          NOT NULL DEFAULT 'non_verifie',
  date_dernier_controle DATE NULL,
  UNIQUE KEY uk_rang (id_donneur, rang),
  CONSTRAINT chk_rang CHECK (rang BETWEEN 1 AND 4),
  CONSTRAINT fk_tel_donneur FOREIGN KEY (id_donneur)
    REFERENCES donneur(id_donneur)
) ENGINE=InnoDB;

/* ---------- T16 : tentatives de récupération ---------- */
CREATE TABLE tentative_recuperation (
  id_tentative   INT AUTO_INCREMENT PRIMARY KEY,
  identifiant    VARCHAR(120) NOT NULL,
  date_tentative DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  succes         BOOLEAN NOT NULL DEFAULT 0,
  INDEX idx_tentative (identifiant, date_tentative)
) ENGINE=InnoDB;

/* ---------- T5 : seuils par structure et par groupe ---------- */
CREATE TABLE seuil_stock (
  id_seuil       INT AUTO_INCREMENT PRIMARY KEY,
  id_structure   INT NOT NULL,
  groupe_sanguin ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL,
  seuil_bas      INT NOT NULL DEFAULT 10,
  seuil_critique INT NOT NULL DEFAULT 5,
  modifie_par    INT NULL,
  date_modification DATETIME NULL,
  UNIQUE KEY uk_seuil (id_structure, groupe_sanguin),
  CONSTRAINT chk_seuils CHECK (seuil_critique <= seuil_bas),
  CONSTRAINT fk_seuil_structure FOREIGN KEY (id_structure)
    REFERENCES structure_sang(id_structure),
  CONSTRAINT fk_seuil_agent FOREIGN KEY (modifie_par)
    REFERENCES utilisateur(id_utilisateur)
) ENGINE=InnoDB;

/* ---------- T9 : appels au don ---------- */
CREATE TABLE alerte (
  id_alerte        INT AUTO_INCREMENT PRIMARY KEY,
  id_structure     INT NOT NULL,
  cree_par         INT NOT NULL,
  groupe_cible     VARCHAR(60) NOT NULL,
  elargi_compatibles BOOLEAN NOT NULL DEFAULT 0,
  message          TEXT NOT NULL,
  canaux           VARCHAR(60) NOT NULL DEFAULT 'application',
  date_creation    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_envoi       DATETIME NULL,
  date_limite      DATE NULL,
  heure_limite     TIME NULL,                    -- correction 8
  statut           ENUM('brouillon','envoyee','cloturee') NOT NULL DEFAULT 'brouillon',
  nb_destinataires INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_alerte_structure FOREIGN KEY (id_structure)
    REFERENCES structure_sang(id_structure),
  CONSTRAINT fk_alerte_auteur FOREIGN KEY (cree_par)
    REFERENCES utilisateur(id_utilisateur)
) ENGINE=InnoDB;

/* Zones visées par un appel. L'annexe B n'en prévoyait qu'une seule ;
   E18 en fait cocher plusieurs. */
CREATE TABLE alerte_zone (
  id_alerte INT NOT NULL,
  id_zone   INT NOT NULL,
  PRIMARY KEY (id_alerte, id_zone),
  CONSTRAINT fk_az_alerte FOREIGN KEY (id_alerte) REFERENCES alerte(id_alerte),
  CONSTRAINT fk_az_zone   FOREIGN KEY (id_zone)   REFERENCES zone(id_zone)
) ENGINE=InnoDB;

/* ---------- T10 : destinataires figés à l'envoi ---------- */
CREATE TABLE alerte_destinataire (
  id_destinataire INT AUTO_INCREMENT PRIMARY KEY,
  id_alerte       INT NOT NULL,
  id_donneur      INT NOT NULL,
  canal_envoi     ENUM('application','sms','appel') NOT NULL,
  date_envoi      DATETIME NULL,
  statut_envoi    ENUM('en_attente','envoye','echec') NOT NULL DEFAULT 'en_attente',
  UNIQUE KEY uk_dest (id_alerte, id_donneur, canal_envoi),
  CONSTRAINT fk_dest_alerte  FOREIGN KEY (id_alerte)  REFERENCES alerte(id_alerte),
  CONSTRAINT fk_dest_donneur FOREIGN KEY (id_donneur) REFERENCES donneur(id_donneur)
) ENGINE=InnoDB;

/* ---------- T11 : réponses des donneurs ---------- */
CREATE TABLE reponse_alerte (
  id_reponse   INT AUTO_INCREMENT PRIMARY KEY,
  id_alerte    INT NOT NULL,
  id_donneur   INT NOT NULL,
  reponse      ENUM('je_viens','je_ne_peux_pas') NOT NULL,
  motif_refus  ENUM('don_trop_recent','absent_de_la_ville',
                    'raison_de_sante','autre') NULL,  -- correction 6
  date_reponse DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  presente     BOOLEAN NULL,
  UNIQUE KEY uk_reponse (id_alerte, id_donneur),
  CONSTRAINT fk_rep_alerte  FOREIGN KEY (id_alerte)  REFERENCES alerte(id_alerte),
  CONSTRAINT fk_rep_donneur FOREIGN KEY (id_donneur) REFERENCES donneur(id_donneur)
) ENGINE=InnoDB;

/* ---------- T12 : fiche de disponibilité ---------- */
CREATE TABLE fiche_disponibilite (
  id_fiche              INT AUTO_INCREMENT PRIMARY KEY,
  id_reponse            INT NOT NULL UNIQUE,
  repere_position       VARCHAR(200) NOT NULL,
  moyen_deplacement     ENUM('a_pied','deux_roues','voiture',
                             'transport_commun','aucun') NOT NULL,
  besoin_aide_transport BOOLEAN NOT NULL DEFAULT 0,
  aide_satisfaite       BOOLEAN NULL,
  creneau_prefere       VARCHAR(60),
  commentaire           VARCHAR(255),
  CONSTRAINT fk_fiche_reponse FOREIGN KEY (id_reponse)
    REFERENCES reponse_alerte(id_reponse)
) ENGINE=InnoDB;

/* ---------- T6 : dons ---------- */
CREATE TABLE don (
  id_don         INT AUTO_INCREMENT PRIMARY KEY,
  id_donneur     INT NOT NULL,
  id_structure   INT NOT NULL,
  id_alerte      INT NULL,
  date_don       DATE NOT NULL,
  heure_don      TIME NULL,
  enregistre_par INT NOT NULL,
  poste          VARCHAR(40) NULL,
  observation    VARCHAR(255),
  CONSTRAINT fk_don_donneur   FOREIGN KEY (id_donneur)     REFERENCES donneur(id_donneur),
  CONSTRAINT fk_don_structure FOREIGN KEY (id_structure)   REFERENCES structure_sang(id_structure),
  CONSTRAINT fk_don_alerte    FOREIGN KEY (id_alerte)      REFERENCES alerte(id_alerte),
  CONSTRAINT fk_don_agent     FOREIGN KEY (enregistre_par) REFERENCES utilisateur(id_utilisateur),
  INDEX idx_don_donneur (id_donneur, date_don)
) ENGINE=InnoDB;

/* ---------- T7 : poches ---------- */
CREATE TABLE poche (
  id_poche         INT AUTO_INCREMENT PRIMARY KEY,
  code_poche       VARCHAR(30) NOT NULL UNIQUE,
  id_don           INT NOT NULL UNIQUE,
  id_structure     INT NOT NULL,
  groupe_sanguin   ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL,
  date_prelevement DATE NOT NULL,
  date_peremption  DATE NOT NULL,
  statut           ENUM('collectee','qualifiee','disponible','reservee',
                        'transfusee','detruite','perimee') NOT NULL DEFAULT 'collectee',
  destination      VARCHAR(120),
  motif_destruction VARCHAR(120),
  INDEX idx_stock (id_structure, groupe_sanguin, statut),
  CONSTRAINT fk_poche_don       FOREIGN KEY (id_don)       REFERENCES don(id_don),
  CONSTRAINT fk_poche_structure FOREIGN KEY (id_structure) REFERENCES structure_sang(id_structure)
) ENGINE=InnoDB;

/* ---------- T8 : historique des poches ---------- */
CREATE TABLE poche_historique (
  id_historique   INT AUTO_INCREMENT PRIMARY KEY,
  id_poche        INT NOT NULL,
  ancien_statut   VARCHAR(20),
  nouveau_statut  VARCHAR(20) NOT NULL,
  precision_etape VARCHAR(150),
  modifie_par     INT NOT NULL,
  poste           VARCHAR(40) NULL,              -- correction 7
  date_changement DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hist_poche FOREIGN KEY (id_poche)    REFERENCES poche(id_poche),
  CONSTRAINT fk_hist_agent FOREIGN KEY (modifie_par) REFERENCES utilisateur(id_utilisateur),
  INDEX idx_hist (id_poche, date_changement)
) ENGINE=InnoDB;

/* ---------- T13 : paramètres réglables ---------- */
CREATE TABLE parametre (
  cle          VARCHAR(60) PRIMARY KEY,
  valeur       VARCHAR(120) NOT NULL,
  libelle      VARCHAR(120) NOT NULL,
  consequence  VARCHAR(200) NOT NULL,
  unite        VARCHAR(20)  NOT NULL,
  categorie    ENUM('medical','conservation','securite') NOT NULL,
  modifie_par  INT NULL,
  date_modification DATETIME NULL,
  CONSTRAINT fk_param_agent FOREIGN KEY (modifie_par)
    REFERENCES utilisateur(id_utilisateur)
) ENGINE=InnoDB;

/* ---------- T14 : journal d'activité ---------- */
CREATE TABLE journal_activite (
  id_journal     INT AUTO_INCREMENT PRIMARY KEY,
  id_utilisateur INT NULL,
  action         VARCHAR(120) NOT NULL,
  cible          VARCHAR(200),
  resultat       ENUM('reussie','refusee','echouee') NOT NULL DEFAULT 'reussie', -- correction 4
  date_action    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_journal (date_action),
  INDEX idx_journal_auteur (id_utilisateur, date_action),
  CONSTRAINT fk_journal_utilisateur FOREIGN KEY (id_utilisateur)
    REFERENCES utilisateur(id_utilisateur)
) ENGINE=InnoDB;
