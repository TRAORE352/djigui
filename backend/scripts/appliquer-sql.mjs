/**
 * Applique un fichier .sql à la base de production (DATABASE_URL de backend/.env).
 * Usage : node backend/scripts/appliquer-sql.mjs supabase/seed/demo-donneur.sql
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync(new URL("../../backend/.env", import.meta.url), "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, "");

const fichier = process.argv[2];
if (!fichier) {
  console.error("Usage : node backend/scripts/appliquer-sql.mjs <fichier.sql>");
  process.exit(1);
}

const sql = readFileSync(fichier, "utf8");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const res = await client.query(sql);
  const dernier = Array.isArray(res) ? res.at(-1) : res;
  console.log(JSON.stringify(dernier?.rows ?? [], null, 2));
} finally {
  await client.end();
}
