import pg from "pg";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { config } from "../config.js";

/**
 * Accès direct à PostgreSQL (Supabase), en SQL écrit à la main — sans ORM,
 * conformément à l'Annexe B du cahier des charges.
 */
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  /*
   * Sans ces trois délais, une seule connexion cassée bloque toute
   * l'application : les places du pool ne sont jamais rendues, et le
   * `pool.connect()` suivant attend INDÉFINIMENT. Côté navigateur, la
   * requête ne répond jamais — l'agent reste devant un écran de
   * chargement sans fin, sans message d'erreur.
   *
   * Avec un délai, l'attente devient une erreur franche que le
   * middleware d'erreurs transforme en 503 : l'écran peut enfin dire
   * « le serveur ne répond pas » et proposer de réessayer.
   */
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  // Neon ferme les connexions inactives de son côté ; une requête qui
  // dépasse ce délai est de toute façon perdue pour l'utilisateur.
  statement_timeout: 20_000,
});

/*
 * Une connexion au repos peut mourir sans qu'aucune requête soit en
 * cours (coupure réseau, redémarrage côté Neon). `pg` émet alors
 * `error` sur le pool : sans écouteur, Node considère l'exception comme
 * non gérée et TUE le processus. On journalise et on laisse le pool
 * recréer la connexion au besoin.
 */
pool.on("error", (err) => {
  console.error("[db] connexion au repos perdue :", err.message);
});

/** Requête simple (pas de transaction). */
export function requete<R extends QueryResultRow = QueryResultRow>(
  texte: string,
  params: unknown[] = [],
): Promise<QueryResult<R>> {
  return pool.query<R>(texte, params);
}

/**
 * Exécute `fn` dans une transaction. Tout échec provoque un rollback,
 * sinon commit. Le client est toujours relâché dans le pool.
 */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const resultat = await fn(client);
    await client.query("commit");
    return resultat;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
