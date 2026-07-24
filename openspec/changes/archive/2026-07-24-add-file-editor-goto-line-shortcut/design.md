## Context

文件编辑器由 lazy-loaded `FileCodeMirrorEditorImpl` 承载，已有 `focusEditorViewAtLocation` 统一处理 1-based line/column、selection、focus 与 viewport scrolling。现有 editor keymap 已集中注册 `Mod+F`、`Mod+B`、`Alt+F7`，因此行跳转应留在同一 lazy editor boundary 内，避免把 CodeMirror runtime 推回 shell startup path。

## Goals / Non-Goals

**Goals:**

- 在 editor keymap 注册跨平台 `Mod+G`。
- 展示贴近桌面 IDE 的居中 modal，并复用既有位置聚焦 helper。
- 保证输入解析、边界收敛、i18n、theme 与 accessibility 可测试。

**Non-Goals:**

- 不增加 global/configurable shortcut metadata 或 settings persistence。
- 不支持相对行、百分比、范围表达式。
- 不修改 preview renderer 或 backend contract。

## Decisions

### Decision 1: Modal 与 editor state 共置于 lazy implementation

在 `FileCodeMirrorEditorImpl` 内维护 modal open/input/error state。`Mod+G` keymap 只负责读取当前 selection 并打开 modal；确认时调用现有 `focusEditorViewAtLocation`。

CodeMirror `basicSetup` 默认将 `Mod+G` 用于 search `Find Next`。自定义 navigation keymap MUST 使用 `Prec.highest`，确保产品定义的 editor-scoped 行跳转优先于默认 search keymap；focused test 需要锁定该 precedence。

备选是在 `FileViewPanel` 维护状态并逐层传 callback。该方案会扩大 props 与 shell render 边界，且让 editor-local interaction 泄漏到外层，故不采用。

### Decision 2: 使用 feature-local parser，采用 1-based 语义

只接受 `line` 或 `line:column`，允许首尾空白，不接受相对行和百分比。有效数字先解析，再由文档行数与现有 focus helper clamp。

备选是直接调用 `@codemirror/search` 的 `gotoLine`。它呈现为 panel 且 column offset 语义与目标不一致，因此不采用；依赖仍保持不变。

### Decision 3: 文案由上层 i18n 注入

`FileViewBody` 使用已有 `t` 构造 `gotoLineLabels` 传给 lazy editor。这样 modal 不依赖额外 translation hook，也保持所有 user-visible copy 走项目 i18n。

### Decision 4: UI 采用 IDE-native compact density

modal 缩减 width、padding、field/button height，并使用已安装的 Lucide `ListOrdered` 表达“行列定位”。保留 native form、visible focus ring、`role="dialog"` 与现有 keyboard contract，不引入动画或新依赖。

### Decision 5: Tab icon 与文件树共享单一 resolver

`FileViewPanel` MUST 直接复用 `getFileTreeIconSvg(tabName, false)`，不再经过通用 `FileIcon` 映射。tab strip 继续使用 `overflow-x: auto`，仅通过标准 `scrollbar-width` 与 WebKit pseudo-element 隐藏视觉 scrollbar，保证 mouse wheel、trackpad 与 programmatic scroll 兼容。

## Risks / Trade-offs

- [Risk] modal state 触发 lazy editor React rerender → 使用局部 bounded state；不发布 document snapshot，不触及 typing hot path。
- [Risk] CodeMirror 仍接收到 dialog keyboard event → modal form handlers stop propagation，`Enter/Escape` 在 dialog 层消费。
- [Risk] 超大行列值造成异常 → parser 只接受 safe integer，定位前 clamp 到文档边界。
- [Trade-off] 不支持 CodeMirror 原生命令的相对行/百分比语法 → 当前需求仅要求 IDE 风格 `line[:column]`，保持 YAGNI。
- [Risk] 隐藏 scrollbar 降低溢出可见性 → tab clipping 本身仍提示溢出，且横向交互能力完整保留。
- [Risk] raw SVG 注入扩大使用面 → resolver 输出是仓库内静态常量，不接收用户 SVG；文件名仅用于受控映射选择。

## Migration Plan

1. 增加 parser、modal state/keymap、render 与 localized labels。
2. 压缩 modal presentation；tab 复用文件树 icon resolver 并隐藏 scrollbar chrome。
3. 增加 focused tests，并运行 frontend gates。
4. 无数据迁移；回滚时恢复 presentation/tab render/CSS 即可，不影响 persisted settings。

## Open Questions

无。产品已确认采用居中 modal。
