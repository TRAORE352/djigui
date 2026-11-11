import { Router } from "express";
import { z } from "zod";
import type { Delivrance, Demande, DemandeRequete, Expedition, SitePartenaire } from "@dds/contrat-api";
import { AppError } from "../lib/erreurs.js";
import { requete, transaction } from "../lib/db.js";
import { valider } from "../lib/validation.js";
import { inscrireEvenement } from "../lib/evenements.js";
import { normaliserCode } from "../lib/codes-poches.js";
import { instantISO } from "../lib/format.js";
import { authentifier } from "../middlewares/authentification.js";
import { exigerRole } from "../middlewares/roles.js";

const STOCK = [authentifier, exigerRole("agent_stock", "agent_depot", "admin")];

/**
 * P8 / P10 — Distribution : demandes, expéditions, réception, délivrance.
 * Accès : gestionnaire de stock (centre et dépôt).
 */
export const routeDistribution = Router();

const TYPES = ["GR", "PL", "PQ"] as const;
const GROUPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const URGENCES = ["normale", "urgente", "critique"] as const;

// ---------------------------------------------------------------------
// GET /sites-partenaires — à qui ce site peut adresser une demande.
// `GET /sites` est réservé à l'administration : le gestionnaire de stock a
// besoin de la même liste, mais réduite et sans son propre site.
// ---------------------------------------------------------------------
routeDistribution.get("/sites-partenaires", ...STOCK, async (req, res) => {
  const agent = req.utilisateur!;
  const { rows } = await requete<{
    id: string; code: string; nom: string; type: string; ville: string;
  }>(
    `select s.id, s.code, s.nom, s.type, coalesce(z.ville, '') as ville
     from sites s
     left join zones z on z.id = s.zone_id
     where s.actif and s.id <> $1
     order by s.type, s.nom`,
    [agent.siteId],
  );

  const sites: SitePartenaire[] = rows.map((s) => ({
    id: s.id,
    code: s.code,
    nom: s.nom,
    type: s.type as SitePartenaire["type"],
    ville: s.ville,
  }));
  res.json({ donnees: sites });
});

const schemaDemande = z.object({
  siteFournisseurId: z.string().uuid("Fournisseur invalide."),
  urgence: z.enum(URGENCES),
  lignes: z.array(z.object({
    typeProduit: z.enum(TYPES),
    groupeSanguin: z.enum(GROUPES),
    quantite: z.number().int().positive(),
  })).min(1, "Ajoutez au moins une ligne."),
});

// POST /demandes — le dépôt demande des produits au centre.
routeDistribution.post("/demandes", ...STOCK, async (req, res) => {
  const agent = req.utilisateur!;
  const d: DemandeRequete = valider(schemaDemande, req.body);

  const id = await transaction(async (client) => {
    const ins = await client.query<{ id: string }>(
      `insert into demandes (site_demandeur_id, site_fournisseur_id, urgence, statut, agent_id, date)
       values ($1, $2, $3, 'en_attente', $4, current_date)
       returning id`,
      [agent.siteId, d.siteFournisseurId, d.urgence, agent.id],
    );
    const demandeId = ins.rows[0].id;
    for (const ligne of d.lignes) {
      await client.query(
        `insert into demande_lignes (demande_id, type_produit_id, groupe_sanguin, quantite)
         values ($1, (select id from types_produits where code = $2), $3, $4)`,
        [demandeId, ligne.typeProduit, ligne.groupeSanguin, ligne.quantite],
      );
    }
    return demandeId;
  });

  res.status(201).json({ donnees: await lireDemande(id) });
});

// GET /demandes — demandes reçues (le site est fournisseur) ou envoyées.
routeDistribution.get("/demandes", ...STOCK, async (req, res) => {
  const agent = req.utilisateur!;
  const { rows } = await requete<{ id: string }>(
    "select id from demandes where site_fournisseur_id = $1 or site_demandeur_id = $1 order by cree_le desc",
    [agent.siteId],
  );
  const demandes: Demande[] = [];
  for (const r of rows) demandes.push((await lireDemande(r.id))!);
  res.json({ donnees: demandes });
});

async function lireDemande(id: string): Promise<Demande | null> {
  // On joint les sites : un écran doit pouvoir NOMMER qui demande et qui
  // fournit. Un identifiant technique ne dit rien à un agent.
  const { rows } = await requete<{
    id: string; site_demandeur_id: string; site_demandeur_nom: string;
    site_fournisseur_id: string; site_fournisseur_nom: string;
    urgence: string; statut: string; date: Date;
  }>(
    `select d.id, d.site_demandeur_id, sd.nom as site_demandeur_nom,
            d.site_fournisseur_id, sf.nom as site_fournisseur_nom,
            d.urgence, d.statut, d.date
       from demandes d
       join sites sd on sd.id = d.site_demandeur_id
       join sites sf on sf.id = d.site_fournisseur_id
      where d.id = $1`,
    [id],
  );
  const d = rows[0];
  if (!d) return null;
  const { rows: lignes } = await requete<{ type_produit: string; groupe_sanguin: string; quantite: number }>(
    `select t.code as type_produit, l.groupe_sanguin, l.quantite
     from demande_lignes l join types_produits t on t.id = l.type_produit_id where l.demande_id = $1`,
    [id],
  );
  return {
    id: d.id,
    siteDemandeurId: d.site_demandeur_id,
    siteDemandeurNom: d.site_demandeur_nom,
    siteFournisseurId: d.site_fournisseur_id,
    siteFournisseurNom: d.site_fournisseur_nom,
    urgence: d.urgence,
    statut: d.statut,
    date: d.date instanceof Date ? d.date.toISOString().slice(0, 10) : String(d.date).slice(0, 10),
    lignes: lignes.map((l) => ({
      typeProduit: l.type_produit as "GR" | "PL" | "PQ",
      groupeSanguin: l.groupe_sanguin as Demande["lignes"][number]["groupeSanguin"],
      quantite: l.quantite,
    })),
  };
}

// POST /demandes/:id/accepter — le fournisseur accepte : son stock sort.
routeDistribution.post("/demandes/:id/accepter", ...STOCK, async (req, res) => {
  const agent = req.utilisateur!;
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw new AppError("INTROUVABLE", "Demande introuvable.", 404);

  const { rows: dRows } = await requete<{ site_fournisseur_id: string; site_demandeur_id: string; statut: string }>(
    "select site_fournisseur_id, site_demandeur_id, statut from demandes where id = $1", [id.data],
  );
  const demande = dRows[0];
  if (!demande) throw new AppError("INTROUVABLE", "Demande introuvable.", 404);
  if (demande.site_fournisseur_id !== agent.siteId) throw new AppError("NON_CONNECTE", "Cette demande ne concerne pas votre site.", 403);
  if (demande.statut !== "en_attente") throw new AppError("DONNEES_INVALIDES", "Cette demande a déjà été traitée.", 400);

  const { rows: lignes } = await requete<{ type_produit: string; groupe_sanguin: string; quantite: number }>(
    `select t.code as type_produit, l.groupe_sanguin, l.quantite
     from demande_lignes l join types_produits t on t.id = l.type_produit_id
     where l.demande_id = $1`, [id.data],
  );

  await transaction(async (client) => {
    const ins = await client.query<{ id: string }>(
      `insert into expeditions (demande_id, site_depart_id, site_arrivee_id, date_envoi, agent_envoi_id)
       values ($1, $2, $3, now(), $4) returning id`,
      [id.data, agent.siteId, demande.site_demandeur_id, agent.id],
    );
    const expeditionId = ins.rows[0].id;

    // Les quantités demandées sortent du stock, la péremption la plus proche
    // d'abord (premier périmé, premier sorti).
    for (const l of lignes) {
      const { rows: produits } = await client.query<{ id: string }>(
        `select id from produits
         where site_actuel_id = $1 and statut = 'disponible'
           and type_produit_id = (select id from types_produits where code = $2)
           and groupe_sanguin = $3
         order by date_peremption nulls last, cree_le
         limit $4`,
        [agent.siteId, l.type_produit, l.groupe_sanguin, l.quantite],
      );
      if (produits.length < l.quantite) {
        throw new AppError("DONNEES_INVALIDES", `Stock insuffisant en ${l.type_produit} ${l.groupe_sanguin} : ${produits.length} sur ${l.quantite}.`, 400);
      }
      for (const p of produits) {
        await client.query("update produits set statut = 'expedie' where id = $1", [p.id]);
        await client.query(
          "insert into expedition_produits (expedition_id, produit_id) values ($1, $2) on conflict do nothing",
          [expeditionId, p.id],
        );
      }
    }
    await client.query("update demandes set statut = 'acceptee' where id = $1", [id.data]);
  });

  await inscrireEvenement({ type: "acceptation", agentId: agent.id, siteId: agent.siteId, details: { demandeId: id.data } });
  res.json({ donnees: await lireDemande(id.data) });
});

// POST /demandes/:id/recevoir — le demandeur réceptionne : son stock entre.
routeDistribution.post("/demandes/:id/recevoir", ...STOCK, async (req, res) => {
  const agent = req.utilisateur!;
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw new AppError("INTROUVABLE", "Demande introuvable.", 404);

  const { rows: dRows } = await requete<{ site_demandeur_id: string; statut: string }>(
    "select site_demandeur_id, statut from demandes where id = $1", [id.data],
  );
  const demande = dRows[0];
  if (!demande) throw new AppError("INTROUVABLE", "Demande introuvable.", 404);
  if (demande.site_demandeur_id !== agent.siteId) throw new AppError("NON_CONNECTE", "Cette demande ne concerne pas votre site.", 403);
  if (demande.statut !== "acceptee") throw new AppError("DONNEES_INVALIDES", "Cette demande n'est pas prête à être réceptionnée.", 400);

  const { rows: eRows } = await requete<{ id: string }>(
    "select id from expeditions where demande_id = $1 order by date_envoi desc limit 1", [id.data],
  );
  const expedition = eRows[0];
  if (!expedition) throw new AppError("INTROUVABLE", "Aucune expédition pour cette demande.", 404);

  await transaction(async (client) => {
    await client.query(
      `update produits set statut = 'recu', site_actuel_id = $1
       where id in (select produit_id from expedition_produits where expedition_id = $2)`,
      [agent.siteId, expedition.id],
    );
    await client.query("update expeditions set date_reception = now(), agent_reception_id = $1 where id = $2", [agent.id, expedition.id]);
    await client.query("update demandes set statut = 'livree' where id = $1", [id.data]);
  });

  await inscrireEvenement({ type: "reception", agentId: agent.id, siteId: agent.siteId, details: { demandeId: id.data } });
  res.json({ donnees: await lireDemande(id.data) });
});

const schemaExpedition = z.object({
  demandeId: z.string().uuid("Demande invalide."),
  produitIds: z.array(z.string().uuid()).min(1, "Scannez au moins un produit."),
});

// POST /expeditions — le centre envoie des produits.
routeDistribution.post("/expeditions", ...STOCK, async (req, res) => {
  const agent = req.utilisateur!;
  const d = valider(schemaExpedition, req.body);

  const { rows } = await requete<{ site_demandeur_id: string; site_fournisseur_id: string }>(
    "select site_demandeur_id, site_fournisseur_id from demandes where id = $1",
    [d.demandeId],
  );
  const demande = rows[0];
  if (!demande) throw new AppError("INTROUVABLE", "Demande introuvable.", 404);
  if (demande.site_fournisseur_id !== agent.siteId) {
    throw new AppError("NON_CONNECTE", "Cette demande ne concerne pas votre site.", 403);
  }

  const id = await transaction(async (client) => {
    const ins = await client.query<{ id: string }>(
      `insert into expeditions (demande_id, site_depart_id, site_arrivee_id, date_envoi, agent_envoi_id)
       values ($1, $2, $3, now(), $4)
       returning id`,
      [d.demandeId, agent.siteId, demande.site_demandeur_id, agent.id],
    );
    const expeditionId = ins.rows[0].id;
    for (const produitId of d.produitIds) {
      await client.query(
        "update produits set statut = 'expedie' where id = $1 and statut = 'disponible'",
        [produitId],
      );
      await client.query(
        "insert into expedition_produits (expedition_id, produit_id) values ($1, $2) on conflict do nothing",
        [expeditionId, produitId],
      );
    }
    await client.query("update demandes set statut = 'preparee' where id = $1", [d.demandeId]);
    return expeditionId;
  });

  await inscrireEvenement({ type: "expedition", agentId: agent.id, siteId: agent.siteId, details: { demandeId: d.demandeId } });

  res.status(201).json({ donnees: await lireExpedition(id) });
});

async function lireExpedition(id: string): Promise<Expedition | null> {
  const { rows } = await requete<{
    id: string; demande_id: string; site_depart_id: string; site_arrivee_id: string; date_reception: Date | null;
  }>("select id, demande_id, site_depart_id, site_arrivee_id, date_reception from expeditions where id = $1", [id]);
  const e = rows[0];
  if (!e) return null;
  const { rows: produits } = await requete<{ code: string }>(
    "select p.code from expedition_produits ep join produits p on p.id = ep.produit_id where ep.expedition_id = $1",
    [id],
  );
  return {
    id: e.id,
    demandeId: e.demande_id,
    siteDepartId: e.site_depart_id,
    siteArriveeId: e.site_arrivee_id,
    statut: e.date_reception ? "recue" : "en_cours",
    produits: produits.map((p) => p.code),
  };
}

// POST /expeditions/:id/reception — le dépôt réceptionne.
routeDistribution.post("/expeditions/:id/reception", ...STOCK, async (req, res) => {
  const agent = req.utilisateur!;
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw new AppError("INTROUVABLE", "Expédition introuvable.", 404);

  const { rows } = await requete<{ site_arrivee_id: string }>(
    "select site_arrivee_id from expeditions where id = $1",
    [id.data],
  );
  const exp = rows[0];
  if (!exp) throw new AppError("INTROUVABLE", "Expédition introuvable.", 404);
  if (exp.site_arrivee_id !== agent.siteId) {
    throw new AppError("NON_CONNECTE", "Cette expédition ne concerne pas votre site.", 403);
  }

  await transaction(async (client) => {
    await client.query(
      `update produits set statut = 'recu', site_actuel_id = $1
       where id in (select produit_id from expedition_produits where expedition_id = $2)`,
      [agent.siteId, id.data],
    );
    await client.query("update expeditions set date_reception = now(), agent_reception_id = $1 where id = $2", [agent.id, id.data]);
  });

  await inscrireEvenement({ type: "reception", agentId: agent.id, siteId: agent.siteId, details: { expeditionId: id.data } });

  res.json({ donnees: await lireExpedition(id.data) });
});

const schemaDelivrance = z.object({
  code: z.string().min(1, "Code requis."),
  service: z.string().min(1, "Service requis."),
  // Nom de l'agent de santé qui reçoit la poche. Défaut vide pour ne pas
  // casser un ancien frontend pendant la fenêtre de déploiement.
  nomAgent: z.string().default(""),
});

// ---------------------------------------------------------------------
// GET /delivrances — historique des délivrances du site, la plus récente
// d'abord. Le tri par groupe/service/agent se fait côté écran.
// ---------------------------------------------------------------------
routeDistribution.get("/delivrances", ...STOCK, async (req, res) => {
  const agent = req.utilisateur!;
  const { rows } = await requete<{
    id: string; code: string; groupe_sanguin: string; type_produit: string;
    service: string; nom_agent: string; cree_le: Date;
  }>(
    `select d.id, d.service, d.nom_agent, d.cree_le, p.code, p.groupe_sanguin, t.code as type_produit
     from delivrances d
     join produits p on p.id = d.produit_id
     join types_produits t on t.id = p.type_produit_id
     where p.site_actuel_id = $1
     order by d.cree_le desc`,
    [agent.siteId],
  );
  const donnees: Delivrance[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    typeProduit: r.type_produit as Delivrance["typeProduit"],
    groupeSanguin: r.groupe_sanguin as Delivrance["groupeSanguin"],
    service: r.service,
    nomAgent: r.nom_agent,
    creeLe: instantISO(r.cree_le),
  }));
  res.json({ donnees });
});

// POST /delivrances — délivrer un produit à un service.
routeDistribution.post("/delivrances", ...STOCK, async (req, res) => {
  const agent = req.utilisateur!;
  const d = valider(schemaDelivrance, req.body);
  const code = normaliserCode(d.code);

  const { rows } = await requete<{ id: string; code: string; statut: string; groupe_sanguin: string; type_produit: string }>(
    `select p.id, p.code, p.statut, p.groupe_sanguin, t.code as type_produit
     from produits p
     join types_produits t on t.id = p.type_produit_id
     where upper(replace(p.code, '-', '')) = $1`,
    [code],
  );
  const produit = rows[0];
  if (!produit) throw new AppError("INTROUVABLE", "Produit introuvable.", 404);
  if (produit.statut !== "recu" && produit.statut !== "disponible") {
    throw new AppError("DONNEES_INVALIDES", "Ce produit ne peut pas être délivré (statut actuel : " + produit.statut + ").", 400);
  }

  await transaction(async (client) => {
    await client.query("update produits set statut = 'delivre' where id = $1", [produit.id]);
    await client.query(
      "insert into delivrances (produit_id, service, date, agent_id, nom_agent) values ($1, $2, current_date, $3, $4)",
      [produit.id, d.service, agent.id, d.nomAgent],
    );
  });

  await inscrireEvenement({ type: "delivrance", produitId: produit.id, agentId: agent.id, siteId: agent.siteId, details: { code: produit.code, service: d.service, nomAgent: d.nomAgent } });

  res.status(201).json({ donnees: { code: produit.code, typeProduit: produit.type_produit, groupeSanguin: produit.groupe_sanguin, service: d.service, nomAgent: d.nomAgent, statut: "delivre" } });
});
