const fs = require('fs');
const path = require('path');

const distCjsDir = path.join(__dirname, '..', 'dist', 'cjs');
const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distCjsDir)) {
  console.error('CJS build directory not found:', distCjsDir);
  process.exit(1);
}

const entries = fs.readdirSync(distCjsDir);
for (const file of entries) {
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
  // ignore
}

console.log('CJS build copied to dist: OK');
