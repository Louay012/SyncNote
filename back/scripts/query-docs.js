import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config();

async function run() {
  const client = new Client({ connectionString: process.env.POSTGRES_URI });
  try {
    await client.connect();

    const docIds = [4, 5, 6, 7];

    const docsRes = await client.query(
      `SELECT id, title, content, is_public, owner_id FROM documents WHERE id = ANY($1::bigint[]) ORDER BY id`,
      [docIds]
    );
    console.log("Documents:", docsRes.rows);

    const sharesRes = await client.query(
      `SELECT id, document_id, user_id, permission FROM shares WHERE document_id = ANY($1::bigint[]) ORDER BY document_id`,
      [docIds]
    );
    console.log("Shares:", sharesRes.rows);

    const sectionsRes = await client.query(
      `SELECT id, document_id, title, content, content_doc, type FROM sections WHERE document_id = ANY($1::bigint[]) ORDER BY document_id, id`,
      [docIds]
    );
    console.log("Sections:", sectionsRes.rows);

    const versionsRes = await client.query(
      `SELECT id, document_id, created_by, snapshot FROM versions WHERE document_id = ANY($1::bigint[]) ORDER BY document_id`,
      [docIds]
    );
    console.log("Versions:", versionsRes.rows);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("Query failed:", err.message || err);
  process.exit(1);
});
