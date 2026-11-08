/**
 * Pose des cas EN ATTENTE pour que l'espace agent soit visualisable.
 *
 * Sans cela, le tableau de bord de l'agent affiche zéro partout : les
 * données existent en base mais tout est déjà traité, donc la file de
 * travail est vide et l'écran ne montre rien. Une fonctionnalité qu'on ne
 * peut atteindre que par des données absentes est invisible à qui visite.
 *
 * Ce que l'on crée, en réutilisant les donneurs déjà présents :
 *   · 3 poches fraîchement prélevées -> « poches à qualifier » au labo ;
 *   · 1 demande de dépôt en attente  -> « demandes à préparer ».
 *
 * Les codes portent le préfixe DEMO- : ils sont reconnaissables d'un coup
 * d'œil et le script de retrait sait exactement quoi enlever. Idempotent :
 * on peut le relancer, il ne crée pas de doublons.
 */
import "dotenv/config";
import pg from "pg";

const PREFIXE = "DEMO-";
const NB_POCHES = 3;

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query("begin");

  const { rows: sites } = await client.query(
    "select id, nom from sites where type = 'centre' order by nom limit 1");
  if (!sites.length) throw new Error("aucun site de type 'centre'");
  const site = sites[0];

  const { rows: depots } = await client.query(
    "select id, nom from sites where type = 'depot' order by nom limit 1");

  const { rows: agents } = await client.query(
    "select id from utilisateurs where email = 'demo.agent@djigui.bf'");
  if (!agents.length) throw new Error("compte demo.agent absent : lancer d'abord creer-comptes-demo.mjs");
  const agent = agents[0];

  const { rows: donneurs } = await client.query(
    "select id from donneurs where actif order by cree_le limit $1", [NB_POCHES]);
  if (donneurs.length < NB_POCHES) throw new Error(`${donneurs.length} donneur(s) seulement en base`);

  // --- Poches prélevées, en attente du laboratoire --------------------
  let posees = 0;
  for (let i = 0; i < NB_POCHES; i++) {
    const code = `${PREFIXE}${String(i + 1).padStart(3, "0")}`;
    const { rows: deja } = await client.query("select id from poches where code = $1", [code]);
    if (deja.length) {
      // Remettre la poche en attente : c'est l'état que l'on veut montrer.
      await client.query("update poches set statut = 'prelevee' where id = $1", [deja[0].id]);
      continue;
    }
    const { rows: passage } = await client.query(
      `insert into passages (donneur_id, site_id, agent_id, resultat)
       values ($1, $2, $3, 'apte') returning id`,
      [donneurs[i].id, site.id, agent.id]);
    await client.query(
      `insert into poches (code, donneur_id, passage_id, site_id, volume, statut)
       values ($1, $2, $3, $4, 450, 'prelevee')`,
      [code, donneurs[i].id, passage[0].id, site.id]);
    posees++;
  }
  console.log(`  poches en attente de qualification : ${NB_POCHES} (dont ${posees} créée(s))`);

  // --- Une demande de dépôt en attente --------------------------------
  if (depots.length) {
    const { rows: d } = await client.query(
      "select id from demandes where statut = 'en_attente' limit 1");
    if (!d.length) {
      await client.query(
        `insert into demandes (site_demandeur_id, site_fournisseur_id, agent_id, statut, urgence)
         values ($1, $2, $3, 'en_attente', 'normale')`,
        [depots[0].id, site.id, agent.id]);
      console.log(`  demande en attente créée (${depots[0].nom})`);
    } else {
      console.log("  une demande en attente existe déjà");
    }
  }

  await client.query("commit");

  // Relecture : un commit sans erreur ne prouve pas l'état attendu.
  const { rows: v } = await client.query(
    `select (select count(*) from poches where statut = 'prelevee') as a_qualifier,
            (select count(*) from demandes where statut = 'en_attente') as demandes`);
  console.log(`\nRelecture : ${v[0].a_qualifier} poche(s) à qualifier, ${v[0].demandes} demande(s) en attente`);
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("ÉCHEC, rien n'a été écrit :", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
