# Praxis port inventory (pre-reset snapshot)

## Already present on WorkDSH 3.0 tip (no port needed)
- 专家团 UI: upstream ExpertsPanel already shows 专家/专家团 (no TEAMS_UI_ENABLED gate)

## Must re-apply on WorkDSH tip
1. Branding: Brand.tsx + Hero/Sidebar lockups + assets + ShellAppearance CSS hides + harness title/favicon rewrite
2. AccountMenu: drop contact/signin; signed-out label=settings; click opens settings (patch against DSH shipped AccountMenu)
3. Preinstall: dsh-living-memory@0.2.10 (+ keep better-sidebar / dsh-im if still used in new pack pipeline)
4. Desktop product name / icons: 开物Praxis.app display name + brand icons
5. Optional copy: 专家→数字员工 (Praxis rename); upstream still says 专家

## Obsolete on WorkDSH 3.0 (do not force-merge)
- Entire scripts/desktop/patches against dsh-v0.1.7-alpha.1 snapshot packaging
- kaiwu-praxis pnpm root package shape

## Applied on upgrade/workdsh-3.0.0-alpha.3 (this branch)
- [x] Reset base to WorkDSH `origin/main` (= Desktop 3.0.0-alpha.3 line, DSH 0.2.1-rc.2)
- [x] Branding: Brand/Hero/Sidebar lockups + favicon/title rewrite + ShellAppearance
- [x] Seed `dsh-living-memory@0.2.10` via `CATALOG_PACKAGES`
- [x] 专家团: upstream already enables team UI (no TEAMS_UI gate)

## Deferred (next commits on this branch)
- [ ] AccountMenu (联系我们/登录隐藏 + 设置直达) against DSH 0.2.1 AccountMenu source
- [ ] Desktop shell rename WorkDSH → 开物Praxis (app.setName / productName / DMG artifact) — touches many release tests
- [ ] 专家 → 数字员工 copy rename (optional product wording)
- [ ] dsh-better-sidebar / @xmanrui/dsh-im: re-evaluate under 3.0 (sidebar/workbench already different)
