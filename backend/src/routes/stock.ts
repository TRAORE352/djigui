import { Router } from "express";
import { z } from "zod";
import type { EntreeStock, EntreeStockRequete, LigneStock, Produit } from "@dds/contrat-api";
import { AppError } from "../lib/erreurs.js";
import { requete, transaction } from "../lib/db.js";
import { valider } from "../lib/validation.js";
import { inscrireEvenement } from "../lib/evenements.js";
import { genererCodeExterne, normaliserCode } from "../lib/codes-poches.js";

/**
 * P6 — Stock et produits. Le stock est calculé à partir des produits
 * disponibles, jamais saisi à la main. Accès : gestionnaire de stock / dépôt.
 */

// GET /stock — stock par type et groupe, avec niveau (seuils).
export const routeStock = Router();
routeStock.get("/", async (req, res) => {
  const agent = req.utilisateur!;

  const { rows } = await requete<{ type_produit: string; groupe_sanguin: string; quantite: number }>(
    `select t.code as type_produit, p.groupe_sanguin, count(*)::int as quantite
     from produits p
     join types_produits t on t.id = p.type_produit_id
     where p.site_actuel_id = $1 and p.statut in ('disponible', 'reserve')
     group by t.code, p.groupe_sanguin
     order by t.code, p.groupe_sanguin`,
    [agent.siteId],
  );

  const lignes: LigneStock[] = [];
  for (const l of rows) {
    const { rows: sr } = await requete<{ seuil_bas: number; seuil_critique: number }>(
      `select seuil_bas, seuil_critique from seuils_stock
       where site_id = $1 and type_produit_id = (select id from types_produits where code = $2) and groupe_sanguin = $3`,
      [agent.siteId, l.type_produit, l.groupe_sanguin],
    );
    let niveau: LigneStock["niveau"] = "suffisant";
    if (sr[0]) {
      if (l.quantite <= sr[0].seuil_critique) niveau = "critique";
      else if (l.quantite <= sr[0].seuil_bas) niveau = "bas";
    }
    lignes.push({
      typeProduit: l.type_produit as LigneStock["typeProduit"],
      groupeSanguin: l.groupe_sanguin as LigneStock["groupeSanguin"],
      quantite: l.quantite,
      niveau,
    });
  }

  res.json({ donnees: lignes });
});

// GET /produits?peremption=proche et POST /produits/:code/destruction
export const routeProduits = Router();

routeProduits.get("/", async (req, res) => {
  const agent = req.utilisateur!;
  const proche = req.query.peremption === "proche";

  const { rows } = await requete<{ id: string; code: string; type_produit: string; groupe_sanguin: string; date_peremption: string | null }>(
    `select pr.id, pr.code, t.code as type_produit, pr.groupe_sanguin, to_char(pr.date_peremption, 'YYYY-MM-DD') as date_peremption
     from produits pr
     join types_produits t on t.id = pr.type_produit_id
     where pr.site_actuel_id = $1 and pr.statut in ('disponible', 'reserve')
       ${proche ? "and pr.date_peremption is not null and pr.date_peremption <= current_date + interval '14 days'" : ""}
     order by pr.date_peremption nulls last`,
    [agent.siteId],
  );

  const produits: Produit[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    typeProduit: r.type_produit as Produit["typeProduit"],
    groupeSanguin: r.groupe_sanguin as Produit["groupeSanguin"],
    datePeremption: r.date_peremption,
    statut: "disponible",
    creeLe: "",
  }));
  res.json({ donnees: produits });
});

routeProduits.post("/:code/destruction", async (req, res) => {
  const agent = req.utilisateur!;
  const code = normaliserCode(req.params.code as string);

  const { rows } = await requete<{ id: string; code: string; statut: string; poche_id: string }>(
    "select id, code, statut, poche_id from produits where upper(replace(code, '-', '')) = $1",
    [code],
  );
  const produit = rows[0];
  if (!produit) throw new AppError("INTROUVABLE", "Produit introuvable.", 404);
  if (produit.statut === "delivre" || produit.statut === "detruit") {
    throw new AppError("DONNEES_INVALIDES", "Ce produit n'est plus disponible.", 400);
  }

  await requete("update produits set statut = 'detruit' where id = $1", [produit.id]);
  await inscrireEvenement({
    type: "destruction",
    produitId: produit.id,
    pocheId: produit.poche_id,
    agentId: agent.id,
    siteId: agent.siteId,
    details: { code: produit.code },
  });

  res.json({ donnees: null });
});

// ---------------------------------------------------------------------
// POST /stock/entrees — enregistrer un lot reçu de l'extérieur
// ---------------------------------------------------------------------
/*
 * Un centre de santé reçoit des poches déjà qualifiées, livrées par un
 * laboratoire ou une banque de sang. Sans cette porte d'entrée, le stock
 * ne pouvait être alimenté que par la préparation locale, elle-même
 * suspendue avec l'écran du laboratoire.
 *
 * La saisie est GROUPÉE (« 40 × GR O+ ») : un agent qui reçoit 100
 * poches ne remplit pas 100 formulaires. L'enregistrement, lui, reste
 * UNITAIRE — une ligne `produits` par unité, avec son propre code.
 * C'est ce qui permet de délivrer, expédier ou détruire une unité
 * précise, et de savoir laquelle est partie où.
 */
const schemaLigneLot = z.object({
  typeProduit: z.enum(["GR", "PL", "PQ"]),
  groupeSanguin: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
  // Borne haute : au-delà, c'est une faute de frappe (un « 400 » pour
  // « 40 ») qui créerait des centaines de lignes irrécupérables.
  quantite: z.number().int().min(1).max(500),
  datePeremption: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

const schemaEntree = z.object({
  reference: z.string().trim().min(1).max(60),
  fournisseurId: z.string().uuid().nullable().optional(),
  fournisseurLibre: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(500).optional(),
  lignes: z.array(schemaLigneLot).min(1).max(20),
});

routeStock.post("/entrees", async (req, res) => {
  const agent = req.utilisateur!;
  const d: EntreeStockRequete = valider(schemaEntree, req.body);

  // Le fournisseur doit être identifié : site du réseau OU nom libre.
  // La base porte la même règle, mais un refus SQL donnerait un message
  // illisible à l'agent.
  const libre = d.fournisseurLibre?.trim() || null;
  if (!d.fournisseurId && !libre) {
    throw new AppError("DONNEES_INVALIDES", "Indiquez qui a livré ce lot.", 400, "fournisseurLibre");
  }

  const total = d.lignes.reduce((n, l) => n + l.quantite, 0);
  if (total > 500) {
    throw new AppError(
      "DONNEES_INVALIDES",
      "Un lot ne peut pas dépasser 500 unités. Enregistrez-le en plusieurs fois.",
      400,
      "lignes",
    );
  }

  // Le code du site sert de préfixe aux codes générés.
  const { rows: sr } = await requete<{ code: string; nom: string }>(
    "select code, nom from sites where id = $1",
    [agent.siteId],
  );
  if (!sr[0]) throw new AppError("INTROUVABLE", "Site introuvable.", 404);

  const resultat = await transaction(async (client) => {
    const { rows: lr } = await client.query<{ id: string; recu_le: Date }>(
      `insert into lots_entrants (reference, site_id, fournisseur_id, fournisseur_libre, recu_par, note)
       values ($1, $2, $3, $4, $5, $6)
       returning id, recu_le`,
      [d.reference.trim(), agent.siteId, d.fournisseurId ?? null, libre, agent.id, d.note?.trim() || null],
    );
    const lot = lr[0];

    /*
     * Le numéro de série repart du plus haut déjà attribué sur ce site
     * pour l'année : deux lots du même jour ne doivent pas produire les
     * mêmes codes. La lecture se fait DANS la transaction, donc deux
     * enregistrements simultanés ne peuvent pas lire le même maximum.
     */
    const annee = new Date().getFullYear();
    const { rows: mr } = await client.query<{ maxi: number }>(
      `select coalesce(max(substring(code from '-E\\d{2}-(\\d{5})-')::int), 0) as maxi
       from produits
       where site_actuel_id = $1 and code like $2`,
      [agent.siteId, `${sr[0].code}-E${String(annee).slice(-2)}-%`],
    );
    let numero = mr[0].maxi;

    const codes: string[] = [];
    for (const ligne of d.lignes) {
      const { rows: tr } = await client.query<{ id: string }>(
        "select id from types_produits where code = $1",
        [ligne.typeProduit],
      );
      if (!tr[0]) {
        throw new AppError("DONNEES_INVALIDES", `Type de produit inconnu : ${ligne.typeProduit}.`, 400);
      }

      /*
       * UN SEUL insert pour toute la ligne, pas un par unité.
       * En série, 100 unités = 100 allers-retours vers la base, soit
       * ~20 s — au-delà du délai du navigateur (15 s) : l'agent voyait
       * une erreur alors que l'enregistrement avait réussi. Le pire des
       * cas, parce qu'il aurait resaisi le lot une seconde fois.
       */
      const valeurs: unknown[] = [];
      const tuples: string[] = [];
      for (let i = 0; i < ligne.quantite; i++) {
        numero += 1;
        const code = genererCodeExterne(sr[0].code, annee, numero, ligne.typeProduit);
        codes.push(code);
        const b = valeurs.length;
        tuples.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, 'disponible', $${b + 6})`);
        valeurs.push(code, lot.id, tr[0].id, ligne.groupeSanguin, ligne.datePeremption ?? null, agent.siteId);
      }
      await client.query(
        `insert into produits (code, lot_id, type_produit_id, groupe_sanguin, date_peremption, statut, site_actuel_id)
         values ${tuples.join(", ")}`,
        valeurs,
      );
    }

    return { lot, codes };
  });

  // Trace hors transaction : le journal est immuable, et un échec
  // d'écriture ne doit pas annuler une entrée de stock déjà validée.
  await inscrireEvenement({
    type: "entree_stock",
    agentId: agent.id,
    siteId: agent.siteId,
    details: {
      lotId: resultat.lot.id,
      reference: d.reference.trim(),
      fournisseur: libre ?? d.fournisseurId,
      unites: resultat.codes.length,
    },
  });

  const donnees: EntreeStock = {
    id: resultat.lot.id,
    reference: d.reference.trim(),
    fournisseur: libre ?? sr[0].nom,
    recuLe: resultat.lot.recu_le.toISOString(),
    unitesCreees: resultat.codes.length,
    codes: resultat.codes,
  };
  res.status(201).json({ donnees });
});
