# 工作台

状态：**D02 本地展示基线完成，0.1.0-alpha.12**。主任务 P1-01；后续业务联动未实现。

工作区、会话、新会话、搜索、筛选、创建工作区、工作区菜单、会话菜单和设置全部保留 Harness 官方 Sidebar occupant。开物Praxis 不替换整块 sidebar，也不复制这些行为；通过公开 Slot 增量加入助理、项目、专家、“技能 · 连接器”、定时任务、资料库和更多。专家单独贡献侧栏入口（位于项目下方）；技能与连接器保持一个入口，内部再分标签。新任务继续使用原生 Conversation，因此 `/`、`@`、附件、权限、模型和 preset 均由 Harness 处理。

规范与边界见 [UI 规范](../../../docs/UI-DESIGN.md)、[公共外壳证据](../../../docs/evidence/workbench-sidebar.md)、[ADR 0014](../../../docs/adr/0014-workbench-sidebar-presentation.md)。

本版本导出标准 `name/inject/apply`，由 bundle 使用官方 `ctx.plugin(workbench)` 注册，具有独立子插件生命周期；仍编译进展示产物，尚无独立 `dsh.bundle` 安装层，不宣称已独立分发。专家入口由 Expert Client 贡献，“技能 · 连接器”入口由 Skill Client 贡献，工作台不再保留失效入口。

Harness 装配位于 `src/harness/client.ts`，页面结构位于独立 TSX 组件，样式位于独立模块；公开 `src/index.ts` 不再混合界面结构。领域入口目前只展示清晰的未接入状态，不伪造团队权限、业务对象或管理能力。
