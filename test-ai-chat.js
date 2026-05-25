const supabaseUrl = "https://qlwqktnziuqeosbnhnls.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsd3FrdG56aXVxZW9zYm5obmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMjY3NDksImV4cCI6MjA5MjcwMjc0OX0.gLG469T4onUm4sTvXdDlz_gy1eOhJ2AMWcwOD23yqjA";

async function test() {
  const res = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'test message' }],
      context: { userId: 'test-user', transactions: [], accounts: [] }
    })
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}

test();
