# 开物Praxis 桌面打包（官方流水线）

基于官方 `deepseek-ai/deepseek-harness` 仓库 `apps/desktop`（tag `dsh-v0.1.5-rc.1`）的隔离快照，
经 `WORKDSH TEST PATCH` 补丁产出 **Praxis** 未签名桌面端。

- **同事安装**：见 [docs/DESKTOP-INSTALL.md](../../docs/DESKTOP-INSTALL.md)
- **打包指南**：见 [docs/DESKTOP-PACKAGING.md](../../docs/DESKTOP-PACKAGING.md)
- **CI 三包**：`.github/workflows/desktop.yml`（标签 `desktop-v*`）

未签名 Alpha 仅供内测；正式分发需 Apple Developer ID / Windows 代码签名并停用 `WORKDSH_DESKTOP_UNSIGNED`。

## 本地快速使用

```bash
# 本机已有快照与种子时：只重打 .app 目录
node scripts/desktop/pack-desktop.mjs
node scripts/desktop/pack-desktop.mjs --restart
node scripts/desktop/pack-desktop.mjs --skip-build
node scripts/desktop/pack-desktop.mjs --check-only
node scripts/desktop/pack-desktop.mjs --sync-patches

# 多目标 / 安装包（须对应 OS 宿主）
node scripts/desktop/pack-desktop.mjs --target=mac-arm64 --installer
node scripts/desktop/pack-desktop.mjs --target=mac-x64 --installer
node scripts/desktop/pack-desktop.mjs --target=win-x64 --installer
```

## CI / 完整准备序列

```bash
node scripts/desktop/ci-bootstrap-snapshot.mjs   # 拉官方 tag + 应用补丁 + Win PNG 图标
corepack pnpm build
node scripts/desktop/ci-build-installer.mjs --target=mac-arm64
# → .artifacts/desktop-installers/<target>/
```

`ci-build-installer.mjs` 会：安装快照依赖 → 打种子 tarball → `build:desktop` → 官方 `package:<target>`（prepare + electron-builder）。

## 脚本清单

| 文件 | 用途 |
|------|------|
| `pack-desktop.mjs` | 本地/校验入口；`--target` / `--installer` |
| `ci-bootstrap-snapshot.mjs` | 下载官方快照并应用 `patches/upstream` |
| `ci-pack-plugins.mjs` | 将开物 7 包 + `dsh-ui-appearance@0.1.10` 打入 `packed/workdsh` |
| `ci-build-installer.mjs` | CI 用完整准备 + 安装包 |
| `patches/upstream/` | WORKDSH TEST PATCH 存档（含 `workdsh-icon.icns`） |

产物路径示例：`.artifacts/desktop-pack-test/upstream/apps/desktop/.desktop-build/targets/mac-arm64/artifacts/`
