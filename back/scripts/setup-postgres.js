import dotenv from "dotenv";
import { Client, Pool } from "pg";
import { ensureSchema } from "../src/db/schema.js";

dotenv.config();

function fail(message) {
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(1);
}

function escapeIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function parseDatabaseName(connectionString) {
  try {
    const parsed = new URL(connectionString);
    const dbName = parsed.pathname.replace(/^\//, "");
    return dbName || null;
  } catch {
    return null;
  }
}

function toAdminConnectionString(connectionString, override) {
  if (override) {
    return override;
  }

  const parsed = new URL(connectionString);
  parsed.pathname = "/postgres";
  return parsed.toString();
}

async function createDatabaseIfMissing() {
  const appConnectionString = process.env.POSTGRES_URI;
  if (!appConnectionString) {
    fail("Missing required environment variable: POSTGRES_URI");
  }

  const dbName = parseDatabaseName(appConnectionString);
  if (!dbName) {
    fail("POSTGRES_URI must include a database name, e.g. .../syncnote");
  }

  const adminConnectionString = toAdminConnectionString(
    appConnectionString,
    process.env.POSTGRES_ADMIN_URI
  );

  const adminClient = new Client({ connectionString: adminConnectionString });

  try {
    await adminClient.connect();

    const existsResult = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (!existsResult.rowCount) {
      await adminClient.query(
        `CREATE DATABASE ${escapeIdentifier(dbName)} ENCODING 'UTF8'`
      );
      // eslint-disable-next-line no-console
      console.log(`Created database: ${dbName}`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`Database already exists: ${dbName}`);
    }
  } finally {
    await adminClient.end();
  }

  const appPool = new Pool({ connectionString: appConnectionString });

  try {
    await ensureSchema((text, params = []) => appPool.query(text, params));
    // eslint-disable-next-line no-console
    console.log("Schema is ready");
  } finally {
    await appPool.end();
  }
}

createDatabaseIfMissing().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to set up PostgreSQL", error.message);
  process.exit(1);
});
