import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(__dirname, '..');
const srcDir = path.join(pkgRoot, 'src');
const outDir = path.join(pkgRoot, 'dist', 'cjs');

// Collect every `.ts` source under `src/` (any depth). Replaces the previous
// `esbuild src/**/*.ts` invocation, which relied on shell-side `**` expansion
// — bash without `globstar` only matches one directory deep, so CI used to
// drop the top-level files (csv, xml, log, url, core, index, …).
function findTsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findTsFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const entryPoints = findTsFiles(srcDir);

await build({
  entryPoints,
  format: 'cjs',
  platform: 'node',
  outdir: outDir,
  bundle: false,
  logLevel: 'info'
});
