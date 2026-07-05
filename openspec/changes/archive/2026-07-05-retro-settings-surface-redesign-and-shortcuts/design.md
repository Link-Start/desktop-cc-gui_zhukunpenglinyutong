## Context

记录 settings redesign、shortcut recording、vendor panel colors、idle polling render stabilization、Claude thinking 当前行为。

Settings 不是静态表单，而是用户控制模型、快捷键、外观、供应商、运行时行为的配置中心。视觉重设计如果没有规范，很容易无意改变 persisted settings 语义。

## Decisions

- Shortcut recording 必须显式呈现 capture/edit/clear 状态。
- Vendor panel 颜色统一不能暗示 provider health 改变。
- Thinking visibility 作为当前行为记录，不当作永久产品判断。

## Risks And Guardrails

- 设置视觉重构改变了 serialized meaning。
- 快捷键录入误吞系统快捷键或未提示冲突。
- Thinking 强制可见与旧 spec 的用户控制存在张力，后续需专题处理。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-settings-surface-redesign-and-shortcuts --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
