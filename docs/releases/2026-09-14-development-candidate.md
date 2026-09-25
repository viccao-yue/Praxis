# 2026-09-14 Alpha Web release

## 2026-09-14 Alpha Web release / 最新预览发行

本批通过8个精确安装包的隔离官方Web Profile安装、两次冷启动、匿名401/认证200、活动插件移除及全部模块移除后冷启动。完整构建、115项集成测试、9项活动测试通过。验证环境：Harness 0.1.5-rc.1，Node 22.23.2，macOS。专家团TM-01、真实长任务状态切换及多平台整体验收尚未完成。

| 模块 | 安装包版本 | 下载 |
| --- | --- | --- |
| experts | `Praxis-plugin-experts@0.1.0-alpha.2` | Release · tgz |
| skills | `Praxis-plugin-skills@0.1.0-alpha.28` | Release · tgz |
| activity | `Praxis-plugin-activity@0.1.0-alpha.1` | Release · tgz |
| office | `Praxis-plugin-office@0.1.0-alpha.4` | Release · tgz |
| bundle | `Praxis-bundle@0.1.0-alpha.41` | Release · tgz |

下载所需tgz后，使用官方CLI：`dsh plugin --profile <profile> add /absolute/path/<package>.tgz`。基础身份、审计与授权配套见专家发行附件；各模块独立安装。仅发布GitHub alpha附件，未发布npm注册表。Office依赖引用与声明许可证见下文；现有notice及检查报告保留。


最新8包及摘要位于 `.artifacts/release-submit-2026-09-14`。专家发行带基础身份/审计/授权配套；其他模块分别建立独立tag与Release。公开附件配套SHA256SUMS及源提交manifest。

许可证文本收集仍记录10项缺失；按用户明确要求不作为本次阻塞，README列出项目来源与声明许可证，完整199项Office依赖清单见[依赖记录](../evidence/office-bundled-dependencies-2026-09-14.md)。不宣称许可证正文收集通过。
