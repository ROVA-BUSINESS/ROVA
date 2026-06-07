import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("\x1b[31mError: DATABASE_URL is not set in your .env file.\x1b[0m");
  console.log("\nPlease add your Database Connection String to your .env file:");
  console.log("DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@db.qlwqktnziuqeosbnhnls.supabase.co:5432/postgres");
  console.log("\n(You can find this in your Supabase Dashboard under Settings > Database > Connection string > URI)\n");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
});

async function run() {
  try {
    await client.connect();
    console.log("\x1b[32mConnected to Supabase PostgreSQL database successfully!\x1b[0m");

    // Create a table to track applied migrations if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files in supabase/migrations.\n`);

    for (const file of files) {
      // Check if migration has already been applied
      const res = await client.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
      if (res.rows.length > 0) {
        console.log(`Skipping: ${file} (already applied)`);
        continue;
      }

      console.log(`Applying: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      // Begin transaction
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`\x1b[32m  └─ Successfully applied ${file}\x1b[0m`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`\x1b[31m  └─ Error applying migration ${file}:\x1b[0m`, err.message);
        throw err;
      }
    }

    console.log("\n\x1b[32mAll migrations synced successfully to the live database!\x1b[0m");
  } catch (err) {
    console.error("\n\x1b[31mMigration process failed:\x1b[0m", err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await client.end();
  }
}

run();
