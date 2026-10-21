#!/usr/bin/env node
/**
 * Praxis AccountMenu patch against shipped @deepseek-ai/dsh-client-ui-settings-account.
 *
 * Upstream shows 联系我们 / 登录 and uses signedOut as the collapsed label.
 * Praxis: drop contact + sign-in rows; unsigned label = settings; click opens settings.
 *
 * Usage:
 *   node scripts/praxis/patch-account-menu.mjs <profile-or-package-root>
 *   node scripts/praxis/patch-account-menu.mjs --self-test
 */
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MARKER = '/* praxis-account-menu-patched */'

/** Apply Praxis AccountMenu behavior to a compiled settings-account client bundle. */
export function patchAccountMenuSource(source) {
  if (source.includes(MARKER)) return { source, changed: false, already: true }

  let next = source
  const steps = []

  const signedOut = 'signedIn ? label : t("signedOut")'
  if (!next.includes(signedOut)) throw new Error('AccountMenu patch: signedOut label pattern missing')
  next = next.replaceAll(signedOut, 'signedIn ? label : t("settings")')
  steps.push('label→settings')

  const toggle = 'onClick: () => {\n\t\t\t\t\t\t\t\tsetOpen((value) => !value);\n\t\t\t\t\t\t\t}'
  const openSettingsClick = 'onClick: () => {\n\t\t\t\t\t\t\t\tif (signedIn) setOpen((value) => !value);\n\t\t\t\t\t\t\t\telse openSettings();\n\t\t\t\t\t\t\t}'
  if (next.includes(toggle)) {
    next = next.replace(toggle, openSettingsClick)
    steps.push('click→openSettings')
  } else if (next.includes('setOpen((value) => !value)')) {
    next = next.replace(
      /onClick:\s*\(\)\s*=>\s*\{\s*setOpen\(\(value\)\s*=>\s*!value\);\s*\}/,
      'onClick: () => { if (signedIn) setOpen((value) => !value); else openSettings(); }',
    )
    steps.push('click→openSettings(loose)')
  } else {
    throw new Error('AccountMenu patch: toggle onClick pattern missing')
  }

  const contactBlock = /\{\s*id:\s*"contact",\s*label:\s*t\("contactUs"\),[\s\S]*?\},/
  if (!contactBlock.test(next)) throw new Error('AccountMenu patch: contact menu item missing')
  next = next.replace(contactBlock, '')
  steps.push('drop-contact')

  const signInBranch = /\.\.\.signedIn\s*\?\s*\[\{[\s\S]*?id:\s*"signout"[\s\S]*?\}\]\s*:\s*\[\{[\s\S]*?id:\s*"signin"[\s\S]*?\}\]/
  if (!signInBranch.test(next)) throw new Error('AccountMenu patch: signin/signout branch missing')
  next = next.replace(signInBranch, (match) => match.replace(/:\s*\[\{[\s\S]*?id:\s*"signin"[\s\S]*?\}\]/, ': []'))
  steps.push('drop-signin')

  next = next.replace(/\s*else if \(id === "contact"\) \{\s*setOpen\(false\);\s*contactUs\(\);\s*\}/g, '')
  next = next.replace(/\s*else if \(id === "signin"\) beginSignIn\(\);/g, '')
  next = next.replace(/,\s*contactUs(?=\s*,)/, '')
  next = next.replace(/const beginSignIn = \(\) => \{[\s\S]*?\};\n/, '')

  // Assert only inside AccountMenu — AccountSection may still show signedOut.
  const menuStart = next.indexOf('function AccountMenu(')
  const menuEnd = next.indexOf('//#endregion', menuStart)
  const menu = menuStart >= 0 && menuEnd > menuStart ? next.slice(menuStart, menuEnd) : next
  if (menu.includes('id: "contact"') || menu.includes('id: "signin"') || menu.includes('t("signedOut")')) {
    throw new Error('AccountMenu patch: residual contact/signin/signedOut markers remain in AccountMenu')
  }
  if (!menu.includes('else openSettings()') && !menu.includes('else openSettings();')) {
    throw new Error('AccountMenu patch: openSettings click missing after transform')
  }

  next = MARKER + '\n' + next
  return { source: next, changed: true, already: false, steps }
}

function resolveClientBundle(root) {
  const candidates = [
    join(root, 'node_modules/@deepseek-ai/dsh-client-ui-settings-account/lib/client.js'),
    join(root, 'lib/client.js'),
    join(root, 'client.js'),
  ]
  for (const path of candidates) {
    if (existsSync(path)) return realpathSync(path)
  }
  const pnpm = join(root, 'node_modules/.pnpm')
  if (existsSync(pnpm)) {
    for (const entry of readdirSync(pnpm)) {
      if (!entry.startsWith('@deepseek-ai+dsh-client-ui-settings-account@')) continue
      const path = join(pnpm, entry, 'node_modules/@deepseek-ai/dsh-client-ui-settings-account/lib/client.js')
      if (existsSync(path)) return realpathSync(path)
    }
  }
  throw new Error('AccountMenu patch: dsh-client-ui-settings-account client.js not found under ' + root)
}

export function patchAccountMenuAt(root) {
  const file = resolveClientBundle(root)
  const before = readFileSync(file, 'utf8')
  const result = patchAccountMenuSource(before)
  if (result.changed) writeFileSync(file, result.source)
  return { file, ...result }
}

function selfTest() {
  const sample = `
		function AccountMenu({ wide, openSettings, openOnboarding, useAccount, signOut, contactUs, showLogin, start, cancel, t }) {
			const beginSignIn = () => {
				setOpen(false);
				start().catch(() => void 0);
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				children: [
					(0, react_jsx_runtime.jsx)(Menu, {
						anchor: (0, react_jsx_runtime.jsxs)("button", {
							onClick: () => {
								setOpen((value) => !value);
							},
							children: [wide && (0, react_jsx_runtime.jsx)("span", {
								children: signedIn ? label : t("signedOut")
							})]
						}),
						items: [
							{ id: "settings", label: t("settings") },
							{
								id: "contact",
								label: t("contactUs"),
								icon: (0, react_jsx_runtime.jsx)(Icon, { size: 16 })
							},
							...signedIn ? [{
								id: "signout",
								label: t("signOut"),
								disabled: busy
							}] : [{
								id: "signin",
								label: t("signIn"),
								icon: (0, react_jsx_runtime.jsx)(Icon, { size: 16 })
							}]
						],
						onSelect: (id) => {
							if (id === "settings") {
								setOpen(false);
								openSettings();
							} else if (id === "contact") {
								setOpen(false);
								contactUs();
							} else if (id === "signin") beginSignIn();
							else logout();
						}
					})
				]
			});
		}
`
  const once = patchAccountMenuSource(sample)
  if (!once.changed) throw new Error('self-test: expected change')
  const twice = patchAccountMenuSource(once.source)
  if (!twice.already) throw new Error('self-test: expected idempotent skip')
  if (once.source.includes('id: "contact"')) throw new Error('self-test: contact row still present')
  if (!once.source.includes('t("settings")') || once.source.includes('t("signedOut")')) {
    throw new Error('self-test: settings label missing')
  }
  if (!once.source.includes('else openSettings()')) throw new Error('self-test: openSettings click missing')
  console.log('patch-account-menu self-test ok:', once.steps.join(', '))
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = process.argv.slice(2)
  if (args[0] === '--self-test') {
    selfTest()
  } else if (!args[0]) {
    console.error('Usage: node scripts/praxis/patch-account-menu.mjs <profile-or-package-root> | --self-test')
    process.exit(2)
  } else {
    const result = patchAccountMenuAt(args[0])
    console.log(result.already ? 'AccountMenu already patched:' : 'AccountMenu patched:', result.file)
    if (result.steps) console.log('steps:', result.steps.join(', '))
  }
}
