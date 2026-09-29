#!/usr/bin/env node
/**
 * Pack seed packages into the desktop snapshot's packed/workdsh folder.
 * Package list must match WORKDSH_ROOT_PACKAGES / WORKDSH_PROFILE_BUNDLES.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// Windows CI sets a short snapshot root: LibreOffice cannot open files past 260 characters.
const SNAPSHOT = process.env.PRAXIS_DESKTOP_SNAPSHOT
  ? resolve(process.env.PRAXIS_DESKTOP_SNAPSHOT)
  : join(ROOT, '.artifacts', 'desktop-pack-test', 'upstream');
const TARGET = process.env.DSH_DESKTOP_PACK_TARGET ?? process.argv.find((a) => a.startsWith('--target='))?.slice(9) ?? 'mac-arm64';
const PACKED = join(SNAPSHOT, 'apps', 'desktop', '.desktop-build', 'targets', TARGET, 'packed', 'workdsh');

const PACKAGES = [
  ['packages/bundle', 'workdsh-bundle'],
  ['packages/plugins/skills', 'workdsh-plugin-skills'],
  ['packages/plugins/access', 'workdsh-plugin-access'],
  ['packages/plugins/activity', 'workdsh-plugin-activity'],
  ['packages/plugins/audit', 'workdsh-plugin-audit'],
  ['packages/plugins/connectors', 'workdsh-plugin-connectors'],
  ['packages/plugins/experts', 'workdsh-plugin-experts'],
  ['packages/plugins/library', 'workdsh-plugin-library'],
  ['packages/plugins/office', 'workdsh-plugin-office'],
  ['packages/plugins/projects', 'workdsh-plugin-projects'],
  ['packages/plugins/vision', 'workdsh-plugin-vision'],
  ['packages/providers/identity-local', 'workdsh-provider-identity-local'],
  // Not a profile bundle: projects imports it at runtime through a peer dependency.
  ['packages/ui', 'workdsh-ui'],
];

// Third-party npm plugins seeded as built-in bundles; keep exact versions.
const NPM_PACKAGES = [
  'dsh-ui-appearance@0.1.10',
  'dsh-better-sidebar@0.21.1',
  '@xmanrui/dsh-im@4.28.0',
];

function fail(message) {
  console.error(`[ci-pack-plugins] ERROR: ${message}`);
  process.exit(1);
}

function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
  if (result.status !== 0) fail(`${command} ${args.join(' ')} exited ${result.status}`);
}

if (!existsSync(join(SNAPSHOT, 'package.json'))) {
  fail('snapshot missing; run scripts/desktop/ci-bootstrap-snapshot.mjs first');
}

mkdirSync(PACKED, { recursive: true });
for (const name of readdirSync(PACKED)) {
  if (name.endsWith('.tgz')) rmSync(join(PACKED, name), { force: true });
}

function exportTargets(value) {
  if (typeof value === 'string') return [value];
  if (value === null || typeof value !== 'object') return [];
  return Object.values(value).flatMap(exportTargets);
}

console.log(`[ci-pack-plugins] target=${TARGET} → ${PACKED}`);
for (const [dir, name] of PACKAGES) {
  const abs = join(ROOT, dir);
  if (!existsSync(join(abs, 'package.json'))) fail(`missing package ${name} at ${dir}`);
  // An unbuilt package still packs, then only fails to import on a colleague's machine.
  const manifest = JSON.parse(readFileSync(join(abs, 'package.json'), 'utf8'));
  const missing = exportTargets(manifest.exports ?? manifest.main)
    .filter((target) => !target.includes('*') && !existsSync(join(abs, target)));
  if (missing.length > 0) fail(`${name} is not built; missing ${missing.join(', ')} (add it to the root build script)`);
  console.log(`[ci-pack-plugins] pack ${name}`);
  run('corepack', ['pnpm', '--dir', abs, 'pack', '--pack-destination', PACKED]);
}

for (const spec of NPM_PACKAGES) {
  console.log(`[ci-pack-plugins] pack ${spec}`);
  run('npm', ['pack', spec, '--pack-destination', PACKED]);
}

const tgz = readdirSync(PACKED).filter((n) => n.endsWith('.tgz'));
const expected = PACKAGES.length + NPM_PACKAGES.length;
if (tgz.length < expected) fail(`expected >= ${expected} tarballs, got ${tgz.length}`);
console.log(`[ci-pack-plugins] done (${tgz.length} tarballs)`);
