# 开物Praxis 品牌资产

开物Praxis 主标识使用向上展开的折叠式 `W`，右上角单个四角星表示智能辅助。图形保持单一轮廓和有限色彩，面向 Windows、Linux、macOS、Web、GitHub、文档和深色产品界面。

- `assets/brand/workdsh-mark.svg`：透明背景主标，适合产品内、README 与单色延展。
- `assets/brand/workdsh-logo.svg`：带圆角底座的应用图标，适合启动器与仓库头像。
- `assets/brand/workdsh-logo-concept.png`：桌面应用图标源图（当前为 1024×1024 开关形渐变标，黑底）。
- `assets/brand/praxis-desktop-icon-1024.png`：同上源图的桌面专用副本，便于打包脚本引用。
- `scripts/desktop/patches/upstream/apps/desktop/workdsh-icon.icns`：由上述 1024 源图经 `sips` + `iconutil` 生成的 macOS Dock / `.app` 图标（10 档 iconset）。

正式 Web 界面优先使用 SVG。小于 24px 时只使用主标，不附加产品文字。桌面安装包 / Dock 使用 `workdsh-icon.icns`；更换桌面图标时替换 1024 PNG 后重新生成 icns 并同步补丁存档。