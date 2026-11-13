import fs from 'fs';
import path from 'path';

const dir = 'taxes html';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

console.log('=== LIRS PORTAL SNAPSHOT ANALYSIS ===');
for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const forms = (content.match(/<form/gi) || []).length;
  const inputs = (content.match(/<input/gi) || []).length;
  const buttons = (content.match(/<button/gi) || []).length;
  const selects = (content.match(/<select/gi) || []).length;
  
  // Extract modal / form headers
  const headings = Array.from(content.matchAll(/<h[1-4][^>]*>([^<]+)<\/h[1-4]>/gi))
    .map(m => m[1].trim())
    .filter(t => t.length > 2 && t.length < 50)
    .slice(0, 4);

  console.log(`\n📄 ${file}`);
  console.log(`   Forms: ${forms} | Inputs: ${inputs} | Buttons: ${buttons} | Selects: ${selects}`);
  console.log(`   Headings: ${headings.join(' | ')}`);
}
