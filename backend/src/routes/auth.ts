import { Router } from "express";
import { z } from "zod";
import type { Role } from "@dds/contrat-api";
import { AppError } from "../lib/erreurs.js";
import { requete, transaction } from "../lib/db.js";
import { hacher, verifier } from "../lib/motdepasse.js";
import { signerJeton } from "../lib/jwt.js";
import { genererCode } from "../lib/code.js";
import { lireRegle } from "../lib/regles.js";
import { envoyerCodeWhatsApp } from "../lib/whatsapp.js";

export const routeAuth = Router();

// ---------------------------------------------------------------------
// Validation des requêtes (zod) → erreur DONNEES_INVALIDES au format du contrat
// ---------------------------------------------------------------------
const TELEPHONE = /^\+226\d{8}$/;
const GROUPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const CANAUX = ["whatsapp", "sms", "appel"] as const;

function valider<T>(schema: z.ZodType<T>, donnees: unknown): T {
  const r = schema.safeParse(donnees);
  if (!r.success) {
    const premier = r.error.issues[0];
    throw new AppError(
      "DONNEES_INVALIDES",
      premier.message,
      400,
      premier.path.join(".") || undefined,
    );
  }
  return r.data;
}

const estMajeur = (dateNaissance: string): boolean => {
  const naissance = new Date(`${dateNaissance}T00:00:00Z`);
  if (Number.isNaN(naissance.getTime())) return false;
  const majeur = new Date(naissance);
  majeur.setFullYear(majeur.getFullYear() + 18);
  return majeur <= new Date();
};

const schemaInscription = z.object({
  nom: z.string().trim().min(1, "Le nom est requis."),
  prenom: z.string().trim().min(1, "Le prénom est requis."),
  sexe: z.enum(["F", "M"]),
  dateNaissance: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format AAAA-MM-JJ.")
    .refine(estMajeur, "Vous devez avoir au moins 18 ans."),
  telephone: z.string().regex(TELEPHONE, "Numéro au format +226XXXXXXXX."),
  motDePasse: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères."),
  groupeSanguin: z.enum(GROUPES).nullable(),
  zoneId: z.string().uuid("Zone invalide."),
  canaux: z.array(z.enum(CANAUX)).min(1, "Choisissez au moins un canal."),
  consentement: z.literal(true, { message: "Le consentement est requis." }),
});

const schemaConnexion = z.object({
  telephone: z.string().regex(TELEPHONE, "Numéro au format +226XXXXXXXX."),
  motDePasse: z.string().min(1, "Mot de passe requis."),
});

const schemaVerification = z.object({
  telephone: z.string().regex(TELEPHONE),
  code: z.string().regex(/^\d{6}$/, "Le code fait 6 chiffres."),
});

const schemaRenvoi = z.object({
  telephone: z.string().regex(TELEPHONE),
  objet: z.enum(["inscription", "mot_de_passe"]),
});

const schemaMotDePasseOublie = z.object({
  telephone: z.string().regex(TELEPHONE),
});

const schemaNouveauMotDePasse = z.object({
  telephone: z.string().regex(TELEPHONE),
  code: z.string().regex(/^\d{6}$/, "Le code fait 6 chiffres."),
  motDePasse: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères."),
});

const schemaAgentConnexion = z.object({
  email: z.string().email("E-mail invalide."),
  motDePasse: z.string().min(1, "Mot de passe requis."),
});

// ---------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------
interface LigneCode {
  id: string;
  code: string;
  expiration: Date;
  nombre_essais: number;
  utilise: boolean;
}

/** Crée un code (hashé), l'enregistre et renvoie le code en clair + sa durée. */
async function creerCode(
  donneurId: string,
  usage: "verification_numero" | "mot_de_passe",
): Promise<{ code: string; expireDans: number }> {
  const code = genererCode();
  const hash = await hacher(code);
  const expireDans = (await lireRegle("code_validite_minutes", 10)) * 60;
  const expiration = new Date(Date.now() + expireDans * 1000);
  await requete(
    `insert into codes_verification (donneur_id, code, canal, usage, expiration)
     values ($1, $2, 'whatsapp', $3, $4)`,
    [donneurId, hash, usage, expiration],
  );
  return { code, expireDans };
}

const RENVOI_POSSIBLE_DANS = 60; // secondes — délai avant de redemander un code

// ---------------------------------------------------------------------
// Routes — application des donneurs
// ---------------------------------------------------------------------

// D3 — inscription
routeAuth.post("/inscription", async (req, res) => {
  const d = valider(schemaInscription, req.body);

  const deja = await requete("select id from donneurs where telephone = $1", [d.telephone]);
  if (deja.rowCount) {
    throw new AppError("TELEPHONE_DEJA_INSCRIT", "Ce numéro est déjà inscrit.", 409, "telephone");
  }

  const motDePasse = await hacher(d.motDePasse);
  const id = await transaction(async (client) => {
    const numero = await client.query<{ n: string }>("select nextval('numero_donneur_seq') as n");
    const numeroDonneur = `DDS-${new Date().getFullYear()}-${String(numero.rows[0].n).padStart(6, "0")}`;
    const ins = await client.query<{ id: string }>(
      `insert into donneurs (numero_donneur, nom, prenom, sexe, date_naissance, telephone,
         mot_de_passe, groupe_sanguin, zone_id, canaux, origine)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'application')
       returning id`,
      [
        numeroDonneur, d.nom, d.prenom, d.sexe, d.dateNaissance, d.telephone,
        motDePasse, d.groupeSanguin, d.zoneId, d.canaux,
      ],
    );
    return ins.rows[0].id;
  });

  const { code, expireDans } = await creerCode(id, "verification_numero");
  await envoyerCodeWhatsApp(d.telephone, code, "inscription");

  res.status(201).json({
    donnees: { telephone: d.telephone, canal: "whatsapp", expireDans, renvoiPossibleDans: RENVOI_POSSIBLE_DANS },
  });
});

// D5 — connexion donneur
routeAuth.post("/connexion", async (req, res) => {
  const d = valider(schemaConnexion, req.body);
  const { rows } = await requete<{ id: string; nom: string; prenom: string; mot_de_passe: string | null; telephone_verifie: boolean; actif: boolean }>(
    "select id, nom, prenom, mot_de_passe, telephone_verifie, actif from donneurs where telephone = $1",
    [d.telephone],
  );
  const donneur = rows[0];
  if (!donneur || !donneur.actif || !(await verifier(d.motDePasse, donneur.mot_de_passe ?? ""))) {
    throw new AppError("IDENTIFIANTS_INVALIDES", "Numéro ou mot de passe incorrect.", 401);
  }
  if (!donneur.telephone_verifie) {
    throw new AppError("TELEPHONE_NON_VERIFIE", "Votre numéro n'est pas encore vérifié.", 403, "telephone");
  }

  const jeton = signerJeton({ id: donneur.id, type: "donneur", roles: ["donneur"], siteId: null });
  res.json({
    donnees: {
      jeton,
      utilisateur: { id: donneur.id, role: "donneur", nomComplet: `${donneur.nom} ${donneur.prenom}` },
    },
  });
});

// D4 — vérification du numéro (le donneur devient connecté)
routeAuth.post("/verification", async (req, res) => {
  const d = valider(schemaVerification, req.body);
  const { rows } = await requete<{ id: string; nom: string; prenom: string }>(
    "select id, nom, prenom from donneurs where telephone = $1 and actif",
    [d.telephone],
  );
  if (!rows[0]) throw new AppError("INTROUVABLE", "Numéro inconnu.", 404);
  const donneur = rows[0];

  const { rows: codes } = await requete<LigneCode>(
    `select id, code, expiration, nombre_essais, utilise from codes_verification
     where donneur_id = $1 and usage = 'verification_numero' and not utilise
     order by cree_le desc limit 1`,
    [donneur.id],
  );
  if (!codes[0]) throw new AppError("CODE_EXPIRE", "Aucun code en attente. Redemandez un code.", 400);
  const code = codes[0];

  const essaisMax = await lireRegle("code_essais_max", 5);
  if (code.nombre_essais >= essaisMax) {
    throw new AppError("TROP_DE_TENTATIVES", "Trop de tentatives. Redemandez un code.", 429);
  }
  if (new Date(code.expiration) < new Date()) {
    throw new AppError("CODE_EXPIRE", "Le code a expiré.", 400);
  }
  if (!(await verifier(d.code, code.code))) {
    await requete("update codes_verification set nombre_essais = nombre_essais + 1 where id = $1", [code.id]);
    throw new AppError("CODE_INCORRECT", "Code incorrect.", 400, "code");
  }

  await transaction(async (client) => {
    await client.query("update codes_verification set utilise = true where id = $1", [code.id]);
    await client.query("update donneurs set telephone_verifie = true where id = $1", [donneur.id]);
  });

  const jeton = signerJeton({ id: donneur.id, type: "donneur", roles: ["donneur"], siteId: null });
  res.json({
    donnees: {
      jeton,
      utilisateur: { id: donneur.id, role: "donneur", nomComplet: `${donneur.nom} ${donneur.prenom}` },
    },
  });
});

// D4/D7 — renvoyer un code
routeAuth.post("/code/renvoi", async (req, res) => {
  const d = valider(schemaRenvoi, req.body);
  const { rows } = await requete<{ id: string }>("select id from donneurs where telephone = $1 and actif", [d.telephone]);
  if (!rows[0]) throw new AppError("INTROUVABLE", "Numéro inconnu.", 404);

  const maxJour = await lireRegle("code_demandes_max_jour", 5);
  const compte = await requete<{ n: number }>(
    "select count(*)::int as n from codes_verification where donneur_id = $1 and cree_le > now() - interval '1 day'",
    [rows[0].id],
  );
  if (compte.rows[0].n >= maxJour) {
    throw new AppError("TROP_DE_TENTATIVES", "Trop de demandes aujourd'hui. Réessayez demain.", 429);
  }

  const usage = d.objet === "mot_de_passe" ? "mot_de_passe" : "verification_numero";
  const { code, expireDans } = await creerCode(rows[0].id, usage);
  await envoyerCodeWhatsApp(d.telephone, code, d.objet);

  res.json({ donnees: { telephone: d.telephone, canal: "whatsapp", expireDans, renvoiPossibleDans: RENVOI_POSSIBLE_DANS } });
});

// D6 — mot de passe oublié
routeAuth.post("/mot-de-passe-oublie", async (req, res) => {
  const d = valider(schemaMotDePasseOublie, req.body);
  const { rows } = await requete<{ id: string }>("select id from donneurs where telephone = $1 and actif", [d.telephone]);
  const expireDans = (await lireRegle("code_validite_minutes", 10)) * 60;

  // Réponse identique que le numéro soit inscrit ou non : on ne révèle pas qui est inscrit.
  if (rows[0]) {
    const { code } = await creerCode(rows[0].id, "mot_de_passe");
    await envoyerCodeWhatsApp(d.telephone, code, "mot_de_passe");
  }

  res.json({ donnees: { telephone: d.telephone, canal: "whatsapp", expireDans, renvoiPossibleDans: RENVOI_POSSIBLE_DANS } });
});

// D7 — nouveau mot de passe (après code reçu)
routeAuth.post("/nouveau-mot-de-passe", async (req, res) => {
  const d = valider(schemaNouveauMotDePasse, req.body);
  const { rows } = await requete<{ id: string }>("select id from donneurs where telephone = $1 and actif", [d.telephone]);
  if (!rows[0]) throw new AppError("INTROUVABLE", "Numéro inconnu.", 404);

  const { rows: codes } = await requete<LigneCode>(
    `select id, code, expiration, nombre_essais, utilise from codes_verification
     where donneur_id = $1 and usage = 'mot_de_passe' and not utilise
     order by cree_le desc limit 1`,
    [rows[0].id],
  );
  if (!codes[0]) throw new AppError("CODE_EXPIRE", "Aucun code en attente.", 400);
  const code = codes[0];

  const essaisMax = await lireRegle("code_essais_max", 5);
  if (code.nombre_essais >= essaisMax) {
    throw new AppError("TROP_DE_TENTATIVES", "Trop de tentatives. Redemandez un code.", 429);
  }
  if (new Date(code.expiration) < new Date()) {
    throw new AppError("CODE_EXPIRE", "Le code a expiré.", 400);
  }
  if (!(await verifier(d.code, code.code))) {
    await requete("update codes_verification set nombre_essais = nombre_essais + 1 where id = $1", [code.id]);
    throw new AppError("CODE_INCORRECT", "Code incorrect.", 400, "code");
  }

  const hash = await hacher(d.motDePasse);
  await transaction(async (client) => {
    await client.query("update codes_verification set utilise = true where id = $1", [code.id]);
    await client.query("update donneurs set mot_de_passe = $1, doit_changer_mot_de_passe = false where id = $2", [hash, rows[0].id]);
  });

  // TODO (prototype) : invalider les sessions ouvertes — requiert un versionnage de jeton.
  res.json({ donnees: null });
});

// ---------------------------------------------------------------------
// Routes — plateforme (agent / administrateur)
// ---------------------------------------------------------------------

// Connexion d'un agent (e-mail + mot de passe) — Annexe C
routeAuth.post("/agent/connexion", async (req, res) => {
  const d = valider(schemaAgentConnexion, req.body);
  // Le nom du site est joint dès la connexion : l'en-tête de la plateforme
  // affiche « Centre de transfusion … » sans un second aller-retour réseau.
  const { rows } = await requete<{
    id: string; nom: string; prenom: string; email: string; mot_de_passe: string;
    actif: boolean; site_id: string; site_nom: string | null;
  }>(
    `select u.id, u.nom, u.prenom, u.email, u.mot_de_passe, u.actif, u.site_id,
            s.nom as site_nom
       from utilisateurs u
       left join sites s on s.id = u.site_id
      where u.email = $1`,
    [d.email],
  );
  const agent = rows[0];
  if (!agent || !agent.actif || !(await verifier(d.motDePasse, agent.mot_de_passe))) {
    throw new AppError("IDENTIFIANTS_INVALIDES", "E-mail ou mot de passe incorrect.", 401);
  }

  const { rows: r } = await requete<{ role: string }>("select role from utilisateur_roles where utilisateur_id = $1", [agent.id]);
  const roles = r.map((x) => x.role) as Role[];

  const jeton = signerJeton({ id: agent.id, type: "agent", roles, siteId: agent.site_id });
  res.json({
    donnees: {
      jeton,
      utilisateur: {
        id: agent.id, nomComplet: `${agent.nom} ${agent.prenom}`, email: agent.email,
        roles, siteId: agent.site_id, siteNom: agent.site_nom ?? undefined,
      },
    },
  });
});
