import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || 'https://qlwqktnziuqeosbnhnls.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsd3FrdG56aXVxZW9zYm5obmxzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEyNjc0OSwiZXhwIjoyMDkyNzAyNzQ5fQ.GsPyA-kk8jLyJo6uJX3G2AVIQZxLsCoLDON_UrP2o5A';

async function run() {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  const data = await res.json();
  console.log("OpenAPI paths:", Object.keys(data.paths || {}).filter(p => p.startsWith('/rpc/')));
}

run();
