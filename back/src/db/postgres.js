import { Pool } from "pg";
import { env } from "../config/env.js";
import { ensureSchema } from "./schema.js";

const pool = new Pool({
  connectionString: env.postgresUri
});

export async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result;
}

export async function connectPostgres() {
  await ensureSchema(query);

  // eslint-disable-next-line no-console
  console.log("PostgreSQL connected");
}
