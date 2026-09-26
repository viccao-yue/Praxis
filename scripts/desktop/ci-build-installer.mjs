#!/usr/bin/env node
/**
 * Full official Desktop prepare + installer for one target (CI / Alpha).
 *
 *   node scripts/desktop/ci-build-installer.mjs --target=mac-arm64
 *   node scripts/desktop/ci-build-installer.mjs --target=mac-x64
 *   node scripts/desktop/ci-build-installer.mjs --target=win-x64
 *
 * Assumes:
 *   - workspace packages already built (`pnpm build`)
 *   - snapshot bootstrapped (`ci-bootstrap-snapshot.mjs`)
 *
 * Uses official `package:<target>` (prepare + electron-builder), with
 * WORKDSH_DESKTOP_UNSIGNED=1 so Alpha builds skip Apple/Windows signing.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, copyFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SNAPSHOT = join(ROOT, '.artifacts', 'desktop-pack-test', 'upstream');
const DESKTOP_APP = join(SNAPSHOT, 'apps', 'desktop');
const ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';

const TARGETS = {
  'mac-arm64': { platform: 'darwin', arch: 'arm64', packageScript: 'package:mac:arm64' },
  'mac-x64': { platform: 'darwin', arch: 'x64', packageScript: 'package:mac:x64' },
  'win-x64': { platform: 'win32', arch: 'x64', packageScript: 'package:win:x64' },
};

const targetName = process.argv.find((a) => a.startsWith('--target='))?.slice(9) ?? 'mac-arm64';
const target = TARGETS[targetName];
if (!target) {
  console.error(`[ci-build-installer] unknown --target=${targetName}`);
  process.exit(1);
}

function fail(message) {
  console.error(`[ci-build-installer] ERROR: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} ${args.join(' ')} exited ${result.status}`);
}

function snapshotPnpmVersion() {
  const manifest = JSON.parse(readFileSync(join(SNAPSHOT, 'package.json'), 'utf8'));
  const declared = /^pnpm@(.+)$/.exec(manifest.packageManager ?? '');
  return declared?.[1] ?? '11.7.0';
}

/**
 * Official desktop snapshot pins packageManager (pnpm@11.7.0). CI runners only
 * have the workspace pnpm (10.x) until we explicitly prepare the snapshot pin.
 */
function resolvePnpmEntry() {
  const declared = snapshotPnpmVersion();
  console.log(`[ci-build-installer] corepack prepare pnpm@${declared}`);
  run('corepack', ['prepare', `pnpm@${declared}`, '--activate'], { env: process.env });

  const cacheRoot = join(homedir(), '.cache', 'node', 'corepack', 'v1', 'pnpm');
  const entry = join(cacheRoot, declared, 'bin', 'pnpm.mjs');
  if (existsSync(entry)) {
    console.log(`[ci-build-installer] using pnpm@${declared} → ${entry}`);
    return entry;
  }

  // Some corepack layouts nest differently; fall back to any matching version dir.
  const candidates = existsSync(cacheRoot) ? readdirSync(cacheRoot) : [];
  const pick = candidates.includes(declared) ? declared : candidates.sort().at(-1);
  if (pick === undefined) fail(`pnpm corepack cache missing after prepare pnpm@${declared}`);
  const fallback = join(cacheRoot, pick, 'bin', 'pnpm.mjs');
  if (!existsSync(fallback)) fail(`pnpm entry missing: ${fallback}`);
  if (pick !== declared) {
    console.warn(`[ci-build-installer] warning: wanted pnpm@${declared}, using ${pick}`);
  }
  return fallback;
}

function targetEnv() {
  return {
    ...process.env,
    PATH: `${dirname(process.execPath)}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`,
    DSH_DESKTOP_TARGET_PLATFORM: target.platform,
    DSH_DESKTOP_TARGET_ARCH: target.arch,
    DSH_DESKTOP_PACK_TARGET: targetName,
    WORKDSH_DESKTOP_UNSIGNED: '1',
    DSH_DESKTOP_APP_ID: 'com.workdsh.app',
    DSH_DESKTOP_AUTO_UPDATE_ENV: 'production',
    ELECTRON_MIRROR,
    ELECTRON_BUILDER_CACHE: join(ROOT, '.artifacts', 'desktop-pack-test', 'electron-builder-cache'),
  };
}

if (!existsSync(join(SNAPSHOT, 'package.json'))) {
  fail('snapshot missing; run ci-bootstrap-snapshot.mjs first');
}
if (target.platform === 'win32' && process.platform !== 'win32') {
  fail('win-x64 must run on Windows');
}
if (target.platform === 'darwin' && process.platform !== 'darwin') {
  fail('mac targets must run on macOS');
}
if (targetName === 'mac-arm64' && process.arch !== 'arm64') {
  fail('mac-arm64 requires Apple Silicon host');
}

const pnpm = resolvePnpmEntry();
const env = targetEnv();
const marker = join(SNAPSHOT, 'node_modules', '.modules.yaml');

console.log(`[ci-build-installer] 1/5 install snapshot deps (if needed)`);
if (!existsSync(marker) || process.env.DSH_DESKTOP_FORCE_INSTALL === '1') {
  run(process.execPath, [pnpm, 'install', '--frozen-lockfile'], { cwd: SNAPSHOT, env });
} else {
  console.log('[ci-build-installer] node_modules present, skip install');
}

console.log(`[ci-build-installer] 2/5 pack Praxis seed plugins → packed/workdsh`);
run(process.execPath, [join(ROOT, 'scripts/desktop/ci-pack-plugins.mjs'), `--target=${targetName}`], {
  cwd: ROOT,
  env,
});

console.log('[ci-build-installer] 3/5 build:desktop');
run(process.execPath, [pnpm, 'run', 'build:desktop'], { cwd: SNAPSHOT, env });

console.log(`[ci-build-installer] 4/5 official ${target.packageScript} (prepare + installer)`);
run(process.execPath, [pnpm, '--filter', '@deepseek-ai/dsh-desktop', 'run', target.packageScript], {
  cwd: SNAPSHOT,
  env,
});

const artifacts = join(DESKTOP_APP, '.desktop-build', 'targets', targetName, 'artifacts');
const staging = join(ROOT, '.artifacts', 'desktop-installers', targetName);
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

const collected = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(dmg|exe)$/i.test(name)) collected.push(path);
  }
};
walk(artifacts);

if (collected.length === 0) fail(`no dmg/exe under ${artifacts}`);
for (const file of collected) {
  const base = file.split(/[/\\]/).at(-1);
  const dest = join(staging, base);
  copyFileSync(file, dest);
  const size = statSync(dest).size;
  if (size < 1_000_000) fail(`installer too small: ${base} (${size})`);
  const hash = createHash('sha256').update(readFileSync(dest)).digest('hex');
  console.log(`[ci-build-installer] ${base} ${Math.round(size / 1e6)}MB sha256=${hash.slice(0, 12)}…`);
}

console.log(`[ci-build-installer] 5/5 staged → ${staging}`);
