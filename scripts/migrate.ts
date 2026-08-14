import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
await sql.query(`create table if not exists schema_migrations(version text primary key, applied_at timestamptz not null default now())`);
const directory = resolve("db/migrations");
const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
for (const file of files) {
  const existing = await sql.query(`select version from schema_migrations where version=$1`, [file]);
  if (existing.length) continue;
  await sql.query(await readFile(resolve(directory, file), "utf8"));
  await sql.query(`insert into schema_migrations(version) values($1) on conflict do nothing`, [file]);
  console.log(`Applied ${file}`);
}
console.log(`Archic Control schema is current (${files.length} migration files).`);
