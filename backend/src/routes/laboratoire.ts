import { Router } from "express";
import { z } from "zod";
import type {
  DossierLabo, FileLabo, GroupageRequete, MarqueurSerologie,
  ReceptionLaboRequete, SerologieRequete,
} from "@dds/contrat-api";
import { AppError } from "../lib/erreurs.js";
import { requete, transaction } from "../lib/db.js";
import { valider } from "../lib/validation.js";
import { inscrireEvenement } from "../lib/evenements.js";
import { normaliserCode } from "../lib/codes-poches.js";
import { exigerRole } from "../middlewares/roles.js";

/**
 * Qualification biologique du don — la chaîne réelle du laboratoire.
 *
 *   GET  /poches/file-labo              file d'attente, étape par étape
 *   GET  /poches/:code/dossier          dossier complet d'une poche
 *   POST /poches/:code/reception-labo   contrôle des tubes à l'arrivée
 *   POST /poches/:code/groupage         ABO/RhD en double détermination
 *   POST /poches/:code/serologie        marqueurs des maladies transmissibles
 *   POST /poches/:code/liberation       verdict final (écrit dans `analyses`)
 *
 * Règle d'or : le verdict n'est jamais saisi à la main. Il est CALCULÉ à
 * partir des examens enregistrés. Un technicien ne peut pas déclarer une
 * poche conforme si un marqueur manque ou si un résultat est positif.
 */
export const routeLabo = Router();

const LABO = exigerRole("agent_labo", "admin");

const GROUPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

/**
 * Marqueurs obligatoires avant toute transfusion. HTLV et paludisme
 * restent facultatifs : leur recherche dépend du contexte local, mais
 * un résultat positif rend la poche non conforme comme les autres.
 */
const MARQUEURS_OBLIGATOIRES: MarqueurSerologie[] = ["vih", "hepatite_b", "hepatite_c", "syphilis"];

const TOUS_MARQUEURS = ["vih", "hepatite_b", "hepatite_c", "syphilis", "htlv", "paludisme"] as const;

// ---------------------------------------------------------------------
// Lecture du dossier : une seule fonction, utilisée partout.
// ---------------------------------------------------------------------

interface LignePoche {
  id: string;
  code: string;
  statut: string;
  date: string;
  volume: number | null;
  numero_donneur: string | null;
}

async function lirePoche(code: string): Promise<LignePoche> {
  const { rows } = await requete<LignePoche>(
    `select p.id, p.code, p.statut, to_char(p.date, 'YYYY-MM-DD') as date, p.volume,
            d.numero_donneur
     from poches p
     left join donneurs d on d.id = p.donneur_id
     where upper(replace(p.code, '-', '')) = $1`,
    [normaliserCode(code)],
  );
  const poche = rows[0];
  if (!poche) throw new AppError("INTROUVABLE", "Poche introuvable.", 404);
  return poche;
}

async function construireDossier(poche: LignePoche): Promise<DossierLabo> {
  const { rows: rec } = await requete<{
    conforme: boolean; motif: string | null; precisions: string;
    technicien: string; cree_le: Date;
  }>(
    `select r.conforme, r.motif, r.precisions,
            coalesce(u.prenom || ' ' || u.nom, '') as technicien, r.cree_le
     from receptions_laboratoire r
     left join utilisateurs u on u.id = r.technicien_id
     where r.poche_id = $1`,
    [poche.id],
  );

  const { rows: grp } = await requete<{
    determination_1: string; determination_2: string; rai_positive: boolean;
    phenotype: string; technicien: string; cree_le: Date;
  }>(
    `select g.determination_1, g.determination_2, g.rai_positive, g.phenotype,
            coalesce(u.prenom || ' ' || u.nom, '') as technicien, g.cree_le
     from groupages g
     left join utilisateurs u on u.id = g.technicien_id
     where g.poche_id = $1`,
    [poche.id],
  );

  const { rows: sero } = await requete<{
    marqueur: string; resultat: string; technicien: string; cree_le: Date;
  }>(
    `select s.marqueur, s.resultat,
            coalesce(u.prenom || ' ' || u.nom, '') as technicien, s.cree_le
     from serologies s
     left join utilisateurs u on u.id = s.technicien_id
     where s.poche_id = $1
     order by s.cree_le`,
    [poche.id],
  );

  const reception = rec[0]
    ? {
        conforme: rec[0].conforme,
        motif: (rec[0].motif ?? null) as DossierLabo["reception"] extends null ? never : never,
        precisions: rec[0].precisions,
        technicien: rec[0].technicien,
        date: rec[0].cree_le.toISOString(),
      }
    : null;

  const groupage = grp[0]
    ? {
        determination1: grp[0].determination_1 as never,
        determination2: grp[0].determination_2 as never,
        raiPositive: grp[0].rai_positive,
        phenotype: grp[0].phenotype,
        technicien: grp[0].technicien,
        date: grp[0].cree_le.toISOString(),
      }
    : null;

  const serologies = sero.map((s) => ({
    marqueur: s.marqueur as MarqueurSerologie,
    resultat: s.resultat as "negatif" | "positif" | "ininterpretable",
    technicien: s.technicien,
    date: s.cree_le.toISOString(),
  }));

  const faits = new Set(serologies.filter((s) => s.resultat !== "ininterpretable").map((s) => s.marqueur));
  const marqueursManquants = MARQUEURS_OBLIGATOIRES.filter((m) => !faits.has(m));

  // Le verdict est calculé, jamais saisi.
  let verdictPossible: DossierLabo["verdictPossible"];
  if (reception && !reception.conforme) {
    verdictPossible = "non_conforme";
  } else if (serologies.some((s) => s.resultat === "positif")) {
    verdictPossible = "non_conforme";
  } else if (!reception || !groupage || marqueursManquants.length > 0) {
    verdictPossible = "incomplet";
  } else {
    verdictPossible = "conforme";
  }

  // L'étape courante : la première chose qui reste à faire.
  let etape: DossierLabo["etape"];
  if (poche.statut === "conforme" || poche.statut === "non_conforme"
      || poche.statut === "preparee" || poche.statut === "detruite") {
    etape = "terminee";
  } else if (!reception) {
    etape = "reception";
  } else if (!reception.conforme) {
    etape = "liberation";          // refus à la réception : à écarter
  } else if (!groupage) {
    etape = "groupage";
  } else if (marqueursManquants.length > 0 && verdictPossible !== "non_conforme") {
    etape = "serologie";
  } else {
    etape = "liberation";
  }

  return {
    code: poche.code,
    statut: poche.statut as DossierLabo["statut"],
    etape,
    datePrelevement: poche.date,
    volume: poche.volume,
    numeroDonneur: poche.numero_donneur,
    reception: reception as DossierLabo["reception"],
    groupage,
    serologies,
    marqueursManquants,
    verdictPossible,
  };
}

// ---------------------------------------------------------------------
// GET /poches/file-labo — la file d'attente, rangée par étape
// ---------------------------------------------------------------------
routeLabo.get("/file-labo", LABO, async (req, res) => {
  const agent = req.utilisateur!;
  const { rows } = await requete<LignePoche>(
    `select p.id, p.code, p.statut, to_char(p.date, 'YYYY-MM-DD') as date, p.volume,
            d.numero_donneur
     from poches p
     left join donneurs d on d.id = p.donneur_id
     where p.site_id = $1 and p.statut in ('prelevee', 'en_analyse')
     order by p.cree_le`,
    [agent.siteId],
  );

  const file: FileLabo = { aRecevoir: [], aGrouper: [], aTester: [], aLiberer: [] };
  for (const poche of rows) {
    const dossier = await construireDossier(poche);
    if (dossier.etape === "reception") file.aRecevoir.push(dossier);
    else if (dossier.etape === "groupage") file.aGrouper.push(dossier);
    else if (dossier.etape === "serologie") file.aTester.push(dossier);
    else if (dossier.etape === "liberation") file.aLiberer.push(dossier);
  }

  res.json({ donnees: file });
});

// ---------------------------------------------------------------------
// GET /poches/:code/dossier
// ---------------------------------------------------------------------
routeLabo.get("/:code/dossier", LABO, async (req, res) => {
  const poche = await lirePoche(req.params.code as string);
  res.json({ donnees: await construireDossier(poche) });
});

// ---------------------------------------------------------------------
// POST /poches/:code/reception-labo — contrôle des tubes
// ---------------------------------------------------------------------
const schemaReception = z.object({
  conforme: z.boolean(),
  motif: z.enum([
    "tubes_absents", "etiquetage_illisible", "echantillon_hemolyse",
    "volume_insuffisant", "chaine_du_froid_rompue", "autre",
  ]).nullable().optional(),
  precisions: z.string().max(500).optional(),
});

routeLabo.post("/:code/reception-labo", LABO, async (req, res) => {
  const agent = req.utilisateur!;
  const d: ReceptionLaboRequete = valider(schemaReception, req.body);
  const poche = await lirePoche(req.params.code as string);

  if (poche.statut !== "prelevee" && poche.statut !== "en_analyse") {
    throw new AppError("DONNEES_INVALIDES", "Cette poche n'est plus au laboratoire.", 400);
  }
  if (!d.conforme && !d.motif) {
    throw new AppError("DONNEES_INVALIDES", "Indiquez pourquoi l'échantillon est refusé.", 400, "motif");
  }

  const deja = await requete("select 1 from receptions_laboratoire where poche_id = $1", [poche.id]);
  if (deja.rowCount) {
    throw new AppError("DONNEES_INVALIDES", "Cette poche a déjà été réceptionnée.", 400);
  }

  await transaction(async (client) => {
    await client.query(
      `insert into receptions_laboratoire (poche_id, conforme, motif, precisions, technicien_id)
       values ($1, $2, $3, $4, $5)`,
      [poche.id, d.conforme, d.conforme ? null : d.motif, d.precisions ?? "", agent.id],
    );
    await client.query("update poches set statut = 'en_analyse' where id = $1", [poche.id]);
  });

  await inscrireEvenement({
    type: "reception_labo", pocheId: poche.id, agentId: agent.id, siteId: agent.siteId,
    details: { code: poche.code, conforme: d.conforme, motif: d.motif ?? null },
  });

  res.status(201).json({ donnees: await construireDossier(await lirePoche(poche.code)) });
});

// ---------------------------------------------------------------------
// POST /poches/:code/groupage — ABO/RhD en double détermination
// ---------------------------------------------------------------------
const schemaGroupage = z.object({
  determination1: z.enum(GROUPES),
  determination2: z.enum(GROUPES),
  raiPositive: z.boolean(),
  phenotype: z.string().max(120).optional(),
});

routeLabo.post("/:code/groupage", LABO, async (req, res) => {
  const agent = req.utilisateur!;
  const d: GroupageRequete = valider(schemaGroupage, req.body);
  const poche = await lirePoche(req.params.code as string);

  // Sécurité transfusionnelle : pas de groupe validé sur une seule lecture.
  if (d.determination1 !== d.determination2) {
    throw new AppError(
      "DONNEES_INVALIDES",
      "Les deux déterminations ne concordent pas. Refaites le groupage avant d'enregistrer.",
      400,
      "determination2",
    );
  }

  const rec = await requete<{ conforme: boolean }>(
    "select conforme from receptions_laboratoire where poche_id = $1", [poche.id],
  );
  if (!rec.rows[0]) throw new AppError("DONNEES_INVALIDES", "Réceptionnez l'échantillon avant de grouper.", 400);
  if (!rec.rows[0].conforme) throw new AppError("DONNEES_INVALIDES", "L'échantillon a été refusé à la réception.", 400);

  const deja = await requete("select 1 from groupages where poche_id = $1", [poche.id]);
  if (deja.rowCount) throw new AppError("DONNEES_INVALIDES", "Le groupage de cette poche est déjà enregistré.", 400);

  await requete(
    `insert into groupages (poche_id, determination_1, determination_2, rai_positive, phenotype, technicien_id)
     values ($1, $2, $3, $4, $5, $6)`,
    [poche.id, d.determination1, d.determination2, d.raiPositive, d.phenotype ?? "", agent.id],
  );

  await inscrireEvenement({
    type: "groupage", pocheId: poche.id, agentId: agent.id, siteId: agent.siteId,
    details: { code: poche.code, groupe: d.determination1, raiPositive: d.raiPositive },
  });

  res.status(201).json({ donnees: await construireDossier(await lirePoche(poche.code)) });
});

// ---------------------------------------------------------------------
// POST /poches/:code/serologie — un ou plusieurs marqueurs
// ---------------------------------------------------------------------
const schemaSerologie = z.object({
  resultats: z.array(z.object({
    marqueur: z.enum(TOUS_MARQUEURS),
    resultat: z.enum(["negatif", "positif", "ininterpretable"]),
  })).min(1, "Enregistrez au moins un résultat."),
});

routeLabo.post("/:code/serologie", LABO, async (req, res) => {
  const agent = req.utilisateur!;
  const d: SerologieRequete = valider(schemaSerologie, req.body);
  const poche = await lirePoche(req.params.code as string);

  const rec = await requete<{ conforme: boolean }>(
    "select conforme from receptions_laboratoire where poche_id = $1", [poche.id],
  );
  if (!rec.rows[0]?.conforme) {
    throw new AppError("DONNEES_INVALIDES", "L'échantillon doit être réceptionné et conforme.", 400);
  }

  await transaction(async (client) => {
    for (const r of d.resultats) {
      // Un contrôle qui infirme un premier résultat remplace la ligne.
      await client.query(
        `insert into serologies (poche_id, marqueur, resultat, technicien_id)
         values ($1, $2, $3, $4)
         on conflict (poche_id, marqueur)
         do update set resultat = excluded.resultat, technicien_id = excluded.technicien_id, cree_le = now()`,
        [poche.id, r.marqueur, r.resultat, agent.id],
      );
    }
  });

  await inscrireEvenement({
    type: "serologie", pocheId: poche.id, agentId: agent.id, siteId: agent.siteId,
    details: { code: poche.code, resultats: d.resultats },
  });

  res.status(201).json({ donnees: await construireDossier(await lirePoche(poche.code)) });
});

// ---------------------------------------------------------------------
// POST /poches/:code/liberation — verdict final
// ---------------------------------------------------------------------
routeLabo.post("/:code/liberation", LABO, async (req, res) => {
  const agent = req.utilisateur!;
  const poche = await lirePoche(req.params.code as string);
  const dossier = await construireDossier(poche);

  if (dossier.etape === "terminee") {
    throw new AppError("DONNEES_INVALIDES", "Cette poche a déjà été libérée.", 400);
  }
  if (dossier.verdictPossible === "incomplet") {
    throw new AppError(
      "DONNEES_INVALIDES",
      "Dossier incomplet : terminez le groupage et les marqueurs obligatoires avant de libérer.",
      400,
    );
  }

  const conforme = dossier.verdictPossible === "conforme";
  const groupe = dossier.groupage?.determination1 ?? null;

  // Une poche refusée à la réception n'a pas de groupe : on ne peut pas
  // écrire dans `analyses`, qui exige un groupe. Elle est détruite.
  const statut = conforme ? "conforme" : "non_conforme";

  await transaction(async (client) => {
    if (groupe) {
      await client.query(
        `insert into analyses (poche_id, groupe_sanguin, resultat, technicien_id)
         values ($1, $2, $3, $4)`,
        [poche.id, groupe, conforme ? "conforme" : "non_conforme", agent.id],
      );
      // Le groupe confirmé remonte sur la carte du donneur.
      await client.query(
        "update donneurs set groupe_sanguin = $1 where id = (select donneur_id from poches where id = $2)",
        [groupe, poche.id],
      );
    }
    await client.query("update poches set statut = $1 where id = $2", [statut, poche.id]);

    // Sérologie positive : le donneur doit être rappelé par un médecin.
    // Le résultat ne lui est jamais transmis par l'application.
    const positifs = dossier.serologies.filter((s) => s.resultat === "positif");
    if (positifs.length > 0) {
      await client.query(
        `insert into suivis_medicaux (donneur_id, motif, cree_par)
         values ((select donneur_id from poches where id = $1), $2, $3)`,
        [poche.id, `Sérologie à contrôler (${positifs.map((p) => p.marqueur).join(", ")})`, agent.id],
      );
    }
  });

  await inscrireEvenement({
    type: "analyse", pocheId: poche.id, agentId: agent.id, siteId: agent.siteId,
    details: { code: poche.code, resultat: statut, groupe },
  });

  res.json({ donnees: await construireDossier(await lirePoche(poche.code)) });
});
