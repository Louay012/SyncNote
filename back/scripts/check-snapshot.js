import dotenv from "dotenv";
import { query as dbQuery } from "../src/db/postgres.js";
import { env } from "../src/config/env.js";

dotenv.config();

(async () => {
  try {
    const docId = process.argv[2] || "2";
    const { rows } = await dbQuery(
      `SELECT snapshot, octet_length(snapshot) as len FROM document_snapshots WHERE document_id = $1`,
      [docId]
    );
    if (!rows || rows.length === 0) {
      console.log(`no snapshot row found for document ${docId}`);
      process.exit(0);
    }
    const row = rows[0];
    console.log(`document ${docId} snapshot length:`, row.len || (row.snapshot ? row.snapshot.length : null));
    if (row.len && row.len > 0) {
      console.log("snapshot appears present in DB");
    } else {
      console.log("snapshot is empty or null");
    }
  } catch (e) {
    console.error("check-snapshot error", e);
    process.exit(2);
  }
})();
