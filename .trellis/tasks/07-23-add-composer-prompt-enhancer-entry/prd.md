# Composer 提示词增强入口

## Goal

关联 OpenSpec change：`add-composer-prompt-enhancer-entry`。在 Composer `+` 工具面板截图标注位置增加 prompt enhancer 入口，唤起现有 `Cmd+/` / `Ctrl+/` 能力。

## Requirements

- 入口位于 tool-popover quick-action row，紧跟 completion email。
- 点击复用现有 `handleEnhancePrompt`，不复制 state/dialog/runtime logic。
- 增强运行中入口 disabled。
- icon、tooltip、accessible name 遵循现有 Composer toolbar 与 i18n contract。
- Prompt enhancer provider 下拉只保留 Claude Code 与 Codex；OpenCode context 默认回退 Claude。
- Light theme primary actions 使用 `#2563eb` enabled 状态和浅蓝 disabled 状态。
- 简中入口描述为「输入框提示词增强」。
- 回溯与输出折叠删除表层文案，保留 tooltip/accessible name；icon-only quick actions 统一为 34×34。
- 压缩工具面板顶部、主要菜单行及 separator 的纵向留白，同时保留 34px icon-only 点击区域。

## Acceptance Criteria

- [x] 点击新入口打开现有 prompt enhancer dialog。
- [x] running state 下不能重复触发。
- [x] focused component test、typecheck、OpenSpec strict validation 通过。
- [x] OpenCode option 已移除，legacy OpenCode context 默认值合法。
- [x] Light theme primary action 不再呈现低对比灰块。
- [x] 提示词增强描述、回溯/输出折叠表层文案与 icon 样式完成统一。
- [x] 工具面板高度与行间留白完成压缩，交互和点击区域不回归。

## Technical Notes

- 复用 `ButtonArea` 已接收的 callback/state，增加 `WandSparkles` icon button。
- 复用 `chat.shortcutActionEnhance`，不新增 translation key；简中 copy 调整不改变 action contract。
