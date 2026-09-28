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
import { createWriteStream, existsSync, mkdirSync, rmSync, cpSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TAG = process.env.DSH_DESKTOP_TAG ?? 'dsh-v0.1.7-alpha.1';
const SNAPSHOT = join(ROOT, '.artifacts', 'desktop-pack-test', 'upstream');
const PATCH_STORE = join(ROOT, 'scripts', 'desktop', 'patches', 'upstream');
const CACHE = join(ROOT, '.artifacts', 'desktop-pack-test', 'cache');
const TARBALL = join(CACHE, `${TAG}.tar.gz`);
const URL = `https://codeload.github.com/deepseek-ai/deepseek-harness/tar.gz/refs/tags/${TAG}`;

function fail(message) {
  console.error(`[ci-bootstrap-snapshot] ERROR: ${message}`);
  process.exit(1);
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
  const response = await fetch(URL);
  if (!response.ok) fail(`download failed: HTTP ${response.status}`);
  await pipeline(response.body, createWriteStream(TARBALL));
} else {
  console.log(`[ci-bootstrap-snapshot] using cached ${TARBALL}`);
}

const extractRoot = join(CACHE, 'extract');
rmSync(extractRoot, { recursive: true, force: true });
mkdirSync(extractRoot, { recursive: true });
execFileSync('tar', ['-xzf', TARBALL, '-C', extractRoot], { stdio: 'inherit' });
const entries = readdirSync(extractRoot);
if (entries.length !== 1) fail(`expected one top-level folder in tarball, got ${entries.join(', ')}`);
const unpacked = join(extractRoot, entries[0]);

rmSync(SNAPSHOT, { recursive: true, force: true });
mkdirSync(dirname(SNAPSHOT), { recursive: true });
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

const macosEnv = join(SNAPSHOT, 'apps', 'desktop', '.env.macos');
if (!existsSync(macosEnv)) {
  writeFileSync(macosEnv, [
    'DSH_DESKTOP_APP_ID=com.workdsh.app',
    'DSH_DESKTOP_AUTO_UPDATE_ENV=production',
    'DSH_DESKTOP_MACOS_PACK_CONCURRENCY=4',
    'DSH_DESKTOP_MANDATORY_UPDATE_PROD_ORIGIN=https://github.com',
    '',
  ].join('\n'));
  console.log('[ci-bootstrap-snapshot] wrote unsigned macOS packaging env');
}

console.log('[ci-bootstrap-snapshot] done');
