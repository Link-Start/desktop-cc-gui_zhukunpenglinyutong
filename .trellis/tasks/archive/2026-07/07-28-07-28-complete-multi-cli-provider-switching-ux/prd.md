# 补全多 CLI Provider 切换 UX

关联 OpenSpec change：`complete-multi-cli-provider-switching-ux`

## 目标

将 Change A–D 已存在的底层能力补成用户可见、可选、可追溯的完整 UX，修复验收截图中的 Provider/Model 选择缺失、Kimi 静默隐藏、原生确认框、raw marker 标题与消息、来源不可导航问题。

## 范围

- Shared Session 四级 target picker。
- Native Provider Continuation 产品内 Dialog。
- Kimi capability boundary 的显式展示。
- Continuation 可读标题、上下文卡片、来源跳转。
- 自动化测试、指导文档与人工验收计划。

## Gate

- 不伪造未验证的 Kimi target 能力。
- 不改变 ACK/checksum/recovery 契约。
- 不新增依赖。
- 只跑相关整体测试，不跑无关全量测试。
