import fs from 'fs';
import path from 'path';

const content = fs.readFileSync('taxes html/returns.html', 'utf8');

// Find all inputs with name
const namedInputs = Array.from(content.matchAll(/<input[^>]+name=["']([^"']+)["'][^>]*>/gi))
  .map(m => {
    const raw = m[0];
    const name = m[1];
    const type = raw.match(/type=["']([^"']+)["']/i)?.[1] || 'text';
    const id = raw.match(/id=["']([^"']+)["']/i)?.[1];
    return { name, type, id };
  });

console.log('--- LIRS Returns Named Form Inputs ---');
console.log(namedInputs);

// Find all buttons in returns.html
const allButtons = Array.from(content.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi))
  .map(m => m[1].replace(/<[^>]+>/g, '').trim())
  .filter(Boolean);

console.log('\n--- LIRS Returns Action Buttons ---');
console.log(Array.from(new Set(allButtons)));
