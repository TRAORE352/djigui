/**
 * Petit client SQL de diagnostic pour la base de production.
 * Lit DATABASE_URL dans backend/.env — ne l'affiche jamais.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync(new URL("../../backend/.env", import.meta.url), "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, "");

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const sql = process.argv[2] ?? "select 1 as ok";
const { rows } = await client.query(sql);
console.log(JSON.stringify(rows, null, 2));
await client.end();
