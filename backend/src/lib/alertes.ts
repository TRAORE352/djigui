import type {
  Alerte, Creneau, GroupeSanguin, MotifRefus, MoyenDeplacement, ReponseAlerte, StatutAlerte,
} from "@dds/contrat-api";
import { instantISO } from "./format.js";

/** Ligne brute lue en base pour une alerte (noms de colonnes SQL). */
export interface LigneAlerte {
  id: string;
  groupe_sanguin: string | null;
  message: string;
  statut: string;
  cree_le: Date;
  date_limite: Date;
  site_id: string;
  site_nom: string;
  site_adresse: string;
  site_telephone: string;
  site_horaires: string;
  site_ville: string;
  reponse: string | null;
  motif_refus: string | null;
  moment_passage: string | null;
  moyen_deplacement: string | null;
}

const CRENEAUX_VALIDES = ["08h-10h", "10h-12h", "12h-14h", "14h-16h"] as const;

/**
 * Une alerte n'est lisible que si elle a été envoyée au donneur
 * (table `alerte_envois`). `$1` = identifiant du donneur connecté.
 */
export const SELECT_ALERTE = `
  select a.id, a.groupe_sanguin, a.message, a.statut, a.cree_le, a.date_limite,
         s.id as site_id, s.nom as site_nom, s.adresse as site_adresse,
         s.telephone as site_telephone, s.horaires as site_horaires,
         coalesce(z.ville, '') as site_ville,
         r.reponse, r.motif_refus, r.moment_passage, r.moyen_deplacement
  from alertes a
  join alerte_envois e on e.alerte_id = a.id
  join sites s on s.id = a.site_id
  left join zones z on z.id = s.zone_id
  left join alerte_reponses r on r.alerte_id = a.id and r.donneur_id = $1
  where e.donneur_id = $1
`;

/** Transforme une ligne SQL en Alerte au format du contrat. */
export function formaterAlerte(l: LigneAlerte): Alerte {
  const adresse = l.site_ville ? `${l.site_adresse}, ${l.site_ville}` : l.site_adresse;
  const creneau = (l.moment_passage && (CRENEAUX_VALIDES as readonly string[]).includes(l.moment_passage))
    ? l.moment_passage as Creneau
    : null;
  const moyen = l.moyen_deplacement as MoyenDeplacement | null;
  return {
    id: l.id,
    groupeSanguin: l.groupe_sanguin as GroupeSanguin | null,
    centre: {
      id: l.site_id,
      nom: l.site_nom,
      adresse,
      telephone: l.site_telephone,
      horaires: l.site_horaires,
    },
    message: l.message,
    statut: l.statut as StatutAlerte,
    creeLe: instantISO(l.cree_le),
    dateLimite: instantISO(l.date_limite),
    maReponse: l.reponse as ReponseAlerte | null,
    motifRefus: l.motif_refus as MotifRefus | null,
    venue: creneau || moyen ? { creneau, moyen } : null,
  };
}
