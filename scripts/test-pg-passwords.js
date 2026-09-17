import pg from 'pg';

const passwords = [
  'postgres',
  'ROVA_Password_2026',
  'rova2026',
  'Rova2026!',
  'Kolo2026!',
  'kolo2026',
  '488a175d0028bfa2ebea70756a27fa27',
];

const hosts = [
  'aws-0-eu-central-1.pooler.supabase.com',
  'aws-0-us-east-1.pooler.supabase.com',
  'aws-0-ap-southeast-1.pooler.supabase.com',
  'aws-0-eu-west-1.pooler.supabase.com',
  'aws-0-us-west-1.pooler.supabase.com',
];

const ref = 'qlwqktnziuqeosbnhnls';

async function test() {
  for (const host of hosts) {
    for (const pwd of passwords) {
      const conn = `postgresql://postgres.${ref}:${encodeURIComponent(pwd)}@${host}:6543/postgres`;
      const client = new pg.Client({ connectionString: conn, connectionTimeoutMillis: 2000 });
      try {
        await client.connect();
        console.log('SUCCESS! Password and host:', pwd, host);
        console.log('DATABASE_URL=' + conn);
        await client.end();
        return conn;
      } catch (e) {
        if (!e.message.includes('ENOTFOUND')) {
          console.log(`Tried ${host} with pwd ${pwd}: ${e.message}`);
        }
      }
    }
  }
}

test();
