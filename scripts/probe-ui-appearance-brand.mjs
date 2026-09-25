/**
 * Brand + dsh-ui-appearance coexistence smoke on the running preview (:8517).
 * Checks: plugin present, settings surface opens, Praxis sidebar lockup survives,
 * ShellAppearance divider rules still apply, no pageerror.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const outDir = '.artifacts/ui-appearance-brand';
await mkdir(outDir, { recursive: true });

const login = process.env.WORKDSH_PREVIEW_URL
  ?? (await readFile('/Users/viccao/.cursor/projects/Users-viccao-Desktop-Praxis/terminals/729270.txt', 'utf8')
    .catch(() => '')).match(/http:\/\/127\.0\.0\.1:(?:8517|18989)\/\?token=[\w-]+/)?.[0];
if (!login) throw new Error('Preview URL with token not found; set WORKDSH_PREVIEW_URL or keep preview terminal log.');

const profile = JSON.parse(await readFile('.test-runtime/preview/profiles/preview/package.json', 'utf8'));
const dep = profile.dependencies?.['dsh-ui-appearance'];
const inBundles = (profile.dsh?.profile?.bundles ?? []).includes('dsh-ui-appearance');
if (dep !== '0.1.10' || !inBundles) {
  throw new Error(`preview profile missing pinned appearance: dep=${dep} bundles=${inBundles}`);
}

const browser = await chromium.launch();
const notes = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(login, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const lockup = page.locator('[data-praxis-sidebar-lockup]');
  await expect(lockup).toBeVisible({ timeout: 15000 });
  notes.push('sidebar lockup visible');

  // Open settings — label may be Settings / 设置
  const settings = page.getByRole('button', { name: /Settings|设置/i }).first();
  await settings.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/settings-open.png` });

  // Appearance plugin contributes general/appearance controls; search Chinese or English hints.
  const appearanceHint = page.getByText(/外观|壁纸|毛玻璃|Appearance|Wallpaper|Glass|主题色/i).first();
  const appearanceVisible = await appearanceHint.isVisible().catch(() => false);
  notes.push(appearanceVisible ? 'appearance controls visible in settings' : 'appearance text not found (may be nested under General)');
  await page.screenshot({ path: `${outDir}/settings-scan.png` });

  // Close settings if a close control exists
  const close = page.getByRole('button', { name: /Close|关闭|✕|×/i }).first();
  if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});

  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.waitForTimeout(300);
    const border = await page.locator('[class$="_sidebarCol"]').evaluate((node) => getComputedStyle(node).borderRightColor);
    expect(border).toBe('rgba(0, 0, 0, 0)');
    await expect(page.locator('[data-praxis-sidebar-lockup]')).toBeVisible();
    await page.screenshot({ path: `${outDir}/home-${theme}.png` });
    notes.push(`ShellAppearance divider transparent + lockup ok (${theme})`);
  }

  expect(errors).toEqual([]);
  await writeFile(`${outDir}/NOTES.md`, [
    '# dsh-ui-appearance brand smoke',
    '',
    `- preview dep: dsh-ui-appearance@${dep}`,
    `- bundles includes appearance: ${inBundles}`,
    ...notes.map((line) => `- ${line}`),
    `- pageerror: ${errors.length}`,
    '',
  ].join('\n'));
  console.log('PASS ui-appearance brand smoke');
  console.log(notes.join('\n'));
} finally {
  await browser.close();
}
