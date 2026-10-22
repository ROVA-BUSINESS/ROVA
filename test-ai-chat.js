const supabaseUrl = "https://qlwqktnziuqeosbnhnls.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsd3FrdG56aXVxZW9zYm5obmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMjY3NDksImV4cCI6MjA5MjcwMjc0OX0.gLG469T4onUm4sTvXdDlz_gy1eOhJ2AMWcwOD23yqjA";

async function getRealUserId() {
  const res = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
    }
  });
  const data = await res.json();
  return data?.[0]?.id || null;
}

async function test() {
  console.log("Looking up a real user ID from Supabase...");
  const userId = await getRealUserId();
  
  if (!userId) {
    console.log("❌ No user found. Make sure the app has at least one registered user.");
    return;
  }
  console.log("✅ Using userId:", userId);

  const res = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'How much revenue and profit did my business generate this month?' }],
      context: { userId, transactions: [], accounts: [] }
    })
  });
  
  const text = await res.text();
  console.log("\nStatus:", res.status);
  console.log("Response:", text);
}

test();

