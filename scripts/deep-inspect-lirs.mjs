import fs from 'fs';
import path from 'path';

function inspectFile(file) {
  const content = fs.readFileSync(path.join('taxes html', file), 'utf8');
  console.log(`\n=================== ${file} ===================`);
  
  // Extract inputs
  const inputMatches = Array.from(content.matchAll(/<input[^>]+>/gi));
  console.log(`Total inputs: ${inputMatches.length}`);
  
  const sampleInputs = inputMatches.slice(0, 15).map(m => {
    const raw = m[0];
    const name = raw.match(/name=["']([^"']+)["']/i)?.[1];
    const id = raw.match(/id=["']([^"']+)["']/i)?.[1];
    const placeholder = raw.match(/placeholder=["']([^"']+)["']/i)?.[1];
    const type = raw.match(/type=["']([^"']+)["']/i)?.[1] || 'text';
    return { id, name, placeholder, type };
  });
  console.log('Sample Inputs:', sampleInputs);

  // Extract buttons
  const buttonMatches = Array.from(content.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi));
  const buttonTexts = buttonMatches.map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  console.log('Button Texts:', Array.from(new Set(buttonTexts)).slice(0, 10));
}

inspectFile('returns.html');
inspectFile('generate bill page.html');
inspectFile('Dashboard.html');
