-- ============================================================
--  DJIGUI — clé d'accès biométrique (WebAuthn) pour le verrou
--  d'application (PostgreSQL / Supabase).
--  Nouvelle table isolée : aucune table existante n'est modifiée.
--  À importer une fois, après 01-creation.postgresql.sql (référence
--  donneur.id_donneur).
--
--  Un seul passkey par donneur (clé primaire = id_donneur) : v1 ne
--  gère qu'un appareil à la fois, ré-enregistrer en remplace un
--  ancien. La biométrie reste un canal EN PLUS du mot de passe,
--  jamais une dépendance : cette table peut rester vide sans que rien
--  d'autre ne casse, et le verrou se déverrouille toujours au mot de
--  passe si la biométrie échoue ou n'est pas proposée.
--  cle_publique et credential_id sont du binaire encodé en base64url
--  (texte), jamais du binaire brut : plus simple à transporter et à
--  relire sans dépendance au driver.
-- ============================================================

CREATE TABLE passkey_donneur (
  id_donneur     INT NOT NULL PRIMARY KEY,
  credential_id  TEXT NOT NULL UNIQUE,
  cle_publique   TEXT NOT NULL,
  compteur       BIGINT NOT NULL DEFAULT 0,
  transports     TEXT NULL,
  date_creation  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_passkey_donneur FOREIGN KEY (id_donneur)
    REFERENCES donneur(id_donneur)
);
