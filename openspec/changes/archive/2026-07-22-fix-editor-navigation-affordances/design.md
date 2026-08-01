## Context

Tauri `PredefinedMenuItem::close_window` owns a native platform accelerator. Native menu dispatch happens before the WebView DOM event, so CodeMirror cannot use the same key even with `Prec.highest`. Once the event reaches CodeMirror, the existing editor keymap already calls `preventDefault`, and the global close-session hook already respects `event.defaultPrevented`。

Navigation requests currently collapse backend failures into a rendered raw message. `No symbol under cursor` is therefore visible in English. Modifier-click exists as a `mousedown` handler but there is no hover state or decoration。

## Goals / Non-Goals

**Goals:**

- Remove only the native close-window accelerator while preserving menu click behavior。
- Use one platform-primary shortcut representation for expand-selection and preserve editor-first event precedence。
- Convert expected backend categories into localized, action-specific messages while keeping diagnostics observable。
- Add a local, bounded modifier-hover affordance for syntax identifiers。

**Non-Goals:**

- No LSP/backend search accuracy changes。
- No hover-triggered network/process request。
- No new dependency or generalized editor link framework。

## Decisions

### Decision 1: custom native close items without accelerators

File and Window menus will use existing custom ids (`file_close_window`, `window_close`) on every OS. The existing `handle_menu_event` close branch remains the single behavior owner。

Alternative: forward native accelerator back into the WebView based on focus. Rejected because the menu layer has no authoritative CodeMirror focus/selection state and would introduce cross-layer synchronization。

### Decision 2: shared platform-primary `cmd+w` default

The persisted shortcut parser already interprets `cmd` as the platform-primary modifier, and `toCodeMirrorShortcut` converts it to CodeMirror `Mod-W`. This yields `Cmd+W` on macOS and `Ctrl+W` on Windows/Linux without parallel hardcoded bindings. `Prec.highest` plus `preventDefault` preserves editor precedence; the global close-session listener sees `defaultPrevented` and no-ops。

为兼容上一版尚未发布但可能已写入本地的 `ctrl+w` 默认值，仅当 persisted value 精确等于 `ctrl+w` 时额外注册 `Mod-W`。custom/`null` 不获得隐藏 alias，避免扩大长期 contract。

Alternative: register both `Meta-W` and `Ctrl-W`. Rejected because it creates an unconfigurable hidden alias and violates the shared shortcut contract。

### Decision 3: action-aware frontend error classifier

A file-navigation-local pure helper will map known `no symbol` and `unsupported` error categories to localized action guidance. Other failures map to action-specific localized operational failure copy and are logged for diagnostics; raw backend English is not rendered。

Alternative: redesign all Tauri command errors as structured payloads. Better long-term, but disproportionate for three existing commands and outside this regression scope。

### Decision 4: CodeMirror local syntax decoration

A small `ViewPlugin` will track modifier + pointer state, use `state.wordAt(pos)` and `syntaxTree(state).resolveInner(pos)` to accept identifier-like node names, then render one `Decoration.mark` with underline and pointer cursor. It clears on keyup, mouseleave, blur, visibility loss, document change, and editor destroy。

Alternative: call definition on hover to prove clickability. Rejected due request storms and provider latency. Alternative: mark every word. Rejected because keywords/comments/strings would falsely appear clickable。

## Risks / Trade-offs

- [Syntax node names vary across language packages] → Use a conservative identifier-like node predicate and focused JavaScript/Java tests; unknown grammars show no affordance rather than a false positive。
- [Existing persisted `ctrl+w` may remain in local settings] → Preserve the stored value while adding a narrowly-scoped `Mod-W` compatibility binding only for that previous default; custom/`null` behavior remains authoritative。
- [Generic operational copy hides raw detail] → Keep raw error in `console.error` with action context while presenting localized user copy。
- [Native menu behavior differs by OS] → Build accelerator-free custom items on all targets and retain existing ids/handler。

## Migration Plan

1. Change defaults and native menu construction without altering persisted field shape。
2. Add frontend classifier/i18n and editor decoration。
3. Run focused tests and strict OpenSpec validation。
4. Rollback is a direct revert of this change; no data migration is required。

## Open Questions

无。用户已确认 editor 内 platform-primary `W` 扩大选择、editor 外关闭当前会话。
