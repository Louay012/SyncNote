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

    // Create documents (some public, some private)
    const publicDocId = await insertDocument(
      "Public Notes",
      "This is a public document. Feel free to read and share.",
      true,
      aliceId
    );

    const teamPlanId = await insertDocument(
      "Team Plan",
      "Team plan for Q2: goals, milestones, responsibilities.",
      false,
      bobId
    );

    const roadmapId = await insertDocument(
      "Project Roadmap",
      "Roadmap: milestones and checkpoints for the upcoming release.",
      true,
      carolId
    );

    const privateDiaryId = await insertDocument(
      "Private Diary",
      "Personal notes and drafts (private).",
      false,
      daveId
    );

    // Add collaborators (shares)
    await addShare(teamPlanId, aliceId, "EDIT");
    await addShare(teamPlanId, carolId, "VIEW");

    await addShare(roadmapId, bobId, "EDIT");
    await addShare(publicDocId, bobId, "VIEW");

    // Optionally: add a section with structured JSON content for one doc
    const contentDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Structured section content for Team Plan." }]
        }
      ]
    };

    await query(
      `INSERT INTO sections (document_id, title, content, content_doc, parent_id, order_index, type)
       VALUES ($1, $2, $3, $4::jsonb, NULL, 0, $5)`,
      [teamPlanId, "Overview", "Team plan overview", JSON.stringify(contentDoc), "notes"]
    );

    // Create a version snapshot for one document
    await query(
      `INSERT INTO versions (document_id, snapshot, created_by)
       VALUES ($1, $2::jsonb, $3)`,
      [publicDocId, JSON.stringify({ title: "Public Notes", content: "Initial snapshot" }), aliceId]
    );

    // Summary output
    // eslint-disable-next-line no-console
    console.log("Seed data inserted:");
    // eslint-disable-next-line no-console
    console.log(`- Users: Alice(${aliceId}), Bob(${bobId}), Carol(${carolId}), Dave(${daveId})`);
    // eslint-disable-next-line no-console
    console.log(`- Documents: public(${publicDocId}), team(${teamPlanId}), roadmap(${roadmapId}), private(${privateDiaryId})`);

    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Seeding failed:", err.message || err);
    process.exit(1);
  }
}

run();
