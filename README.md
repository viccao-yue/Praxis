<p align="center"><img src="assets/brand/praxis-favicon.png" width="80" alt="开物Praxis"></p>
<h1 align="center">开物Praxis</h1>
<p align="center"><strong>Give the work to AI. See the process. Keep the result.</strong></p>
<p align="center">English · <a href="README.zh-CN.md">简体中文</a></p>

开物Praxis is an AI workspace for everyday work. Conversations, material, and capabilities stay in one project. You can watch a task proceed, then open and keep editing the result.

## What you can do

| Area | What it does |
| --- | --- |
| Projects | Keep tasks, plans, assets, and activity together, and choose that project's capabilities from the conversation. |
| Library | Import local material, browse, search, and preview it, then cite a chosen revision in a task. |
| Skills and experts | Install reusable skills and publish experts with a pinned capability revision. |
| Connectors | Configure an external service and choose exactly which one a task may use. |
| Deliverables | Preview and edit document, presentation, spreadsheet, web, and PDF working copies beside the task. Fidelity differs by format. |
| Activity | Inspect the task and how people collaborated. An expert-team name does not by itself mean several members are running. |

## Run from source

Node.js `^22.19.0` or `>=24`, and pnpm from Corepack.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm preview:install
corepack pnpm preview
```

The preview listens on port `8517`. Stop anything already running, and keep your own recoverable backup first.

## Development

Features plug into the official runtime. This repository does not ship a modified copy of that runtime. Each module owns its data; the bundle only composes navigation and presentation.

```sh
corepack pnpm typecheck
corepack pnpm test:integration
corepack pnpm check:versions
```

[Architecture](docs/ARCHITECTURE.md) · [Module versions](docs/MODULE-VERSIONS.md) · [Status](docs/STATUS.md) · [Roadmap](docs/ROADMAP.md)

This is an alpha. Cross-platform installers, long-running collaboration on a real model, faithful layout for arbitrary office files, and multi-user governance are not fully accepted yet.

## Acknowledgements

Thanks to these projects and their maintainers. The table lists the main direct dependencies. Package metadata and the lockfile are the full inventory.

| Project | Use | License |
| --- | --- | --- |
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) / Cordis | Tasks, model execution, skill discovery, plugin loading, and UI extension | MIT |
| [React](https://github.com/facebook/react) | Pages and editors | MIT |
| [Tiptap](https://github.com/ueberdosis/tiptap) / [ProseMirror](https://github.com/ProseMirror) | Document working-copy editing | MIT |
| [pptx-viewer](https://github.com/ChristopherVR/pptx-viewer) | Presentation parsing, editing, and export | Apache-2.0 |
| [docx](https://github.com/dolanmiu/docx) / [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) | Document generation and layout preview | MIT / Apache-2.0 |
| [Univer](https://github.com/dream-num/univer) / [ExcelJS](https://github.com/exceljs/exceljs) | In-development spreadsheet adapters, not a finished online spreadsheet | Apache-2.0 / MIT |
| [Lucide](https://github.com/lucide-icons/lucide) | Presentation toolbar icons | ISC |

Third-party skills and materials keep their providers' terms. Copyright and license text bundled with the office build is in [Office third-party notices](packages/plugins/office/THIRD-PARTY-NOTICES.md).
