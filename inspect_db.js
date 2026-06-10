import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to DB!");
    
    console.log("\n--- RECENT TRANSACTIONS ---");
    const txs = await client.query(`
      SELECT id, description, notes, category_id, type, amount, date 
      FROM transactions 
      ORDER BY date DESC, created_at DESC 
      LIMIT 5
    `);
    console.log(JSON.stringify(txs.rows, null, 2));

    console.log("\n--- RECENT CLARIFICATIONS ---");
    const clars = await client.query(`
      SELECT id, transaction_id, original_description, status, suggested_intent, ai_question, resolved_at 
      FROM ai_pending_clarifications 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.log(JSON.stringify(clars.rows, null, 2));

  } catch (err) {
    console.error("Error connecting or querying:", err);
  } finally {
    await client.end();
  }
}

run();
