# Spec Delta: client-design-system-zinc-primitives

## ADDED Requirements

### Requirement: Client UI primitives MUST use the shadcn/radix zinc baseline

系统 SHALL 将 `src/components/ui/**` 视为 shadcn/radix primitive 的 canonical layer，并使用 zinc-compatible tokens 表达默认 chrome、focus、border、popover surface。

#### Scenario: feature 需要通用控件

- **WHEN** feature 需要通用控件
- **THEN** 当 feature 需要 input/select/tab/tooltip/dialog/switch 等通用控件时，应优先复用 shared primitive；不得新建视觉和交互语义冲突的 parallel primitive。

#### Scenario: theme 切换

- **WHEN** theme 切换
- **THEN** 当 light/dark/system theme 切换时，shared primitives 必须保持文字可读、focus ring 可见、border/background 对比稳定。

### Requirement: Feature CSS MUST not fork shared primitive semantics

Feature CSS SHALL 只覆盖 feature-specific layout 或 domain style，不得重新定义 shared primitive 的基础 keyboard、focus、disabled、popover 语义。

#### Scenario: 局部样式覆盖 shared primitive

- **WHEN** 局部样式覆盖 shared primitive
- **THEN** 当 feature 需要微调 spacing 或宽度时，可以通过 className/变量调整布局；不得覆盖基础 disabled、focus-visible、aria interaction 语义。
