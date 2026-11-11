import { Router } from "express";
import { z } from "zod";
import type {
  AgentCompte, CreerAgentRequete, CreerCentreRequete, CreerZoneRequete,
  DonneurAdmin, Evenement, ModifierRegleRequete, Regle, Role, SiteAdmin, Statistiques,
} from "@dds/contrat-api";
import { AppError } from "../lib/erreurs.js";
import { requete, transaction } from "../lib/db.js";
import { hacher } from "../lib/motdepasse.js";
import { valider } from "../lib/validation.js";
import { instantISO } from "../lib/format.js";
import { authentifier } from "../middlewares/authentification.js";
import { exigerRole } from "../middlewares/roles.js";

/**
 * Espace CNTS (administration) — P1 (comptes et rôles), P2 (zones et centres),
 * règles de don (Annexe E) et tableau de bord temps réel.
 * Toutes les routes exigent le rôle « admin ».
 */
export const routeAdmin = Router();

const protege = [authentifier, exigerRole("admin")];

// Rôles attribuables à un compte de la plateforme. « donneur » n'est pas un
// rôle de connexion à la plateforme (c'est le type d'utilisateur de l'app).
const ROLES_PLATEFORME = [
  "agent_accueil", "agent_prelevement", "agent_labo",
  "agent_stock", "agent_depot", "admin",
] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LigneAgent {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  actif: boolean;
  site_id: string;
  site_nom: string;
  ville: string;
  roles: string[];
  cree_le: Date;
}

const SELECT_AGENT = `
  select u.id, u.nom, u.prenom, u.email, u.telephone, u.actif,
         u.site_id, s.nom as site_nom, u.cree_le,
         coalesce(z.ville, '') as ville,
         coalesce(array_agg(r.role order by r.role) filter (where r.role is not null), '{}') as roles
  from utilisateurs u
  join sites s on s.id = u.site_id
  left join zones z on z.id = s.zone_id
  left join utilisateur_roles r on r.utilisateur_id = u.id
`;

function formaterAgent(a: LigneAgent): AgentCompte {
  return {
    id: a.id,
    nom: a.nom,
    prenom: a.prenom,
    email: a.email,
    telephone: a.telephone,
    roles: a.roles as Role[],
    siteId: a.site_id,
    siteNom: a.site_nom,
    ville: a.ville,
    actif: a.actif,
    creeLe: instantISO(a.cree_le),
  };
}

// GET /agents — liste des comptes de la plateforme (agents + administrateurs).
routeAdmin.get("/agents", ...protege, async (_req, res) => {
  const { rows } = await requete<LigneAgent>(
    `${SELECT_AGENT} group by u.id, s.nom, z.ville order by u.nom, u.prenom`,
  );
  res.json({ donnees: rows.map(formaterAgent) });
});

// POST /agents — créer un compte agent (avec ses rôles).
const schemaCreerAgent = z.object({
  nom: z.string().trim().min(1, "Le nom est requis."),
  prenom: z.string().trim().min(1, "Le prénom est requis."),
  email: z.string().trim().regex(EMAIL, "E-mail invalide."),
  telephone: z.string().trim().optional().default(""),
  motDePasse: z.string().min(8, "Mot de passe : 8 caractères au moins."),
  siteId: z.string().uuid("Site invalide."),
  roles: z.array(z.enum(ROLES_PLATEFORME)).min(1, "Choisissez au moins un rôle."),
});

routeAdmin.post("/agents", ...protege, async (req, res) => {
  const d: CreerAgentRequete = valider(schemaCreerAgent, req.body);

  const deja = await requete("select id from utilisateurs where email = $1", [d.email]);
  if (deja.rowCount) {
    throw new AppError("EMAIL_DEJA_UTILISE", "Cet e-mail est déjà utilisé.", 409, "email");
  }
  const site = await requete("select id from sites where id = $1", [d.siteId]);
  if (!site.rowCount) {
    throw new AppError("INTROUVABLE", "Site introuvable.", 404, "siteId");
  }

  const hash = await hacher(d.motDePasse);
  const id = await transaction(async (client) => {
    const ins = await client.query<{ id: string }>(
      `insert into utilisateurs (nom, prenom, email, telephone, mot_de_passe, site_id)
       values ($1,$2,$3,$4,$5,$6) returning id`,
      [d.nom, d.prenom, d.email, d.telephone, hash, d.siteId],
    );
    for (const role of d.roles) {
      await client.query(
        "insert into utilisateur_roles (utilisateur_id, role) values ($1,$2)",
        [ins.rows[0].id, role],
      );
    }
    return ins.rows[0].id;
  });

  const { rows } = await requete<LigneAgent>(
    `${SELECT_AGENT} where u.id = $1 group by u.id, s.nom, z.ville`, [id],
  );
  res.status(201).json({ donnees: formaterAgent(rows[0]) });
});

// POST /zones — ajouter une zone.
const schemaZone = z.object({
  nom: z.string().trim().min(1, "Le nom est requis."),
  ville: z.string().trim().min(1, "La ville est requise."),
});

routeAdmin.post("/zones", ...protege, async (req, res) => {
  const d: CreerZoneRequete = valider(schemaZone, req.body);
  const deja = await requete("select id from zones where nom = $1 and ville = $2", [d.nom, d.ville]);
  if (deja.rowCount) {
    throw new AppError("DONNEES_INVALIDES", "Cette zone existe déjà.", 409, "nom");
  }
  const { rows } = await requete<{ id: string; nom: string; ville: string }>(
    "insert into zones (nom, ville) values ($1,$2) returning id, nom, ville",
    [d.nom, d.ville],
  );
  res.status(201).json({ donnees: rows[0] });
});

// GET /sites — tous les sites du réseau (centres, dépôts, hôpitaux), avec
// leur zone et le nombre d'agents rattachés. Sert notamment à alimenter le
// choix du site à la création d'un compte agent.
routeAdmin.get("/sites", ...protege, async (_req, res) => {
  const { rows } = await requete<{
    id: string; code: string; nom: string; type: string; adresse: string;
    zone_id: string | null; zone_nom: string | null; ville: string | null;
    telephone: string; horaires: string; actif: boolean; agents: number;
  }>(
    `select s.id, s.code, s.nom, s.type, s.adresse,
            s.zone_id, z.nom as zone_nom, z.ville,
            s.telephone, s.horaires, s.actif,
            count(u.id)::int as agents
     from sites s
     left join zones z on z.id = s.zone_id
     left join utilisateurs u on u.site_id = s.id and u.actif
     group by s.id, z.nom, z.ville
     order by s.type, s.nom`,
  );

  const sites: SiteAdmin[] = rows.map((s) => ({
    id: s.id,
    code: s.code,
    nom: s.nom,
    type: s.type as SiteAdmin["type"],
    adresse: s.adresse,
    zoneId: s.zone_id,
    zoneNom: s.zone_nom,
    ville: s.ville ?? "",
    telephone: s.telephone,
    horaires: s.horaires,
    actif: s.actif,
    agents: s.agents,
  }));
  res.json({ donnees: sites });
});

// POST /centres — ajouter un site (centre, dépôt ou hôpital).
const schemaCentre = z.object({
  code: z.string().trim().regex(/^[A-Z]{3}$/, "Code sur 3 lettres majuscules."),
  nom: z.string().trim().min(1, "Le nom est requis."),
  type: z.enum(["centre", "depot", "hopital"]),
  adresse: z.string().trim().optional().default(""),
  zoneId: z.string().uuid("Zone invalide.").nullable().optional(),
  telephone: z.string().trim().optional().default(""),
  horaires: z.string().trim().optional().default(""),
});

routeAdmin.post("/centres", ...protege, async (req, res) => {
  const d: CreerCentreRequete = valider(schemaCentre, req.body);
  const deja = await requete("select id from sites where code = $1", [d.code]);
  if (deja.rowCount) {
    throw new AppError("DONNEES_INVALIDES", "Ce code de site existe déjà.", 409, "code");
  }
  if (d.zoneId) {
    const z = await requete("select id from zones where id = $1", [d.zoneId]);
    if (!z.rowCount) throw new AppError("INTROUVABLE", "Zone introuvable.", 404, "zoneId");
  }
  const { rows } = await requete<{ id: string; code: string; nom: string; type: string }>(
    `insert into sites (code, nom, type, adresse, zone_id, telephone, horaires)
     values ($1,$2,$3,$4,$5,$6,$7) returning id, code, nom, type`,
    [d.code, d.nom, d.type, d.adresse, d.zoneId ?? null, d.telephone, d.horaires],
  );
  res.status(201).json({ donnees: rows[0] });
});

// GET /regles — les valeurs réglables (Annexe E).
routeAdmin.get("/regles", ...protege, async (_req, res) => {
  const { rows } = await requete<Regle>("select cle, valeur, description from regles order by cle");
  res.json({ donnees: rows });
});

// PUT /regles/:cle — modifier une règle.
const schemaRegle = z.object({ valeur: z.string().trim().min(1, "La valeur est requise.") });

routeAdmin.put("/regles/:cle", ...protege, async (req, res) => {
  const d: ModifierRegleRequete = valider(schemaRegle, req.body);
  const cle = req.params.cle as string;
  const { rows } = await requete<Regle>(
    "update regles set valeur = $1 where cle = $2 returning cle, valeur, description",
    [d.valeur, cle],
  );
  if (!rows[0]) throw new AppError("INTROUVABLE", "Règle introuvable.", 404);
  res.json({ donnees: rows[0] });
});

// GET /statistiques — tableau de bord temps réel.
routeAdmin.get("/statistiques", ...protege, async (_req, res) => {
  const [donneurs, dons, poches, produits, alertes, demandes, zones, sites, agents] = await Promise.all([
    requete<{ total: number; actifs: number; en_pause: number }>(
      `select count(*)::int as total,
              count(*) filter (where actif)::int as actifs,
              count(*) filter (where pause_jusquau is not null and pause_jusquau >= current_date)::int as en_pause
       from donneurs`,
    ),
    requete<{ n: number }>(
      "select count(*)::int as n from passages where resultat = 'apte' and date = current_date",
    ),
    requete<{ n: number }>(
      "select count(*)::int as n from poches where statut in ('prelevee','en_analyse')",
    ),
    requete<{ n: number }>(
      "select count(*)::int as n from produits where statut in ('disponible','reserve')",
    ),
    requete<{ n: number }>("select count(*)::int as n from alertes where statut = 'ouverte'"),
    requete<{ n: number }>("select count(*)::int as n from demandes where statut = 'en_attente'"),
    requete<{ n: number }>("select count(*)::int as n from zones"),
    requete<{ n: number }>("select count(*)::int as n from sites where actif"),
    requete<{ n: number }>("select count(*)::int as n from utilisateurs where actif"),
  ]);

  const stats: Statistiques = {
    donneurs: {
      total: donneurs.rows[0].total,
      actifs: donneurs.rows[0].actifs,
      enPause: donneurs.rows[0].en_pause,
    },
    donsAujourdhui: dons.rows[0].n,
    pochesEnAnalyse: poches.rows[0].n,
    produitsDisponibles: produits.rows[0].n,
    alertesEnCours: alertes.rows[0].n,
    demandesEnAttente: demandes.rows[0].n,
    zones: zones.rows[0].n,
    sites: sites.rows[0].n,
    agents: agents.rows[0].n,
  };
  res.json({ donnees: stats });
});

// GET /activite/:id — l'historique d'une personne (agent ou donneur).
routeAdmin.get("/activite/:id", ...protege, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw new AppError("INTROUVABLE", "Personne introuvable.", 404);
  const { rows } = await requete<{
    id: string; type: string; date: Date; acteur: string; site_nom: string; cible: string;
  }>(
    `select e.id, e.type, e.date,
            coalesce(u.prenom || ' ' || u.nom, d.prenom || ' ' || d.nom, '') as acteur,
            coalesce(s.nom, '') as site_nom,
            coalesce(p.code, pr.code, '') as cible
     from evenements e
     left join utilisateurs u on u.id = e.agent_id
     left join donneurs d on d.id = e.donneur_id
     left join sites s on s.id = e.site_id
     left join poches p on p.id = e.poche_id
     left join produits pr on pr.id = e.produit_id
     where e.agent_id = $1 or e.donneur_id = $1
     order by e.date desc
     limit 100`,
    [id.data],
  );
  const donnees: Evenement[] = rows.map((r) => ({
    id: r.id, type: r.type, acteur: r.acteur,
    siteNom: r.site_nom, cible: r.cible, date: instantISO(r.date),
  }));
  res.json({ donnees });
});

// GET /donneurs — les donneurs, vus par le CNTS (avec leur zone et leur ville).
routeAdmin.get("/donneurs", ...protege, async (_req, res) => {
  const { rows } = await requete<{
    id: string; nom: string; prenom: string; telephone: string;
    groupe_sanguin: string | null; ville: string; zone: string;
    actif: boolean; cree_le: Date;
  }>(
    `select d.id, d.nom, d.prenom, d.telephone, d.groupe_sanguin, d.actif, d.cree_le,
            coalesce(z.nom, '') as zone, coalesce(z.ville, '') as ville
     from donneurs d
     left join zones z on z.id = d.zone_id
     order by d.nom, d.prenom`,
  );
  const donnees: DonneurAdmin[] = rows.map((r) => ({
    id: r.id, nom: r.nom, prenom: r.prenom, telephone: r.telephone,
    groupeSanguin: r.groupe_sanguin as DonneurAdmin["groupeSanguin"],
    ville: r.ville, zone: r.zone, actif: r.actif, creeLe: instantISO(r.cree_le),
  }));
  res.json({ donnees });
});

// GET /activite — le journal des dernières actions (agents et labo), la plus
// récente d'abord. Sert au tableau de bord temps réel du CNTS.
routeAdmin.get("/activite", ...protege, async (_req, res) => {
  const { rows } = await requete<{
    id: string; type: string; date: Date; acteur: string; site_nom: string; cible: string;
  }>(
    `select e.id, e.type, e.date,
            coalesce(u.prenom || ' ' || u.nom, d.prenom || ' ' || d.nom, '') as acteur,
            coalesce(s.nom, '') as site_nom,
            coalesce(p.code, pr.code, '') as cible
     from evenements e
     left join utilisateurs u on u.id = e.agent_id
     left join donneurs d on d.id = e.donneur_id
     left join sites s on s.id = e.site_id
     left join poches p on p.id = e.poche_id
     left join produits pr on pr.id = e.produit_id
     order by e.date desc
     limit 50`,
  );
  const donnees: Evenement[] = rows.map((r) => ({
    id: r.id, type: r.type, acteur: r.acteur,
    siteNom: r.site_nom, cible: r.cible, date: instantISO(r.date),
  }));
  res.json({ donnees });
});
