import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(resolve("db/migrations/001_initial_control_plane.sql"), "utf8");
await sql.query(migration);
console.log("Archic Control schema is current.");

