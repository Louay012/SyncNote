import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaSqlPath = path.join(__dirname, "schema.sql");

export async function loadSchemaSql() {
  return readFile(schemaSqlPath, "utf8");
}

export async function ensureSchema(runQuery) {
  const schemaSql = await loadSchemaSql();
  await runQuery(schemaSql);
}
