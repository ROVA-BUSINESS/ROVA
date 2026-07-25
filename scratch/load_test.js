import dotenv from 'dotenv';
dotenv.config();

const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const localUrl = 'http://localhost:54321/functions/v1/ai-chat';
const liveUrl = `${VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const type = process.argv[2] === 'live' ? 'live' : 'local';
const targetUrl = type === 'live' ? liveUrl : localUrl;

console.log(`========================================`);
console.log(`ROVA LOAD TEST - TARGETING: ${type.toUpperCase()}`);
console.log(`URL: ${targetUrl}`);
console.log(`========================================\n`);

const payload = {
  messages: [{ role: 'user', content: 'Hi' }],
  context: {
    userId: '4118d3cb-035c-4fb6-a699-cebadf059156', // valid database test uuid
    transactions: [],
    accounts: [],
    inventoryItems: []
  }
};

async function sendRequest(id) {
  const start = Date.now();
  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(payload)
    });
    const status = res.status;
    const duration = Date.now() - start;
    let data;
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { id, status, duration, error: data.error || null };
  } catch (err) {
    return { id, status: 'FAILED', duration: Date.now() - start, error: err.message };
  }
}

async function run() {
  const requests = [];
  const concurrency = 20; // 15 is the rate limit ceiling per minute, so 20 will trigger limits!
  
  console.log(`Sending ${concurrency} parallel requests concurrently...`);
  
  for (let i = 1; i <= concurrency; i++) {
    requests.push(sendRequest(i));
  }
  
  const results = await Promise.all(requests);
  
  let successCount = 0;
  let rateLimitedCount = 0;
  let failedCount = 0;
  let totalDuration = 0;

  results.forEach(r => {
    totalDuration += r.duration;
    if (r.status === 200) {
      successCount++;
    } else if (r.status === 429) {
      rateLimitedCount++;
    } else {
      failedCount++;
    }
    
    const limitTag = r.status === 429 ? ' [RATE LIMITED 🛑]' : '';
    const errorTag = r.error ? ` | Error: ${r.error}` : '';
    console.log(`Request #${String(r.id).padStart(2, '0')} -> Status: ${r.status}${limitTag} | Latency: ${r.duration}ms${errorTag}`);
  });

  console.log(`\n========================================`);
  console.log(`LOAD TEST SUMMARY`);
  console.log(`========================================`);
  console.log(`Total Requests Sent: ${concurrency}`);
  console.log(`Success (200 OK):    ${successCount}`);
  console.log(`Blocked (429 Limit): ${rateLimitedCount}`);
  console.log(`Failed / Errors:     ${failedCount}`);
  console.log(`Average Latency:     ${Math.round(totalDuration / concurrency)}ms`);
  console.log(`========================================`);
}

run();
