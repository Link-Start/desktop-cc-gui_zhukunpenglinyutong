## 设计概要

### 1. `useComposerAutocompleteState` 瘦身为 trigger 上下文检测器

**消费事实**（`Composer.tsx:1024-1053`）：9 个输出中仅 `isAutocompleteOpen`、`handleTextChange`、`handleSelectionChange` 被使用，其余 6 个以下划线别名弃用。

**瘦身后的契约**：

```ts
type UseComposerAutocompleteStateArgs = {
  text: string;
  selectionStart: number | null;
  setText: (next: string) => void;
  setSelectionStart: (next: number | null) => void;
};

// returns { isAutocompleteOpen, handleTextChange, handleSelectionChange }
```

- `isAutocompleteOpen` = 光标处于补全 trigger 上下文。检测逻辑复用原 `resolveAutocompleteState` 的文本扫描（trigger 集合 `{"/", "$", "@", "@@", "@#"}`，长 trigger 优先，前缀字符约束一致），但不再要求 items 非空。
- trigger 集合与 ChatInputBox 7 个 `useCompletionDropdown` 实例的 trigger 对齐（`/`、`$`、`@`、`@@`、`@#`，agent 触发同属 `/` 族，不影响抑制语义）。
- 删除：`manualMemorySuggestions`/`noteCardSuggestions` state 与两条 120ms 防抖 IPC effect、`fileItems` 打分 memo、`skillItems`/`slashItems`/`promptItems`/`commandItems` 构建、`useComposerAutocomplete` 调用、`applyAutocomplete`、`handleInputKeyDown`、全部失效入参（`disabled`/`skills`/`prompts`/`commands`/`files`/`directories`/`gitignoredFiles`/`gitignoredDirectories`/`workspaceId`/`workspaceName`/`workspacePath`/`onManualMemorySelect`/`onNoteCardSelect`/`textareaRef`）。

**语义变化点（显式声明）**：原 `isAutocompleteOpen = triggerActive && matches.length > 0 && !dismissed`。其中 `dismissed` 只能由已弃用的 `applyAutocomplete`/`handleInputKeyDown` 置位，实际恒为 false；`matches.length > 0` 仅在「trigger 激活但无任何候选」（如空 workspace 输入 `@`）时为 false。新语义在该边界从「放行 inline history completion / ↑↓ 历史导航」变为「抑制」，属更保守且更贴合该布尔用途（用户正处于补全输入语境）的行为。

### 2. `useComposerAutocomplete.ts` 删除

全仓库唯一消费者是 `useComposerAutocompleteState.ts`（`grep` 已核实），hook 瘦身调用后即无引用，整文件删除。`AutocompleteItem` 类型随文件一并删除，无外部引用。

### 3. `Composer.tsx` 调用点收敛

- 解构只保留 `isAutocompleteOpen`、`handleTextChange`、`handleSelectionChange`。
- 调用入参只传 `text`、`selectionStart`、`setText`、`setSelectionStart`。
- 其余局部变量（`skills`/`prompts`/`commands`/`files` 等）若仍被其他逻辑使用则保留，不做连带清理。

### 4. 命名残留清理

- `ChatInputBoxAdapter.tsx` 头部注释：删除 *"enabling drop-in replacement of ComposerInput"* 迁移叙事，改为「将 Composer props 接口翻译为 ChatInputBox props 接口」的当前职责描述。
- `ComposerInputResponsiveness.guard.test.ts` → `ChatInputResponsiveness.guard.test.ts`（`git mv`，测试内容不变，describe 文案同步更新）。

### 兼容性

- 用户可见补全行为零变化：下拉渲染、trigger 解析、选择插入全部由 ChatInputBox completion providers 完成，本次不触碰。
- `isAutocompleteOpen` 的消费者只有 `suggestionsOpen`（inline completion 抑制）与 `usePromptHistory`（历史导航抑制），两者对新语义均为更安全方向。

### 不引入的复杂度

- 不引入跨层 dropdown 状态上抛；不合并 ChatInputBox 7 个 completion 实例；不改 prompt history。
