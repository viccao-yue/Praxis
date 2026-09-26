#!/usr/bin/env node
/**
 * Pack seed packages into the desktop snapshot's packed/workdsh folder.
 * Package list must match WORKDSH_ROOT_PACKAGES / WORKDSH_PROFILE_BUNDLES.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SNAPSHOT = join(ROOT, '.artifacts', 'desktop-pack-test', 'upstream');
const TARGET = process.env.DSH_DESKTOP_PACK_TARGET ?? process.argv.find((a) => a.startsWith('--target='))?.slice(9) ?? 'mac-arm64';
const PACKED = join(SNAPSHOT, 'apps', 'desktop', '.desktop-build', 'targets', TARGET, 'packed', 'workdsh');

const PACKAGES = [
  ['packages/bundle', 'workdsh-bundle'],
  ['packages/plugins/skills', 'workdsh-plugin-skills'],
  ['packages/plugins/access', 'workdsh-plugin-access'],
  ['packages/plugins/audit', 'workdsh-plugin-audit'],
  ['packages/plugins/experts', 'workdsh-plugin-experts'],
  ['packages/plugins/office', 'workdsh-plugin-office'],
  ['packages/providers/identity-local', 'workdsh-provider-identity-local'],
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

console.log(`[ci-pack-plugins] target=${TARGET} → ${PACKED}`);
for (const [dir, name] of PACKAGES) {
  const abs = join(ROOT, dir);
  if (!existsSync(join(abs, 'package.json'))) fail(`missing package ${name} at ${dir}`);
  console.log(`[ci-pack-plugins] pack ${name}`);
  run('corepack', ['pnpm', '--dir', abs, 'pack', '--pack-destination', PACKED]);
}

console.log('[ci-pack-plugins] pack dsh-ui-appearance@0.1.10');
run('npm', ['pack', 'dsh-ui-appearance@0.1.10', '--pack-destination', PACKED]);

// Hard deps present on Praxis (0.1.7) but absent from the locked desktop snapshot
// pack (0.1.5-rc.1). Putting them in packed/workdsh lets the closure select them.
const EXTRA_NPM = [
  '@deepseek-ai/dsh-browser-use@0.1.7-alpha.1',
  '@deepseek-ai/dsh-computer-use@0.1.7-alpha.1',
  '@deepseek-ai/dsh-experimental-auto-review@0.1.7-alpha.1',
  '@deepseek-ai/dsh-experimental-browser-use-playwright-mcp@0.1.7-alpha.1',
  '@deepseek-ai/dsh-experimental-computer-use-cua-driver-native@0.1.7-alpha.1',
];
for (const spec of EXTRA_NPM) {
  console.log(`[ci-pack-plugins] pack ${spec}`);
  run('npm', ['pack', spec, '--pack-destination', PACKED]);
}

const tgz = readdirSync(PACKED).filter((n) => n.endsWith('.tgz'));
if (tgz.length < PACKAGES.length + 1 + EXTRA_NPM.length) {
  fail(`expected >= ${PACKAGES.length + 1 + EXTRA_NPM.length} tarballs, got ${tgz.length}`);
}
console.log(`[ci-pack-plugins] done (${tgz.length} tarballs)`);
