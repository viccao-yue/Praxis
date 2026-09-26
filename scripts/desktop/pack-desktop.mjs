#!/usr/bin/env node
/**
 * Multi-target pack entry for CI / local Alpha installers.
 *
 *   node scripts/desktop/pack-desktop.mjs --target=mac-arm64 --installer
 *   node scripts/desktop/pack-desktop.mjs --target=mac-x64 --installer
 *   node scripts/desktop/pack-desktop.mjs --target=win-x64 --installer
 *
 * Default remains local mac-arm64 directory build (`--dir`) for smoke testing.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, '..', '..');
const SNAPSHOT = join(WORKSPACE_ROOT, '.artifacts', 'desktop-pack-test', 'upstream');
const DESKTOP_APP = join(SNAPSHOT, 'apps', 'desktop');
const PATCH_STORE = join(SCRIPT_DIR, 'patches', 'upstream');
const ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
const REQUIRED_NODE = [22, 19];

const TARGETS = {
  'mac-arm64': { platform: 'darwin', arch: 'arm64', electronArgs: ['--mac', '--arm64'] },
  'mac-x64': { platform: 'darwin', arch: 'x64', electronArgs: ['--mac', '--x64'] },
  'win-x64': { platform: 'win32', arch: 'x64', electronArgs: ['--win', '--x64'] },
};

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : fallback;
};

const targetName = opt('--target', 'mac-arm64');
const target = TARGETS[targetName];
if (!target) {
  console.error(`[pack-desktop] unknown --target=${targetName}; use ${Object.keys(TARGETS).join('|')}`);
  process.exit(1);
}

const installer = flag('--installer');
const APP_BUNDLE = join(
  DESKTOP_APP,
  '.desktop-build',
  'targets',
  targetName,
  'artifacts',
  targetName,
  target.platform === 'darwin' ? 'Praxis.app' : 'Praxis',
);
const ARTIFACTS_DIR = join(DESKTOP_APP, '.desktop-build', 'targets', targetName, 'artifacts');

function fail(message) {
  console.error(`\n[pack-desktop] ERROR: ${message}`);
  process.exit(1);
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', ...options });
  if (result.error !== undefined) fail(`${command} 无法执行: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} ${commandArgs.join(' ')} 退出码 ${result.status}`);
}

function runCapture(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8', ...options });
  if (result.error !== undefined) fail(`${command} 无法执行: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} ${commandArgs.join(' ')} 退出码 ${result.status}: ${result.stderr?.trim()}`);
  return result.stdout.trim();
}

function needsNodeBootstrap() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  return major < REQUIRED_NODE[0] || (major === REQUIRED_NODE[0] && minor < REQUIRED_NODE[1]);
}

function findNode22Bin() {
  const nvmRoot = join(homedir(), '.nvm', 'versions', 'node');
  if (!existsSync(nvmRoot)) return undefined;
  const candidates = readdirSync(nvmRoot)
    .filter((name) => /^v22\.\d+\.\d+$/.test(name))
    .filter((name) => {
      const [major, minor] = name.slice(1).split('.').map(Number);
      return major > REQUIRED_NODE[0] || minor >= REQUIRED_NODE[1];
    })
    .sort((a, b) => {
      const pa = a.slice(1).split('.').map(Number);
      const pb = b.slice(1).split('.').map(Number);
      return pb[0] - pa[0] || pb[1] - pa[1] || pb[2] - pa[2];
    });
  const bin = candidates.length > 0 ? join(nvmRoot, candidates[0], 'bin', 'node') : undefined;
  return bin !== undefined && existsSync(bin) ? bin : undefined;
}

if (needsNodeBootstrap()) {
  const node22 = findNode22Bin();
  if (node22 === undefined) fail(`需要 Node >= ${REQUIRED_NODE.join('.')}，当前 ${process.versions.node}`);
  console.log(`[pack-desktop] Node ${process.versions.node} → ${node22}`);
  run(node22, [fileURLToPath(import.meta.url), ...process.argv.slice(2)]);
  process.exit(0);
}

if (target.platform === 'win32' && process.platform !== 'win32') {
  fail('win-x64 必须在 Windows 宿主上打包（GitHub windows-latest 或本机 Windows）');
}
if (target.platform === 'darwin' && process.platform !== 'darwin') {
  fail('mac 目标必须在 macOS 宿主上打包');
}

function snapshotPnpmVersion() {
  const manifest = JSON.parse(readFileSync(join(SNAPSHOT, 'package.json'), 'utf8'));
  const declared = /^pnpm@(.+)$/.exec(manifest.packageManager ?? '');
  return declared?.[1] ?? '11.7.0';
}

function resolvePnpmEntry() {
  const declared = snapshotPnpmVersion();
  console.log(`[pack-desktop] corepack prepare pnpm@${declared}`);
  run('corepack', ['prepare', `pnpm@${declared}`, '--activate']);
  const cacheRoot = join(homedir(), '.cache', 'node', 'corepack', 'v1', 'pnpm');
  const entry = join(cacheRoot, declared, 'bin', 'pnpm.mjs');
  if (existsSync(entry)) return entry;
  const candidates = existsSync(cacheRoot) ? readdirSync(cacheRoot) : [];
  const pick = candidates.includes(declared) ? declared : candidates.sort().at(-1);
  if (pick === undefined) fail(`未找到 pnpm corepack 缓存（需要 pnpm@${declared}）`);
  const fallback = join(cacheRoot, pick, 'bin', 'pnpm.mjs');
  if (!existsSync(fallback)) fail(`pnpm 入口不存在: ${fallback}`);
  return fallback;
}

function snapshotEnv() {
  return {
    ...process.env,
    PATH: `${dirname(process.execPath)}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`,
    DSH_DESKTOP_TARGET_PLATFORM: target.platform,
    DSH_DESKTOP_TARGET_ARCH: target.arch,
    WORKDSH_DESKTOP_UNSIGNED: '1',
    DSH_DESKTOP_APP_ID: 'com.workdsh.app',
    DSH_DESKTOP_AUTO_UPDATE_ENV: 'production',
    ELECTRON_MIRROR,
  };
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function listFiles(root) {
  const entries = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else entries.push(path);
    }
  };
  walk(root);
  return entries;
}

function checkPrerequisites() {
  if (!existsSync(join(DESKTOP_APP, 'package.json'))) {
    fail(`官方快照缺失: ${SNAPSHOT}\n  先运行: node scripts/desktop/ci-bootstrap-snapshot.mjs`);
  }
  const drift = [];
  for (const patchFile of listFiles(PATCH_STORE)) {
    const dest = join(SNAPSHOT, relative(PATCH_STORE, patchFile));
    if (!existsSync(dest)) drift.push(`${relative(PATCH_STORE, patchFile)} (快照缺失)`);
    else if (sha256(patchFile) !== sha256(dest)) drift.push(`${relative(PATCH_STORE, patchFile)} (内容不一致)`);
  }
  if (drift.length > 0 && flag('--sync-patches')) {
    for (const patchFile of listFiles(PATCH_STORE)) {
      const dest = join(SNAPSHOT, relative(PATCH_STORE, patchFile));
      if (existsSync(dest)) copyFileSync(dest, patchFile);
    }
    console.log(`[pack-desktop] 已同步补丁存档（${drift.length} 处）`);
  } else if (drift.length > 0) {
    fail(`快照与补丁存档不一致:\n  ${drift.join('\n  ')}`);
  } else {
    console.log(`[pack-desktop] 补丁一致（${listFiles(PATCH_STORE).length}）`);
  }
}

function findAsarModule() {
  const pnpmRoot = join(SNAPSHOT, 'node_modules', '.pnpm');
  if (!existsSync(pnpmRoot)) return undefined;
  const entry = readdirSync(pnpmRoot).filter((name) => name.startsWith('@electron+asar@')).sort().at(-1);
  if (entry === undefined) return undefined;
  const moduleRoot = join(pnpmRoot, entry, 'node_modules', '@electron', 'asar');
  const manifest = JSON.parse(readFileSync(join(moduleRoot, 'package.json'), 'utf8'));
  return join(moduleRoot, manifest.main ?? 'lib/asar.js');
}

function plistValue(key) {
  return runCapture('plutil', ['-extract', key, 'raw', join(APP_BUNDLE, 'Contents', 'Info.plist')]);
}

function verifyMacApp() {
  if (!existsSync(APP_BUNDLE)) fail(`产物不存在: ${APP_BUNDLE}`);
  const problems = [];
  const expect = (label, actual, wanted) => {
    if (actual !== wanted) problems.push(`${label}: 期望 ${wanted}，实际 ${actual}`);
  };
  expect('CFBundleIdentifier', plistValue('CFBundleIdentifier'), 'com.workdsh.app');
  expect('CFBundleDisplayName', plistValue('CFBundleDisplayName'), 'Praxis');
  expect('CFBundleIconFile', plistValue('CFBundleIconFile'), 'icon.icns');
  const iconSource = join(DESKTOP_APP, 'workdsh-icon.icns');
  const iconPacked = join(APP_BUNDLE, 'Contents', 'Resources', 'icon.icns');
  if (!existsSync(iconPacked) || sha256(iconSource) !== sha256(iconPacked)) problems.push('icon.icns 与品牌源不一致');
  const asarPath = join(APP_BUNDLE, 'Contents', 'Resources', 'app.asar');
  const asarMain = findAsarModule();
  if (asarMain === undefined) problems.push('未找到 @electron/asar');
  else {
    const require = createRequire(import.meta.url);
    const asar = require(asarMain);
    const main = asar.extractFile(asarPath, 'lib/main.js').toString();
    const preload = asar.extractFile(asarPath, 'lib/preload-app.cjs').toString();
    if (!main.includes('hiddenInset') || !main.includes('shellFrame')) problems.push('缺少窗口壳补丁');
    if (!preload.includes('workdshShell') || !preload.includes('_logoRow') || !preload.includes('data-workdsh-shell')) {
      problems.push('缺少外壳样式补丁');
    }
  }
  if (problems.length > 0) fail(`产物校验失败:\n  ${problems.join('\n  ')}`);
  console.log('[pack-desktop] mac .app 校验通过');
}

function collectInstallers() {
  if (!existsSync(ARTIFACTS_DIR)) return [];
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(dmg|exe|blockmap)$/i.test(name)) out.push(path);
    }
  };
  walk(ARTIFACTS_DIR);
  return out;
}

function verifyInstallers() {
  const files = collectInstallers();
  if (files.length === 0) fail(`未找到安装包产物（在 ${ARTIFACTS_DIR}）`);
  for (const file of files) {
    const size = statSync(file).size;
    if (size < 1_000_000) fail(`安装包过小: ${file} (${size} bytes)`);
    console.log(`[pack-desktop] installer ${relative(ARTIFACTS_DIR, file)} (${Math.round(size / 1e6)} MB)`);
  }
}

console.log(`[pack-desktop] target=${targetName} installer=${installer}`);
checkPrerequisites();
if (flag('--check-only')) {
  console.log('[pack-desktop] --check-only 完成');
  process.exit(0);
}

const pnpm = resolvePnpmEntry();
if (target.platform === 'darwin' && spawnSync('pgrep', ['-f', 'Praxis.app/Contents/MacOS/Praxis']).status === 0) {
  spawnSync('pkill', ['-f', 'Praxis.app/Contents/MacOS/Praxis']);
}

if (!flag('--skip-build')) {
  console.log('[pack-desktop] 1/2 build:desktop');
  run(process.execPath, [pnpm, 'run', 'build:desktop'], { cwd: SNAPSHOT, env: snapshotEnv() });
} else {
  console.log('[pack-desktop] 1/2 skip build:desktop');
}

const builderArgs = ['exec', 'electron-builder', '--config', 'electron-builder.config.mjs', '--publish', 'never', ...target.electronArgs];
if (!installer) builderArgs.push('--dir');
console.log(`[pack-desktop] 2/2 electron-builder ${installer ? 'installer' : '--dir'}`);
run(process.execPath, [pnpm, ...builderArgs], { cwd: DESKTOP_APP, env: snapshotEnv() });

if (installer) verifyInstallers();
else if (target.platform === 'darwin') verifyMacApp();

const staging = join(WORKSPACE_ROOT, '.artifacts', 'desktop-installers', targetName);
mkdirSync(staging, { recursive: true });
if (installer) {
  for (const file of collectInstallers()) {
    copyFileSync(file, join(staging, file.split(/[/\\]/).at(-1)));
  }
  console.log(`[pack-desktop] staged → ${staging}`);
} else {
  console.log(`[pack-desktop] 完成: ${APP_BUNDLE}`);
}

if (flag('--restart') && target.platform === 'darwin' && !installer) {
  spawnSync('open', [APP_BUNDLE], { stdio: 'inherit' });
}
