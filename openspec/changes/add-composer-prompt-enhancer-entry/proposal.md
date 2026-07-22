## Why

Composer 的提示词增强已有 `Cmd+/` / `Ctrl+/` 快捷键和完整 dialog，但工具面板没有可发现的鼠标入口，用户难以获知并触发该能力。

## 目标与边界

- 在 Composer 工具面板顶部 quick-action row 的 completion email 之后增加提示词增强入口。
- 新入口与现有快捷键复用同一个 `handleEnhancePrompt` action 和 dialog contract。
- 增强进行中禁止重复触发，并保持 keyboard path 不变。
- Prompt enhancer provider 仅保留 `Claude Code` 与 `Codex`。
- 浅色主题 primary actions 使用清晰的蓝色状态层级，避免 loading/disabled 时退化成不可辨识灰块。
- Tool-popover quick actions 收敛为一致的 icon-only 视觉；回溯与输出折叠不再显示表层文字。
- 压缩 tool-popover 的纵向留白，减少顶部区域、菜单行和分隔组之间的空隙。

## 非目标

- 不修改 prompt enhancement runtime request、model、timeout 或结果替换逻辑。
- 不新增 backend API、persistent state 或第三方 dependency。
- 不调整工具面板其他入口的排列、行为和 accessible semantics。

## What Changes

- 在已经接收 `onEnhancePrompt` 与 `isEnhancing` 的 `ButtonArea` 中渲染 prompt enhancer icon button。
- 增加 focused component test，锁定入口可见、点击复用 action、loading 时禁用。
- 从 prompt enhancer engine allowlist 移除 `OpenCode`，并将 legacy/current OpenCode provider 安全归一化为 `Claude Code`。
- 为浅色主题 primary action 定义明确的 enabled / hover / disabled 蓝色状态。
- 将入口描述改为「输入框提示词增强」，并统一 quick-action icon button 的尺寸与表层文案策略。
- 收紧 menu padding、submenu trigger padding 与 separator margin，在不缩小 34px quick-action hit area 的前提下降低面板总高度。

## 方案对比

1. **推荐：复用 `ButtonArea` 现有 props**。`ButtonArea` 是 Radix menu owner，能在调用 action 前关闭 tool menu，且无需新增 prop drilling。
2. 扩展 `ContextBar` props。会把 callback/state 再透传一层，且 child 无法直接关闭 parent menu，拒绝。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `composer-prompt-enhancer`: 增加 Composer 工具面板中的显式触发入口。

## 验收标准

- 打开 Composer 工具面板时，附件与 completion email 后显示提示词增强 icon button。
- 点击按钮打开与 `Cmd+/` / `Ctrl+/` 相同的 prompt enhancer dialog。
- enhancement request 进行中按钮 disabled，避免重复触发。
- 按钮具有本地化 accessible name，现有快捷键行为不回归。
- Provider 下拉只显示 `Claude Code` 与 `Codex`，OpenCode 当前上下文打开 dialog 时默认选择 `Claude Code`。
- 浅色主题 enabled primary action 使用 `#2563eb`；disabled action 保留浅蓝状态和可读文字，不再显示为灰块。
- 提示词增强 tooltip 显示「输入框提示词增强」；回溯与输出折叠仅显示 icon，所有 icon-only quick actions 尺寸一致。
- 工具面板各组纵向节奏更紧凑，顶部 quick-action 和主要菜单行不再出现大块留白。

## Impact

- Frontend: `ButtonArea.tsx`、`ContextBar.tsx`、`usePromptEnhancer.ts`、Composer styles、i18n 及 focused tests。
- Behavior spec: `composer-prompt-enhancer` delta。
- API / backend / dependency: 无影响。
