import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await client.connect();
    const res = await client.query('SELECT id FROM profiles LIMIT 1');
    if (res.rows.length > 0) {
      console.log(`VALID_USER_ID=${res.rows[0].id}`);
    } else {
      console.log('No users found in profiles table');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
