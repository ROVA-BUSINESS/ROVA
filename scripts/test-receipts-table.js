import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || 'https://qlwqktnziuqeosbnhnls.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsd3FrdG56aXVxZW9zYm5obmxzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEyNjc0OSwiZXhwIjoyMDkyNzAyNzQ5fQ.GsPyA-kk8jLyJo6uJX3G2AVIQZxLsCoLDON_UrP2o5A';

const supabase = createClient(url, serviceKey);

async function test() {
  const { data, error } = await supabase.from('receipts').select('*').limit(1);
  console.log('Receipts Table Test Result:');
  console.log('Data:', data);
  console.log('Error:', error);
}

test();
