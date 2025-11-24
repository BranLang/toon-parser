import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distCjsDir = path.join(__dirname, '..', 'dist', 'cjs');
const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distCjsDir)) {
  console.error('CJS build directory not found:', distCjsDir);
  process.exit(1);
}

for (const file of fs.readdirSync(distCjsDir)) {
  const src = path.join(distCjsDir, file);
  let destName = file;

  // Rename the JS file to .cjs so it can be consumed by require()
  if (file.endsWith('.js')) {
    destName = file.replace(/\.js$/, '.cjs');
  }

  const dest = path.join(distDir, destName);
  fs.copyFileSync(src, dest);
}

// Optionally cleanup the cjs intermediate directory
try {
  fs.rmSync(distCjsDir, { recursive: true, force: true });
} catch (e) {
  // ignore cleanup errors
}

console.log('CJS build copied to dist: OK');
