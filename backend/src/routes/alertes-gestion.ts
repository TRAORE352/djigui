import { Router } from "express";
import { z } from "zod";
import type { LancerAlerteRequete, SuiviAlerte } from "@dds/contrat-api";
import { AppError } from "../lib/erreurs.js";
import { requete, transaction } from "../lib/db.js";
import { valider } from "../lib/validation.js";
import { inscrireEvenement } from "../lib/evenements.js";
import { lireRegle } from "../lib/regles.js";
import { instantISO } from "../lib/format.js";
import { exigerRole } from "../middlewares/roles.js";

const GESTION = [exigerRole("agent_stock", "admin")];

/**
 * P7 — Alertes aux donneurs (côté gestionnaire de stock) :
 *   POST /alertes/estimation  combien de donneurs seront prévenus
 *   POST /alertes             lancer une alerte (envoi aux donneurs éligibles)
 *   GET  /alertes/:id         suivi des réponses
 *   POST /alertes/:id/cloture fermer une alerte
 */
export const routeAlertesGestion = Router();

const GROUPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const URGENCES = ["normale", "urgente", "critique"] as const;

// Donneurs éligibles : actif, numéro vérifié, dans une zone ciblée, éligible,
// pas en pause, pas d'alerte reçue récemment. Le groupe n'est jamais un critère.
async function donneursEligibles(zoneIds: string[]): Promise<string[]> {
  const delaiJours = await lireRegle("delai_min_alerte_jours", 7);
  const { rows } = await requete<{ id: string }>(
    `select d.id from donneurs d
     where d.actif
       and d.telephone_verifie
       and d.zone_id = any($1::uuid[])
       and (d.prochaine_eligibilite is null or d.prochaine_eligibilite <= current_date)
       and (d.pause_jusquau is null or d.pause_jusquau < current_date)
       and not exists (
         select 1 from alerte_envois e
         where e.donneur_id = d.id and e.envoye_le > now() - ($2 || ' days')::interval
       )`,
    [zoneIds, String(delaiJours)],
  );
  return rows.map((r) => r.id);
}

const schemaEstimation = z.object({ zoneIds: z.array(z.string().uuid()).min(1, "Choisissez au moins une zone.") });

routeAlertesGestion.post("/estimation", ...GESTION, async (req, res) => {
  const d = valider(schemaEstimation, req.body);
  const ids = await donneursEligibles(d.zoneIds);
  res.json({ donnees: { donneursCibles: ids.length } });
});

const schemaAlerte = z.object({
  // Le groupe est FACULTATIF : il sert à rédiger le message (« nous manquons
  // de O- »), jamais à choisir qui est appelé. Le ciblage se fait par zone et
  // par éligibilité — la plupart des donneurs ignorent leur groupe, et c'est
  // le laboratoire qui le détermine après le prélèvement.
  groupeSanguin: z.preprocess((v) => v ?? null, z.enum(GROUPES).nullable()),
  urgence: z.enum(URGENCES),
  objectifDonneurs: z.number().int().positive(),
  dateLimite: z.string().min(1, "Date limite requise."),
  message: z.string().min(1, "Message requis."),
  zoneIds: z.array(z.string().uuid()).min(1, "Choisissez au moins une zone."),
});

routeAlertesGestion.post("/", ...GESTION, async (req, res) => {
  const agent = req.utilisateur!;
  const d: LancerAlerteRequete = valider(schemaAlerte, req.body);

  const ids = await donneursEligibles(d.zoneIds);
  if (ids.length === 0) {
    throw new AppError("DONNEES_INVALIDES", "Aucun donneur éligible dans ces zones.", 400);
  }

  const alerteId = await transaction(async (client) => {
    const ins = await client.query<{ id: string }>(
      `insert into alertes (site_id, groupe_sanguin, urgence, objectif_donneurs, date_limite, statut, agent_id, message)
       values ($1, $2, $3, $4, $5, 'ouverte', $6, $7)
       returning id`,
      [agent.siteId, d.groupeSanguin, d.urgence, d.objectifDonneurs, d.dateLimite, agent.id, d.message],
    );
    const alerteId = ins.rows[0].id;

    for (const zoneId of d.zoneIds) {
      await client.query("insert into alerte_zones (alerte_id, zone_id) values ($1, $2) on conflict do nothing", [alerteId, zoneId]);
    }
    for (const donneurId of ids) {
      await client.query("insert into alerte_envois (alerte_id, donneur_id) values ($1, $2) on conflict do nothing", [alerteId, donneurId]);
    }
    return alerteId;
  });

  await inscrireEvenement({
    type: "alerte",
    agentId: agent.id,
    siteId: agent.siteId,
    details: { alerteId, groupeSanguin: d.groupeSanguin, cibles: ids.length },
  });

  res.status(201).json({ donnees: await lireSuivi(alerteId) });
});

routeAlertesGestion.get("/:id", ...GESTION, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw new AppError("INTROUVABLE", "Alerte introuvable.", 404);
  const suivi = await lireSuivi(id.data);
  if (!suivi) throw new AppError("INTROUVABLE", "Alerte introuvable.", 404);
  res.json({ donnees: suivi });
});

routeAlertesGestion.post("/:id/cloture", ...GESTION, async (req, res) => {
  const agent = req.utilisateur!;
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw new AppError("INTROUVABLE", "Alerte introuvable.", 404);

  const { rows } = await requete<{ statut: string }>("select statut from alertes where id = $1", [id.data]);
  if (!rows[0]) throw new AppError("INTROUVABLE", "Alerte introuvable.", 404);

  await requete("update alertes set statut = 'cloturee', cloture_le = now() where id = $1 and statut = 'ouverte'", [id.data]);
  await inscrireEvenement({ type: "cloture_alerte", agentId: agent.id, siteId: agent.siteId, details: { alerteId: id.data } });

  res.json({ donnees: await lireSuivi(id.data) });
});

async function lireSuivi(id: string): Promise<SuiviAlerte | null> {
  const { rows } = await requete<{
    id: string; groupe_sanguin: string | null; urgence: string; objectif_donneurs: number;
    date_limite: Date; statut: string; message: string; cree_le: Date;
  }>(
    "select id, groupe_sanguin, urgence, objectif_donneurs, date_limite, statut, message, cree_le from alertes where id = $1",
    [id],
  );
  const a = rows[0];
  if (!a) return null;

  const { rows: reponses } = await requete<{
    numero_donneur: string; nom: string; reponse: string; moment_passage: string | null; besoin_transport: boolean;
  }>(
    `select d.numero_donneur, d.prenom || ' ' || d.nom as nom, r.reponse, r.moment_passage, r.besoin_transport
     from alerte_reponses r join donneurs d on d.id = r.donneur_id
     where r.alerte_id = $1 order by r.repondu_le`,
    [id],
  );

  const jeViens = reponses.filter((r) => r.reponse === "je_viens").length;
  const pasDisponible = reponses.filter((r) => r.reponse === "pas_disponible").length;
  const besoinTransport = reponses.filter((r) => r.besoin_transport).length;

  return {
    id: a.id,
    groupeSanguin: a.groupe_sanguin as SuiviAlerte["groupeSanguin"],
    urgence: a.urgence as SuiviAlerte["urgence"],
    objectifDonneurs: a.objectif_donneurs,
    dateLimite: instantISO(a.date_limite),
    statut: a.statut as SuiviAlerte["statut"],
    message: a.message,
    creeLe: instantISO(a.cree_le),
    compteurs: { jeViens, pasDisponible, besoinTransport },
    donneurs: reponses.map((r) => ({
      numeroDonneur: r.numero_donneur,
      nom: r.nom,
      reponse: r.reponse as "je_viens" | "pas_disponible",
      momentPassage: r.moment_passage,
      besoinTransport: r.besoin_transport,
    })),
  };
}
