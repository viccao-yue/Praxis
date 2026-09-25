# 开物Praxis 视觉增强

为纯文本主模型补上“看图”能力：粘贴或拖入的图片先由视觉模型转写为文字，再交给主模型继续对话；并提供 `vision_analyze` 工具。

## 官方能力复用记录

| 项 | 内容 |
| --- | --- |
| 任务 | 用户授权专项：视觉增强插件（可启停），不挤占 D04 主线 |
| 官方文档 | `docs/dsh-v0.1.7-alpha.1/docs/user/guide/providers.md`（`input` / `inputModalities`）、`llm/stream` waterfall、`settings.section` |
| 发布包 | 精确依赖社区已发布 `dsh-vision-plugin@1.4.0`（MIT）；Host 在 `enabled=true` 时调用其 `apply` |
| 开物差异 | Cordis `Config.enabled` 启停；设置页「视觉增强」配置默认视觉模型；不复制第二套转写引擎 |
| 验收 | Preview 安装后 Plugins 可关 `enabled`；设置页可选模型；关闭后不再注册转写与工具 |

## 启停

1. **推荐**：设置 → 插件 → 找到 `workdsh-vision` / 开物视觉增强 → 关闭或打开 `enabled`。
2. 也可在 Profile 的 `cordis.patch.yml` 将本行设为 `disabled: true`（整行卸载，含设置页）。

默认 `enabled: true`。关闭后不挂 `llm/stream` 转写，也不注册 `vision_analyze`。

## 使用注意

- 需要至少一个**真正支持图片**的视觉模型已在 Harness 路由中配置（插件自动发现）。
- 纯文本主模型要能“收下”粘贴图片，还需在模型设置中声明图片输入（`input: [text, image]` 或 DeepSeek 适配器的 `inputModalities`），否则宿主会在转写前拒收。
- 引擎 README 标注兼容 dsh rc.7/rc.8；本仓库基线为 `0.1.7-alpha.1`，以 Preview 实测为准。

## 边界

- 不另建 Agent loop / 模型路由。
- 不把凭据写入对话或导出。
- 不替代官方原生多模态模型直通路径（真正支持图片的模型仍可直接看图）。
