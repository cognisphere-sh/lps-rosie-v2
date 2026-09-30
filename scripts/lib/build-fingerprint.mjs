// Content hashes, never source/env values: safe to store in ignored build dirs.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [mode, root] = process.argv.slice(2);
if (!root || !['dependencies', 'app'].includes(mode)) process.exit(1);
const hash = createHash('sha256');
const add = (name, value) => hash.update(JSON.stringify([name, String(value)]));
add('node', process.version);
add('platform', `${process.platform}/${process.arch}`);
add('pnpm', process.env.BUILD_PNPM_VERSION ?? '');
add('NODE_ENV', process.env.NODE_ENV ?? '');

const envNames = new Set(['TZ', 'NODE_OPTIONS']);
function file(relative) {
  const path = join(root, relative);
  if (!existsSync(path)) { add(relative, '<missing>'); return; }
  const content = readFileSync(path);
  add(relative, createHash('sha256').update(content).digest('hex'));
  if (mode === 'app' && /\.[cm]?[jt]sx?$/.test(relative)) {
    // Include exported variables used by source/config as well as env files.
    for (const match of content.toString().matchAll(/process\.env(?:\.([A-Za-z_][\w]*)|\[['"]([^'"]+)['"]\])/g)) {
      envNames.add(match[1] ?? match[2]);
    }
  }
}
const excluded = new Set(['node_modules', '.next', '.build-work', '.git', 'next-env.d.ts']);
function tree(relative) {
  if (!existsSync(join(root, relative))) { add(relative, '<missing>'); return; }
  for (const name of readdirSync(join(root, relative)).sort()) {
    if (excluded.has(name) || name.endsWith('.tsbuildinfo')) continue;
    const child = `${relative}/${name}`;
    if (statSync(join(root, child)).isDirectory()) tree(child);
    else file(child);
  }
}

for (const path of [
  'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', '.pnpmfile.cjs', '.pnpmfile.mjs',
  'harness/package.json', 'harness/.npmrc', 'harness/pnpm-lock.yaml',
  'app/package.json', 'app/.npmrc',
  'scripts/build.sh', 'scripts/lib/build-fingerprint.mjs',
  // Detect installs performed outside this script, too.
  'node_modules/.modules.yaml', 'node_modules/.pnpm/lock.yaml',
]) file(path);
tree('patches');
if (mode === 'app') {
  tree('app');
  // The app imports shared webchat types/helpers directly from this directory.
  tree('harness/plugins');
  for (const name of Object.keys(process.env)) {
    if (name.startsWith('NEXT_')) envNames.add(name);
  }
  for (const name of [...envNames].sort()) add(`env:${name}`, process.env[name] ?? '');
}
process.stdout.write(hash.digest('hex') + '\n');
