<p align="center"><img src="assets/brand/praxis-logo.png" width="80" alt="开物Praxis"></p>
<h1 align="center">开物Praxis</h1>
<p align="center"><strong>把工作交给 AI，看清过程，拿到成果。</strong></p>
<p align="center"><a href="README.md">English</a> · 简体中文</p>

开物Praxis 是面向日常工作的 AI 工作台。对话、资料和能力放在同一个项目里；任务进行时能看到过程，结束后能打开并继续编辑成果。

## 可以做什么

| 功能 | 说明 |
| --- | --- |
| 项目 | 把任务、计划、资产和活动记在一处，并在对话里选用这个项目的能力。 |
| 资料库 | 导入本地资料，浏览、搜索、预览，再把选定版本引用到任务中。 |
| 技能与数字员工 | 安装可复用技能，发布带固定能力修订的数字员工。 |
| 连接器 | 配置外部服务，并明确这次任务要用哪一项。 |
| 成果 | 在任务旁预览和编辑文档、演示文稿、表格、网页和 PDF 工作副本。不同格式的保真程度不一样。 |
| 活动 | 查看任务和协作过程。名称里出现专家团，并不表示多名成员已经在执行。 |

## 从源码运行

需要 Node.js `^22.19.0` 或 `>=24`，以及 Corepack 提供的 pnpm。

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm preview:install
corepack pnpm preview
```

预览默认在本机 `8517` 端口打开。已有环境先停掉正在运行的进程，并自行保留可恢复的备份。

## 开发

业务能力以插件接入官方运行时，不另维护一份修改过的上游程序。各模块拥有自己的数据；整合包只负责导航和展示。

```sh
corepack pnpm typecheck
corepack pnpm test:integration
corepack pnpm check:versions
```

[架构](docs/ARCHITECTURE.md) · [模块版本](docs/MODULE-VERSIONS.md) · [当前状态](docs/STATUS.md) · [路线图](docs/ROADMAP.md)

当前是 Alpha。跨平台安装包、长时间真实模型协作、任意办公文件的版式保真，以及多人治理，都还没有完整验收。

## 致谢

感谢这些项目和维护者。下表只列主要直接依赖，完整清单以各包说明和锁文件为准。

| 项目 | 用途 | 许可 |
| --- | --- | --- |
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) / Cordis | 任务、模型执行、技能发现、插件加载与界面扩展 | MIT |
| [React](https://github.com/facebook/react) | 页面与编辑器 | MIT |
| [Tiptap](https://github.com/ueberdosis/tiptap) / [ProseMirror](https://github.com/ProseMirror) | 文档工作副本的编辑 | MIT |
| [pptx-viewer](https://github.com/ChristopherVR/pptx-viewer) | 演示文稿的解析、编辑与导出 | Apache-2.0 |
| [docx](https://github.com/dolanmiu/docx) / [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) | 文档生成与版式预览 | MIT / Apache-2.0 |
| [Univer](https://github.com/dream-num/univer) / [ExcelJS](https://github.com/exceljs/exceljs) | 开发中的表格适配，不是已交付的完整在线表格 | Apache-2.0 / MIT |
| [Lucide](https://github.com/lucide-icons/lucide) | 演示文稿工具栏图标 | ISC |

第三方技能和素材仍遵循其提供者的许可。办公相关构建产物中的版权与许可文本见 [Office 第三方声明](packages/plugins/office/THIRD-PARTY-NOTICES.md)。
