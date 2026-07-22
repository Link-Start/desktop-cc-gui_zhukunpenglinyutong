# Add File Editor Navigation History

## Goal

实现 OpenSpec change `add-file-editor-navigation-history`：主 File Editor 提供严格限定于跨文件 semantic navigation 的 Back / Forward history、按钮与平台快捷键。

## Requirements

- 记录 definition、implementation、references 产生的跨文件 `path + line + column` source/target。
- 不记录同文件定位、file tree、global search、manual tab activation 或 cursor movement。
- main header 移除“返回聊天”按钮，替换为 Back / Forward controls。
- macOS 使用 `Cmd+Option+Left/Right`；Windows/Linux 使用 `Ctrl+Alt+Left/Right`。
- Detached File Explorer leading sidebar action 保持不变。
- 只运行 focused tests、typecheck、lint，不运行全量 tests。
- 实现后执行 changed-code review 并修复 findings。

## Acceptance Criteria

- [ ] `A -> B -> C` 支持双向 traversal，恢复准确 file、line、column。
- [ ] Back 后新 jump 正确截断 forward branch。
- [ ] manual/external file activation 清链且不成为 history destination。
- [ ] 按钮、快捷键、disabled state 与 platform mapping 有 focused test coverage。
- [ ] Detached File Explorer leading action 无回归。
- [ ] focused tests、typecheck、lint、OpenSpec strict validation 通过。
- [ ] review findings 已修复并复验。

## Technical Notes

- Behavior/artifact source of truth：`openspec/changes/add-file-editor-navigation-history/**`。
- 复用 `useFileNavigation` 与 `onNavigateToLocation`；不新增 backend API 或 dependency。
