# Praxis port inventory (pre-reset snapshot)

## Already present on WorkDSH 3.0 tip (no port needed)
- 专家团 UI: upstream ExpertsPanel already shows 专家/专家团 (no TEAMS_UI_ENABLED gate)

## Must re-apply on WorkDSH tip
1. Branding: Brand.tsx + Hero/Sidebar lockups + assets + ShellAppearance CSS hides + harness title/favicon rewrite
2. AccountMenu: drop contact/signin; signed-out label=settings; click opens settings (patch against DSH shipped AccountMenu)
3. Preinstall: dsh-living-memory@0.2.10 (+ keep better-sidebar / dsh-im if still used in new pack pipeline)
4. Desktop product name / icons: 开物Praxis.app display name + brand icons
5. Optional copy: 专家→数字员工 (Praxis rename); upstream still says 专家
6. Enterprise login copy: keep `loginFailure` in `apps/desktop/src/enterprise-auth.ts` and the test `shows the admin license reason when login is forbidden`. On a non-401 login response, read Problem Details `detail` and show it. 401 stays `账号或密码不正确`. Do not add seat counts, license files, or signature checks to the desktop. After login, leave WorkDSH's `/api/auth/me` and collaboration bridge unchanged.

## Obsolete on WorkDSH 3.0 (do not force-merge)
- Entire scripts/desktop/patches against dsh-v0.1.7-alpha.1 snapshot packaging
- kaiwu-praxis pnpm root package shape

## Applied on upgrade/workdsh-3.0.0-alpha.3 (this branch)
- [x] Reset base to WorkDSH `origin/main` (= Desktop 3.0.0-alpha.3 line, DSH 0.2.1-rc.2)
- [x] Branding: Brand/Hero/Sidebar lockups + favicon/title rewrite + ShellAppearance
- [x] Seed `dsh-living-memory@0.2.10` via `CATALOG_PACKAGES`
- [x] 专家团: upstream already enables team UI (no TEAMS_UI gate)

## Applied (continued)
- [x] AccountMenu: `scripts/praxis/patch-account-menu.mjs` runs from `prepare-workdsh-runtime.mjs` after Profile install (drop 联系我们/登录; unsigned label=设置; click→openSettings). Reference TSX kept at `scripts/praxis/AccountMenu.tsx`.
- [ ] Enterprise login `detail`: uncommitted edit in `apps/desktop/src/enterprise-auth.ts`. Merge upstream, then keep `loginFailure` and its one call. Do not turn it into a runtime patch of `@deepseek-ai`.
- [x] Branch pushed: `mine/upgrade/workdsh-3.0.0-alpha.3` (@ `f9b7e1a38d` base + follow-up commits)

## Deferred (next commits on this branch)
- [ ] Desktop shell rename WorkDSH → 开物Praxis (app.setName / productName / DMG artifact) — touches many release tests
- [ ] 专家 → 数字员工 copy rename (optional product wording)
- [ ] dsh-better-sidebar / @xmanrui/dsh-im: re-evaluate under 3.0 (sidebar/workbench already different)
- [x] Smoke: `pack-workdsh-profile` + `prepare-workdsh-runtime` OK (DSH 0.2.1-rc.2; living-memory seeded; AccountMenu patched). Full Electron `dist:mac-smoke` still optional.
