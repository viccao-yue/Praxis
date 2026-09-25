import { execFile } from 'node:child_process';
import { access, copyFile, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { withoutRedundantAgentTeamProfile } from './preview-agent-team.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const rootManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const overrides = rootManifest.pnpm?.overrides ?? {};
const baseVersion = overrides['@deepseek-ai/dsh-base'];
const webAppVersion = overrides['@deepseek-ai/dsh-web-app'];
if (typeof baseVersion !== 'string') throw new Error('Missing pinned @deepseek-ai/dsh-base version in package.json pnpm.overrides.');
if (typeof webAppVersion !== 'string') throw new Error('Missing pinned @deepseek-ai/dsh-web-app version in package.json pnpm.overrides.');
const baseSpec = `@deepseek-ai/dsh-base@${baseVersion}`;
const webAppSpec = `@deepseek-ai/dsh-web-app@${webAppVersion}`;
const cliVersion = JSON.parse(await readFile(join(root, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8')).version;
if (cliVersion !== baseVersion) throw new Error('Preview CLI and Base must use the same pinned version.');
const home = resolve(process.env.WORKDSH_PREVIEW_HOME ?? join(root, '.test-runtime/preview'));
const profileDir = join(home, 'profiles/preview');
const artifacts = join(root, '.artifacts');
const env = { ...process.env, DSH_HOME: home, PATH: `${join(root, 'node_modules/.bin')}:${dirname(process.execPath)}:${process.env.PATH}` };
const exec = promisify(execFile);
const run = async (tool, args, timeout = 900_000) => {
  await exec(process.execPath, [join(root, 'node_modules', tool), ...args], { cwd: root, env, timeout, maxBuffer: 8 * 1024 * 1024 });
};

const pinPreviewOverrides = async () => {
  const workspaceFile = join(profileDir, 'pnpm-workspace.yaml');
  let current = await readFile(workspaceFile, 'utf8');
  if (/^overrides:[^\n]*\S[^\n]*$/m.test(current)) {
    throw new Error('Preview profile uses inline overrides; convert them to a YAML block before installing.');
  }
  if (!/^overrides:/m.test(current)) current += '\n\noverrides:\n';
  current = current.replace(/^overrides:[ \t]*\n(?:[ \t]+[^\n]*\n|\n)*/m, (block) => {
    let result = block;
    for (const [name, version] of Object.entries(overrides)) {
      if (typeof version !== 'string') continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`^  ['"]?${escaped}['"]?:[^\\n]*\\n?`, 'm'), '');
      result += `  ${JSON.stringify(name)}: ${JSON.stringify(version)}\n`;
    }
    return result;
  });
  await writeFile(workspaceFile, current);
};

const installOfficialPeers = async () => {
  const scope = join(profileDir, 'node_modules', '@deepseek-ai');
  for (let pass = 0; ; pass++) {
    const missing = new Map();
    for (const entry of await readdir(scope)) {
      try {
        const pkg = JSON.parse(await readFile(join(scope, entry, 'package.json'), 'utf8'));
        for (const [name, range] of Object.entries(pkg.peerDependencies ?? {})) {
          if (!name.startsWith('@deepseek-ai/') || pkg.peerDependenciesMeta?.[name]?.optional) continue;
          try {
            await access(join(scope, name.slice('@deepseek-ai/'.length), 'package.json'));
            continue;
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
          const version = overrides[name] ?? (name.startsWith('@deepseek-ai/dsh-') ? cliVersion : range);
          missing.set(name, `${name}@${version}`);
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    if (!missing.size) break;
    if (pass >= 8) throw new Error('Official runtime peer dependencies did not converge.');
    await run('pnpm/bin/pnpm.cjs', ['--dir', profileDir, 'add', '--save-exact', ...missing.values()]);
  }
};

await mkdir(home, { recursive: true }); await mkdir(artifacts, { recursive: true });
const tarballs = [];
const packages = [];
for (const directory of ['packages/providers/identity-local', 'packages/plugins/audit', 'packages/plugins/access', 'packages/plugins/skills', 'packages/plugins/experts', 'packages/plugins/connectors', 'packages/plugins/office', 'packages/plugins/library', 'packages/plugins/projects', 'packages/plugins/activity', 'packages/plugins/vision', 'packages/bundle']) {
  const manifest = JSON.parse(await readFile(join(root, directory, 'package.json'), 'utf8'));
  await access(join(root, directory, manifest.exports['.'].default));
  await run('pnpm/bin/pnpm.cjs', ['--filter', manifest.name, 'pack', '--pack-destination', artifacts], 180_000);
  const packed = join(artifacts, `${manifest.name}-${manifest.version}.tgz`);
  // Preview candidates can change before their next release. A stable file:
  // address lets the package manager reuse an older archive, even after pack.
  // Keep official CLI installation, but address each archive by its content.
  const digest = createHash('sha256').update(await readFile(packed)).digest('hex');
  const destination = join(artifacts, 'preview', digest);
  await mkdir(destination, { recursive: true });
  const immutableArchive = join(destination, `${manifest.name}-${manifest.version}.tgz`);
  await copyFile(packed, immutableArchive);
  tarballs.push(immutableArchive);
  packages.push({ directory, manifest });
}
let initialized = false;
try { await access(join(profileDir, 'package.json')); initialized = true; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!initialized) await run('@deepseek-ai/dsh/lib/bin.js', ['--profile', 'preview', '--from-default-profile', 'web', '--dump-config']);
// Experts already contributes the official Team service, tools and Web action.
// The standalone Team profile adds the same loader ids again and can be toggled
// on from the upstream plugin gallery. Keep this preview's bundle list singular.
const previewManifestPath = join(profileDir, 'package.json');
const previewManifest = JSON.parse(await readFile(previewManifestPath, 'utf8'));
const normalizedManifest = withoutRedundantAgentTeamProfile(previewManifest);
if (normalizedManifest) {
  await writeFile(previewManifestPath, `${JSON.stringify(normalizedManifest, null, 2)}\n`);
  console.log('Removed redundant standalone Agent Team profile from preview; Praxis experts owns Team composition.');
}
// Pin the Profile to the same Harness family as the developer workspace. Without
// these overrides, caret ranges such as ^0.1.7-alpha.1 can float to 0.1.7-rc.*
await pinPreviewOverrides();
// Reinstall the pinned official Web bundle as well as the Praxis layers. An
// existing preview Profile may have been created by an older DSH release; its
// bundle list alone does not upgrade the packages that provide newly added Web
// surfaces such as Terminal and archived-session recovery.
await run('@deepseek-ai/dsh/lib/bin.js', ['plugin', '--profile', 'preview', 'add', baseSpec, webAppSpec, ...tarballs]);
// Boot and ConfigEditor share module-local registration in dsh-app-boot.
// Keep the official CLI in the Profile dependency graph as well: launching the
// workspace CLI beside separately installed Profile packages splits that state.
// Profiles disable automatic peer installation. The platform account adapter
// also needs its declared native account peer in this standalone runtime.
await run('pnpm/bin/pnpm.cjs', ['--dir', profileDir, 'add', '--save-exact', `@deepseek-ai/dsh@${cliVersion}`, `@deepseek-ai/dsh-deepseek-account@${cliVersion}`, '@deepseek-ai/cordis-plugin-group@1.0.4']);
await installOfficialPeers();
const installedBase = JSON.parse(await readFile(join(profileDir, 'node_modules/@deepseek-ai/dsh-base/package.json'), 'utf8'));
if (installedBase.version !== baseVersion) throw new Error(`Installed @deepseek-ai/dsh-base ${installedBase.version} does not match pinned ${baseVersion}.`);
const installedWebApp = JSON.parse(await readFile(join(profileDir, 'node_modules/@deepseek-ai/dsh-web-app/package.json'), 'utf8'));
if (installedWebApp.version !== webAppVersion) throw new Error(`Installed @deepseek-ai/dsh-web-app ${installedWebApp.version} does not match pinned ${webAppVersion}.`);
const installedLayout = JSON.parse(await readFile(join(profileDir, 'node_modules/@deepseek-ai/dsh-client-ui-layout/package.json'), 'utf8'));
if (installedLayout.version !== baseVersion) {
  throw new Error(`Preview UI floated to @deepseek-ai/dsh-client-ui-layout@${installedLayout.version}; expected ${baseVersion}.`);
}
// DSH scopes are module-instance local. Installing only the Web bundle
// beside a CLI-provided Base bundle can load two physical dsh-scope copies: the
// Agent consumers must resolve one shared scope module; otherwise new
// session fails as an "unscoped context". Resolve both consumers from the
// Profile and fail installation unless they share the exact same module file.
const profileRequire = createRequire(join(profileDir, 'package.json'));
const resolveProfileDependency = async (consumer, dependency) => {
  const consumerManifest = profileRequire.resolve(`${consumer}/package.json`);
  const consumerRequire = createRequire(consumerManifest);
  return realpath(consumerRequire.resolve(`${dependency}/package.json`));
};
const cliBoot = await resolveProfileDependency('@deepseek-ai/dsh', '@deepseek-ai/dsh-app-boot');
const settingsBoot = await resolveProfileDependency('@deepseek-ai/dsh-config-editor', '@deepseek-ai/dsh-app-boot');
if (cliBoot !== settingsBoot) throw new Error('Preview CLI and ConfigEditor resolve different dsh-app-boot instances; settings cannot persist.');
const loopScope = await resolveProfileDependency('@deepseek-ai/dsh-agent-loop', '@deepseek-ai/dsh-scope');
const presetScope = await resolveProfileDependency('@deepseek-ai/dsh-agent-preset-registry', '@deepseek-ai/dsh-scope');
if (loopScope !== presetScope) throw new Error(`Preview loaded split @deepseek-ai/dsh-scope instances: agent-loop=${loopScope}; agent-preset-registry=${presetScope}.`);
for (const { directory, manifest } of packages) {
  for (const face of ['.', './client']) {
    const entry = manifest.exports[face]?.default;
    if (!entry) continue;
    const expected = await readFile(join(root, directory, entry));
    const installed = await readFile(join(profileDir, 'node_modules', manifest.name, entry));
    if (!expected.equals(installed)) throw new Error(`Installed ${manifest.name} ${face} differs from the current build; refusing to report a successful preview update.`);
  }
}
console.log('Installed Skill, Expert, Connector, Office, Library, Projects, Vision and Praxis presentation as separate official Profile layers.');
console.log('Start the stopped preview with: corepack pnpm preview');
