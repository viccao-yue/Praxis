#!/usr/bin/env node
/**
 * Download the locked official Harness desktop snapshot into
 * `.artifacts/desktop-pack-test/upstream` and apply WORKDSH TEST PATCH files.
 *
 * Usage:
 *   node scripts/desktop/ci-bootstrap-snapshot.mjs
 *   DSH_DESKTOP_TAG=dsh-v0.1.7-alpha.1 node scripts/desktop/ci-bootstrap-snapshot.mjs
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, cpSync, readdirSync, readFileSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TAG = process.env.DSH_DESKTOP_TAG ?? 'dsh-v0.1.7-alpha.1';
// Windows CI sets a short snapshot root: LibreOffice cannot open files past 260 characters.
const SNAPSHOT = process.env.PRAXIS_DESKTOP_SNAPSHOT
  ? resolve(process.env.PRAXIS_DESKTOP_SNAPSHOT)
  : join(ROOT, '.artifacts', 'desktop-pack-test', 'upstream');
const PATCH_STORE = join(ROOT, 'scripts', 'desktop', 'patches', 'upstream');
const CACHE = join(ROOT, '.artifacts', 'desktop-pack-test', 'cache');
const TARBALL = join(CACHE, `${TAG}.tar.gz`);
const URL = `https://codeload.github.com/deepseek-ai/deepseek-harness/tar.gz/refs/tags/${TAG}`;

// The Windows runner has dropped stderr before exit, so failures go to stdout too.
function fail(message) {
  const line = `[ci-bootstrap-snapshot] ERROR: ${message}\n`;
  writeSync(1, line);
  writeSync(2, line);
  process.exit(1);
}

process.on('uncaughtException', (error) => fail(error?.stack ?? String(error)));

/** Run a tool with captured output so its messages reach the job log before any exit. */
function runCaptured(command, args, what) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.stdout) writeSync(1, result.stdout);
  if (result.stderr) writeSync(1, result.stderr);
  if (result.error) fail(`${what}: ${result.error.message}`);
  if (result.status !== 0) fail(`${what}: ${command} exited with ${result.status ?? result.signal}`);
  return result.stdout ?? '';
}

// Windows tar cannot create the snapshot's symlinks (CLAUDE.md aliases, test fixtures);
// none of them are used by the desktop build, so they are skipped there.
function extractTarball(tarball, dest) {
  if (process.platform !== 'win32') {
    runCaptured('tar', ['-xzf', tarball, '-C', dest], 'extract snapshot');
    return;
  }
  const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
  const listing = runCaptured(tar, ['-tvzf', tarball], 'list snapshot');
  const links = listing.split(/\r?\n/)
    .filter((line) => line.startsWith('l'))
    .map((line) => line.replace(/ -> .*$/, '').split(/\s+/).pop())
    .filter(Boolean);
  console.log(`[ci-bootstrap-snapshot] skipping ${links.length} symlinks on Windows`);
  runCaptured(tar, ['-xzf', tarball, '-C', dest, ...links.flatMap((link) => ['--exclude', link])], 'extract snapshot');
}

function downloadTarball(url, dest) {
  const curl = process.platform === 'win32' ? 'curl.exe' : 'curl';
  execFileSync(curl, [
    '-fL',
    '--retry', '5',
    '--retry-delay', '2',
    '--retry-all-errors',
    '-o', dest,
    url,
  ], { stdio: 'inherit' });
  const size = statSync(dest).size;
  if (size < 1_000_000) fail(`tarball too small (${size} bytes): ${dest}`);
  console.log(`[ci-bootstrap-snapshot] downloaded ${size} bytes`);
}

function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else out.push(path);
    }
  };
  walk(root);
  return out;
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

mkdirSync(CACHE, { recursive: true });
if (!existsSync(TARBALL) || process.env.DSH_DESKTOP_FORCE_DOWNLOAD === '1') {
  console.log(`[ci-bootstrap-snapshot] downloading ${URL}`);
  downloadTarball(URL, TARBALL);
} else {
  console.log(`[ci-bootstrap-snapshot] using cached ${TARBALL}`);
}

const extractRoot = join(CACHE, 'extract');
rmSync(extractRoot, { recursive: true, force: true });
mkdirSync(extractRoot, { recursive: true });
console.log(`[ci-bootstrap-snapshot] extracting ${TARBALL}`);
extractTarball(TARBALL, extractRoot);
const entries = readdirSync(extractRoot);
if (entries.length !== 1) fail(`expected one top-level folder in tarball, got ${entries.join(', ')}`);
const unpacked = join(extractRoot, entries[0]);

rmSync(SNAPSHOT, { recursive: true, force: true });
// On Windows, recursive mkdir of a drive root such as D:\ throws EPERM even though it exists.
if (!existsSync(dirname(SNAPSHOT))) mkdirSync(dirname(SNAPSHOT), { recursive: true });
console.log(`[ci-bootstrap-snapshot] copying snapshot into ${SNAPSHOT}`);
cpSync(unpacked, SNAPSHOT, { recursive: true });
console.log(`[ci-bootstrap-snapshot] snapshot ready: ${SNAPSHOT}`);

for (const patchFile of listFiles(PATCH_STORE)) {
  const rel = relative(PATCH_STORE, patchFile);
  const target = join(SNAPSHOT, rel);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(patchFile, target);
  console.log(`[ci-bootstrap-snapshot] applied patch ${rel} (${sha256(patchFile).slice(0, 12)}…)`);
}

// Provide a PNG icon for electron-builder (from the transparent 1024 logo).
const brandPng = join(ROOT, 'assets', 'brand', 'praxis-logo.png');
const iconTargets = [
  join(SNAPSHOT, 'apps', 'desktop', 'build', 'icon.png'),
  join(SNAPSHOT, 'apps', 'desktop', 'resources', 'icon-macos.png'),
  join(SNAPSHOT, 'apps', 'desktop', 'resources', 'icon-windows.png'),
];
if (existsSync(brandPng)) {
  for (const icon of iconTargets) {
    mkdirSync(dirname(icon), { recursive: true });
    cpSync(brandPng, icon);
  }
  console.log('[ci-bootstrap-snapshot] installed Praxis icon PNG');
}

// The official package script reads release settings only from these dotenv files.
// Unsigned Alpha builds need the shared settings; signing credentials stay unset.
const sharedEnv = [
  'DSH_DESKTOP_APP_ID=com.workdsh.app',
  'DSH_DESKTOP_AUTO_UPDATE_ENV=production',
  'DSH_DESKTOP_MANDATORY_UPDATE_PROD_ORIGIN=https://github.com',
];
const platformEnvs = [
  ['.env.macos', 'macOS', ['DSH_DESKTOP_MACOS_PACK_CONCURRENCY=4']],
  ['.env.windows', 'Windows', ['DSH_DESKTOP_WINDOWS_SIGNATURE_CACHE_CONCURRENCY=4']],
];
for (const [file, label, extra] of platformEnvs) {
  const path = join(SNAPSHOT, 'apps', 'desktop', file);
  if (existsSync(path)) continue;
  writeFileSync(path, [...sharedEnv, ...extra, ''].join('\n'));
  console.log(`[ci-bootstrap-snapshot] wrote unsigned ${label} packaging env`);
}

console.log('[ci-bootstrap-snapshot] done');
