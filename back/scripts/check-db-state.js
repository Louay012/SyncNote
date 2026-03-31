import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config();

async function run() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URI
  });

  await client.connect();

  const tablesResult = await client.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
  );

  const columnsResult = await client.query(
    `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('comments', 'sections', 'versions')
      ORDER BY table_name, ordinal_position
    `
  );

  console.log("Connected database:", new URL(process.env.POSTGRES_URI).pathname.replace("/", ""));
  console.log("Public tables:", tablesResult.rows.map((row) => row.table_name).join(", "));
  console.log("Total public tables:", tablesResult.rowCount);

  console.log("\nKey columns check:");
  for (const row of columnsResult.rows) {
    console.log(`- ${row.table_name}.${row.column_name}`);
  }

  await client.end();
}

run().catch((error) => {
  console.error("DB check failed:", error.message);
  process.exit(1);
});
