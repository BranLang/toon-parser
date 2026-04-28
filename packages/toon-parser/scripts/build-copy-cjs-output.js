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

// Walk dist/cjs recursively, mirroring the structure under dist/, renaming
// `.js` outputs to `.cjs` and rewriting relative requires to match.
function processDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      processDir(src, path.join(destDir, entry.name));
      continue;
    }
    const dest = path.join(
      destDir,
      entry.name.endsWith('.js') ? entry.name.replace(/\.js$/, '.cjs') : entry.name
    );
    if (entry.name.endsWith('.js')) {
      let content = fs.readFileSync(src, 'utf8');
      // Rewrite relative requires from .js to .cjs to match the renamed files.
      content = content.replace(/(require\(["']\..+?)\.js(["']\))/g, '$1.cjs$2');
      fs.writeFileSync(dest, content);
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

processDir(distCjsDir, distDir);

// Cleanup the cjs intermediate directory.
try {
  fs.rmSync(distCjsDir, { recursive: true, force: true });
} catch {
  // ignore cleanup errors
}

console.log('CJS build copied to dist: OK');
