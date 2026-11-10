-- Délivrance : nom de l'agent de santé qui a reçu la poche (traçabilité
-- et reçu remis au service de soins).
alter table delivrances add column nom_agent text not null default '';
