# 开物 Praxis Desktop 安装说明（未签名 Alpha）

同事拿到的是 **GitHub Release** 里的安装包（标签形如 `desktop-v*`），不是浏览器预览，也不是社区版 DSH Desktop。

| 系统 | 下载哪个 |
|------|----------|
| Windows 10/11 x64 | `…windows-x64…Setup.exe` 或 `workdsh-*-win-x64.exe` |
| Mac Apple 芯片（M 系列） | `…macos-mac-arm64….dmg` |
| Mac Intel | `…macos-mac-x64….dmg` |

Release 附带 `SHA256SUMS`，下载后可对一下哈希。

## 安装

### Windows

1. 双击 Setup.exe，按向导安装（可改目录）。
2. 若出现 **SmartScreen /「未知发布者」**：选「更多信息」→「仍要运行」。这是 **未签名 Alpha** 的预期提示，不是病毒。
3. 开始菜单或桌面打开 **Praxis**。

### macOS

1. 打开 DMG，把 **Praxis** 拖到「应用程序」。
2. 首次打开若被拦截：
   - **系统设置 → 隐私与安全性** → 仍要打开；或
   - 右键应用 → 打开 → 确认。
3. 未签名包不会过 Apple 公证，上述步骤是正常流程。

## 升级 / 卸载注意

- 升级前建议备份：`~/.dsh`（Windows：`%USERPROFILE%\.dsh`）。
- 桌面种子会写入 profile `desktop`；若以前装过其他桌面实验版，残留 profile 可能导致启动失败，可先把 `~/.dsh/profiles/desktop` 改名备份再重开。
- 本 Alpha **无自动更新通道保证**；新版本再下 Release 安装包覆盖即可。

## 包里有什么

- 官方 Desktop 壳（Harness `dsh-v0.1.5-rc.1` 流水线产物）
- 预置开物插件：bundle、skills、access、audit、experts、office、identity-local，以及锁定的 `dsh-ui-appearance@0.1.10`
- 应用图标为仓库品牌 1024 PNG 生成的 icns / win 图标

装完应能直接打开工作台，无需再跑 `pnpm preview`。

## 如何再打一版（维护者）

1. 代码推到 `viccao-yue/Praxis`（或当前仓库）的 `main`。
2. 打标签并推送，例如：

   ```bash
   git tag desktop-v0.1.0-alpha.1
   git push mine desktop-v0.1.0-alpha.1
   ```

3. GitHub Actions 工作流 **Desktop** 会在 Windows + macOS Runner 上打三种包，并创建 **prerelease**。
4. 也可在 Actions 里手动 **Run workflow**，只打某一个 target 做冒烟。

本地单机（仅当前系统能打的目标）：

```bash
node scripts/desktop/ci-bootstrap-snapshot.mjs
corepack pnpm build
node scripts/desktop/ci-build-installer.mjs --target=mac-arm64   # 须 Apple Silicon
```

打包设计与补丁说明见 [DESKTOP-PACKAGING.md](DESKTOP-PACKAGING.md)；决策见 [ADR-0025](adr/0025-desktop-packaging-via-official-pipeline.md)。

## 已知限制

- **未签名**：正式分发需 Apple Developer ID + 公证，以及 Windows 代码签名；当前不做。
- 桌面宿主版本锁在 `dsh-v0.1.5-rc.1`，与仓库 Web 基线 `0.1.7-alpha.1` **不是同一版本族**（已知差异）。
- 本流程 **不使用** 社区 `dsh-plugin-desktop` Yarn 壳。
