import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { query, connectPostgres } from "../src/db/postgres.js";

dotenv.config();

async function insertUser(name, email, password, emailVerified = true) {
  const hashed = await bcrypt.hash(password, 10);
  const res = await query(
    `INSERT INTO users (name, email, password, email_verified)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, email, hashed, emailVerified]
  );
  return res.rows[0].id;
}

async function insertDocument(title, content, isPublic, ownerId) {
  const res = await query(
    `INSERT INTO documents (title, content, is_public, owner_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [title, content, isPublic, ownerId]
  );
  return res.rows[0].id;
}

async function addShare(documentId, userId, permission = "EDIT") {
  await query(
    `INSERT INTO shares (document_id, user_id, permission)
     VALUES ($1, $2, $3)
     ON CONFLICT (document_id, user_id) DO UPDATE SET permission = EXCLUDED.permission`,
    [documentId, userId, permission]
  );
}

async function run() {
  try {
    await connectPostgres();

    // Ensure serial sequences are aligned with current max ids to avoid duplicate PK errors
    const seqTables = [
      "users",
      "documents",
      "sections",
      "comments",
      "shares",
      "collaboration_invitations"
    ];

    for (const tbl of seqTables) {
      // Use pg_get_serial_sequence to find the sequence name for the table's id column.
      // If the table has no serial sequence this will return null and we skip.
      try {
        await query(
          `DO $$\n          DECLARE seq TEXT; maxid BIGINT;\n          BEGIN\n            seq := pg_get_serial_sequence($1, 'id');\n            IF seq IS NOT NULL THEN\n              EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM %I', $1) INTO maxid;\n              PERFORM setval(seq, maxid, true);\n            END IF;\n          END$$;`,
          [tbl]
        );
      } catch (e) {
        // ignore sequence adjustment errors for non-serial tables
      }
    }

    // Make the seed idempotent by removing any previous seeded users
    const seedEmails = [
      "alice@example.com",
      "bob@example.com",
      "carol@example.com",
      "dave@example.com"
    ];
    await query(`DELETE FROM users WHERE email = ANY($1)`, [seedEmails]);

    // Create users
    const aliceId = await insertUser("Alice", "alice@example.com", "password123", true);
    const bobId = await insertUser("Bob", "bob@example.com", "password123", true);
    const carolId = await insertUser("Carol", "carol@example.com", "password123", true);
    const daveId = await insertUser("Dave", "dave@example.com", "password123", false);

    // Create 15 documents with varying visibility, owners and content
    const owners = [aliceId, bobId, carolId, daveId];
    const createdDocIds = [];

    for (let i = 1; i <= 15; i += 1) {
      const owner = owners[(i - 1) % owners.length];
      const title = `Sample Document ${i}`;
      const isPublic = i % 3 === 0; // every 3rd doc is public
      const content = `Sample Document ${i} owned by user ${owner}.\n\nThis document contains example paragraphs, bullet lists, and small structured content for testing the editor and search.`;

      const docId = await insertDocument(title, content, isPublic, owner);
      createdDocIds.push(docId);

      // Insert a section with structured JSON content
      const sectionContentDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: `Overview for ${title}` }]
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: `Details: This is a seeded paragraph for ${title}.` }]
          }
        ]
      };

      await query(
        `INSERT INTO sections (document_id, title, content, content_doc, parent_id, order_index, type)
         VALUES ($1, $2, $3, $4::jsonb, NULL, 0, $5)`,
        [docId, "Overview", content.split("\n")[0], JSON.stringify(sectionContentDoc), "notes"]
      );

      // Add a version snapshot for some documents
      if (i % 5 === 0) {
        await query(
          `INSERT INTO versions (document_id, snapshot, created_by)
           VALUES ($1, $2::jsonb, $3)`,
          [docId, JSON.stringify({ title, content: `Initial snapshot for ${title}` }), owner]
        );
      }

      // Add collaborators deterministically for certain docs
      if (i % 4 === 0) {
        // grant EDIT to the next owner in rotation
        const collaborator = owners[(i % owners.length)];
        if (String(collaborator) !== String(owner)) {
          await addShare(docId, collaborator, "EDIT");
        }
      }

      if (i % 6 === 0) {
        // grant VIEW to alice for every 6th doc (if not owner)
        if (String(aliceId) !== String(owner)) {
          await addShare(docId, aliceId, "VIEW");
        }
      }
    }

    // Summary output
    // eslint-disable-next-line no-console
    console.log("Seed data inserted:");
    // eslint-disable-next-line no-console
    console.log(`- Users: Alice(${aliceId}), Bob(${bobId}), Carol(${carolId}), Dave(${daveId})`);
    // eslint-disable-next-line no-console
    console.log(`- Documents created: ${createdDocIds.length} (IDs: ${createdDocIds.join(", ")})`);

    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Seeding failed:", err.message || err);
    process.exit(1);
  }
}

run();
