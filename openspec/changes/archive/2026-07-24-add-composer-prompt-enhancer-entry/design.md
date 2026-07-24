## Context

`ChatInputBox` 已通过 `usePromptEnhancer` 生成 `handleEnhancePrompt`，keyboard handlers 和 shortcut action 都调用该 action。Composer `+` 工具面板顶部的 quick-action row 由 `ContextBar surface="tool-popover"` 渲染，目前包含附件、completion email、live controls 与 rewind。

## Goals / Non-Goals

**Goals:**

- 在 completion email 后增加可发现的 prompt enhancer icon button。
- 保持所有 trigger 共享同一 action、dialog state 和 lifecycle guard。
- 保持 tool-popover 的现有视觉与 accessibility contract。
- Prompt enhancer 的 selectable engines 收敛为 Claude / Codex。
- Light theme primary actions 使用固定的经典蓝状态层级，dark theme 保持现状。
- Tool-popover 中的回溯、输出折叠和提示词增强使用一致的 icon-only button contract。
- Tool-popover 使用紧凑纵向 rhythm，减少重复 padding 与 separator margin。

**Non-Goals:**

- 不改变 enhancer runtime request contract。
- 不增加新 state、effect、dependency 或 backend 调用。
- 不重新设计 tool-popover。

## Decisions

### 1. 入口归 `ButtonArea` 所有

`ChatInputBoxFooter` 已将 `onEnhancePrompt` 和 `isEnhancing` 传给 `ButtonArea`。`ButtonArea` 直接在 `toolSurface` 后渲染按钮，并在调用 action 前关闭自己拥有的 Radix menu。

Alternative：扩展 `ContextBar` props 并在 child 中渲染。该方案增加 prop drilling，且 child 无法直接关闭 parent Radix menu，拒绝。

### 2. 复用现有 action 与 i18n key

点击直接调用 `onEnhancePrompt`；accessible name 和 tooltip 使用已有 `chat.shortcutActionEnhance`，简中 copy 收敛为「输入框提示词增强」。不创建 adapter callback、不复制 dialog state。

Alternative：新增专用 event bus 或 translation key。当前只有单一调用点和现成 copy，增加实体没有价值。

### 3. Loading 时在 trigger 层阻止重复点击

`isEnhancing` 映射到 button `disabled`，同时底层 hook 继续保留 lifecycle safety，形成 UI guard + domain guard。

### 4. 在 engine allowlist 根部移除 OpenCode

`PROMPT_ENHANCER_ENGINE_OPTIONS` 只保留 `claude` / `codex`，`normalizeEnhancerEngine` 对 OpenCode 等非 allowlist provider 回退到 Claude，provider type guard 同步收窄。这样 UI、state 和 runtime selection 保持一致。

Alternative：只在 `PromptEnhancerDialog` 过滤 option。会留下 `selectedEngine="opencode"` 与 option list 不匹配的非法 select state，拒绝。

### 5. Light theme primary action 使用局部状态色

仅在 `:root[data-theme="light"] .prompt-enhancer-btn.primary` 范围覆盖 enabled / hover / disabled：主色 `#2563eb`，disabled 为浅蓝底与蓝灰文字并取消通用 opacity。Dark theme 和全局 `--button-primary` 不受影响。

Alternative：修改全局 `--button-primary`。影响所有 Composer controls，范围过大，拒绝。

### 6. Quick actions 采用 icon-only surface contract

回溯与输出折叠移除表层 `context-tool-label`，继续保留现有 tooltip、`aria-label` 和 `aria-pressed`。菜单内 `.context-tool-btn` 默认固定为 34×34；只有显式带 `context-tool-btn--labeled` 的附件等 action 才保留自适应宽度。

Alternative：分别给三个按钮写尺寸 override。会形成重复 selector 和后续 drift，拒绝。

### 7. 在 CSS contract 层压缩菜单高度

保持 quick-action button 为 34×34，只压缩 `.composer-tool-menu` 外层 padding、`.composer-tool-menu-sub-trigger` 纵向 padding、顶栏底部 padding 和 direct separator margin。这样不改 DOM、不影响 Radix keyboard behavior，也不会压缩文字 line-height。

Alternative：逐个修改 Agent、Plan、Speed、Fork 等 component。会重复相同 spacing 规则并扩大 diff，拒绝。

## Risks / Trade-offs

- [按钮只在 tool-popover 可见] → 符合用户指定位置；快捷键继续提供高速路径。
- [按钮与 `toolSurface` 来自不同 component] → 排序由同一个 `ButtonArea` JSX 明确固定，且无需修改 `ContextBar` contract。
- [icon 在不同 theme 下对比不足] → 使用 lucide icon 的 `currentColor` 并复用 `.context-tool-btn` token。
- [OpenCode session 打开 enhancer 时原默认值被移除] → 明确归一化到 Claude，并用 hook test 锁定。
- [浅色 disabled action 过度接近 enabled] → 使用浅蓝背景、蓝灰文字和边框，保持 disabled 语义。

## Migration Plan

无需数据迁移。回滚时移除按钮 JSX、handler 与对应 focused test 即可，快捷键和 dialog 不受影响。

## Open Questions

无。
