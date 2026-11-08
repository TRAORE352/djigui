/**
 * Crée (ou remet à l'état connu) les deux comptes de DÉMONSTRATION qui
 * permettent de visualiser les deux espaces professionnels.
 *
 *   demo.agent@djigui.bf  → tous les rôles d'agent, pour parcourir l'espace
 *                           agent en entier (accueil, labo, stock, dépôt).
 *   demo.cnts@djigui.bf   → administrateur, pour l'espace CNTS.
 *
 * Deux choix délibérés :
 *
 * 1. Ces comptes sont DISTINCTS des comptes de test existants
 *    (accueil@, labo@, stock@, admin@). Un script de démonstration ne doit
 *    jamais changer le mot de passe d'un compte dont un test dépend : la
 *    suite suivante échouerait à la connexion et l'on diagnostiquerait une
 *    panne du produit là où il n'y a qu'un effet de bord du harnais.
 *
 * 2. Le script est IDEMPOTENT (`on conflict ... do update`) : on peut le
 *    relancer autant de fois que nécessaire pour remettre les comptes dans
 *    un état connu, sans jamais en créer de doublons.
 *
 * Le mot de passe est reçu par l'environnement (MDP_DEMO) et n'est jamais
 * écrit dans le dépôt.
 */
import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const MDP = process.env.MDP_DEMO;
if (!MDP) {
  console.error("MDP_DEMO manquant : relancer avec MDP_DEMO='...' node creer-comptes-demo.mjs");
  process.exit(1);
}

const COMPTES = [
  {
    email: "demo.agent@djigui.bf",
    prenom: "Awa",
    nom: "Compaoré",
    telephone: "+22670000001",
    // Tous les rôles d'agent : l'espace agent se visite alors en entier.
    roles: ["agent_accueil", "agent_prelevement", "agent_labo", "agent_stock", "agent_depot"],
    site: "centre",
  },
  {
    email: "demo.cnts@djigui.bf",
    prenom: "Issa",
    nom: "Ouédraogo",
    telephone: "+22670000002",
    roles: ["admin"],
    site: "centre",
  },
];

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query("begin");

  const { rows: sites } = await client.query(
    "select id, nom from sites where type = 'centre' order by nom limit 1",
  );
  if (!sites.length) throw new Error("Aucun site de type 'centre' en base.");
  const site = sites[0];

  const hash = await bcrypt.hash(MDP, 10);

  for (const c of COMPTES) {
    const { rows } = await client.query(
      `insert into utilisateurs (nom, prenom, email, telephone, mot_de_passe, site_id, actif)
       values ($1, $2, $3, $4, $5, $6, true)
       on conflict (email) do update
         set mot_de_passe = excluded.mot_de_passe,
             nom = excluded.nom, prenom = excluded.prenom,
             telephone = excluded.telephone, actif = true
       returning id`,
      [c.nom, c.prenom, c.email, c.telephone, hash, site.id],
    );
    const id = rows[0].id;

    // Les rôles sont remplacés, pas ajoutés : relancer le script ne doit
    // pas laisser traîner un rôle d'une version précédente.
    await client.query("delete from utilisateur_roles where utilisateur_id = $1", [id]);
    for (const role of c.roles) {
      await client.query(
        "insert into utilisateur_roles (utilisateur_id, role) values ($1, $2)",
        [id, role],
      );
    }
    console.log(`  ${c.email.padEnd(24)} ${c.prenom} ${c.nom} · ${c.roles.join(", ")}`);
  }

  await client.query("commit");
  console.log(`\nSite de rattachement : ${site.nom}`);

  // On RELIT depuis la base : un `commit` sans erreur ne prouve pas que les
  // lignes sont là avec les bons rôles.
  const { rows: verif } = await client.query(
    `select u.email, u.actif,
            coalesce(array_agg(r.role order by r.role) filter (where r.role is not null), '{}') as roles
       from utilisateurs u
       left join utilisateur_roles r on r.utilisateur_id = u.id
      where u.email = any($1) group by u.id order by u.email`,
    [COMPTES.map((c) => c.email)],
  );
  console.log("\nRelecture en base :");
  for (const v of verif) {
    console.log(`  ${v.email.padEnd(24)} actif=${v.actif} roles=${v.roles.join(",")}`);
  }
  if (verif.length !== COMPTES.length) {
    throw new Error(`${verif.length} compte(s) relu(s) pour ${COMPTES.length} attendu(s)`);
  }
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("ÉCHEC, rien n'a été écrit :", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
