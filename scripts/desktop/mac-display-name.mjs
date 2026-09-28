/**
 * Finder shows the .app filename under the icon. The outer bundle must be
 * 开物Praxis.app. CFBundleName stays Praxis so Electron still finds
 * "Praxis Helper.app".
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const MAC_BUNDLE_NAME = '开物Praxis.app';

function walkOutsideBundles(dir, visit) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    let info;
    try {
      info = statSync(path);
    } catch {
      continue;
    }
    if (!info.isDirectory()) {
      visit(path, name, false);
      continue;
    }
    if (name.endsWith('.app')) {
      visit(path, name, true);
      continue;
    }
    walkOutsideBundles(path, visit);
  }
}

/** Rename packaged Praxis.app bundles. Helper apps inside the bundle stay put. */
export function renamePackagedMacApps(root) {
  const apps = [];
  walkOutsideBundles(root, (path, name, isBundle) => {
    if (isBundle && name === 'Praxis.app') apps.push(path);
  });
  const renamed = [];
  for (const app of apps) {
    const target = join(dirname(app), MAC_BUNDLE_NAME);
    rmSync(target, { recursive: true, force: true });
    renameSync(app, target);
    renamed.push(target);
  }
  return renamed;
}

/** Replace product DMGs so the disk image contains 开物Praxis.app. */
export function rebuildMacInstallers(root, appPath) {
  if (!existsSync(appPath)) {
    throw new Error(`mac display name: missing ${appPath}`);
  }
  if (!existsSync(root)) return [];
  const dmgs = [];
  walkOutsideBundles(root, (path, name, isBundle) => {
    if (!isBundle && /^(?:workdsh-|开物Praxis).*\.dmg$/i.test(name)) dmgs.push(path);
  });
  if (dmgs.length === 0) return [];
  for (const dmg of dmgs) {
    const temporary = `${dmg}.renaming`;
    rmSync(temporary, { force: true });
    const result = spawnSync('hdiutil', [
      'create',
      '-volname', '开物Praxis',
      '-srcfolder', appPath,
      '-ov',
      '-format', 'ULFO',
      temporary,
    ], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      rmSync(temporary, { force: true });
      throw new Error(`hdiutil create failed for ${dmg} (${result.status})`);
    }
    rmSync(dmg, { force: true });
    rmSync(`${dmg}.blockmap`, { force: true });
    renameSync(temporary, dmg);
  }
  return dmgs;
}
