import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || 'https://qlwqktnziuqeosbnhnls.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsd3FrdG56aXVxZW9zYm5obmxzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEyNjc0OSwiZXhwIjoyMDkyNzAyNzQ5fQ.GsPyA-kk8jLyJo6uJX3G2AVIQZxLsCoLDON_UrP2o5A';

const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20260911200000_add_receipts_system.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function run() {
  console.log("Attempting SQL execution via Supabase API...");
  
  // Try Supabase Management API endpoint / pg endpoint
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ query: sql })
  });

  console.log("RPC Status:", res.status);
  const text = await res.text();
  console.log("RPC Response:", text);
}

run();
