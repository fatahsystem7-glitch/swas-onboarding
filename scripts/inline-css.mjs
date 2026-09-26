// Injects the compiled Tailwind CSS into the <style id="tailwind"> block of each
// HTML page in ./public. This keeps the pages fully self-contained (no external
// stylesheet needed), so they render identically in previews and when deployed.
import { readFile, writeFile, readdir } from 'node:fs/promises';

const cssPath = process.argv[2] || 'assets/dist.css';
const css = await readFile(cssPath, 'utf8');

const entries = await readdir('public');
const files = entries.filter((f) => f.endsWith('.html')).map((f) => `public/${f}`);

const START = '<style id="tailwind">';
const END = '</style>';

for (const file of files) {
  let html = await readFile(file, 'utf8');
  const startIdx = html.indexOf(START);
  if (startIdx === -1) {
    console.warn(`skip (no marker): ${file}`);
    continue;
  }
  const afterStart = startIdx + START.length;
  const endIdx = html.indexOf(END, afterStart);
  html = html.slice(0, afterStart) + '\n' + css + '\n' + html.slice(endIdx);
  await writeFile(file, html);
  console.log(`inlined ${(css.length / 1024).toFixed(1)} KB into ${file}`);
}
