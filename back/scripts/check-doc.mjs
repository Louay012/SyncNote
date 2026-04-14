import dotenv from 'dotenv';
import { Client } from 'pg';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run(id = 2) {
  const client = new Client({ connectionString: process.env.POSTGRES_URI });
  await client.connect();
  const res = await client.query('SELECT id, title, is_public, owner_id FROM documents WHERE id = $1', [id]);
  console.log('rows:', res.rows);
  await client.end();
}

run(process.argv[2] || 2).catch(err => { console.error(err.message); process.exit(1); });
