## 1. Draft Safety And Workbench Structure

- [x] 1.1 [P0] 以 selected note snapshot 派生 dirty/save state，并让 select/new/collection/archive/clear 共享 discard guard；输入为当前 draft 与 navigation intent，输出为无静默覆盖的 state transition；验证 focused component tests。
- [x] 1.2 [P0, depends: 1.1] 将 note panel 主体调整为 responsive Master-Detail，并保持 active/archive/loading/empty/image preview contract；输入为现有 component DOM，输出为宽屏左右、窄屏上下布局；验证 DOM/CSS tests 与视觉检查。
- [x] 1.3 [P0, depends: 1.1] 增加 `Cmd/Ctrl+S`、visible save status 与 polite live region；输入为现有 handleSave，输出为单一 save path 与失败草稿保留；验证 create/update/error tests。

## 2. Action Hierarchy And Conversation Handoff

- [x] 2.1 [P1, depends: 1.1] 将 permanent delete 移入既有 DropdownMenu，并为 archive success 增加复用 restore helper 的 Undo toast action；验证 archive/undo/delete interaction tests。
- [x] 2.2 [P1, depends: 1.2] 增加 note panel → `useLayoutNodes` → main Composer 的 keyed selection request，idempotently 复用 selected note context contract；验证 visible Composer selection/focus 与 home Composer isolation。
- [x] 2.3 [P1, depends: 1.2] 更新中英文 copy、focus-visible、tab keyboard navigation 与 offscreen row rendering guard；验证 accessibility queries 与长文本/窄宽度 CSS contract。

## 3. Split Preference And Verification

- [x] 3.1 [P1] 让 note separator 读取/写入合法 layout ratio，并支持 pointer end persistence、Arrow keys、Home 与 double-click reset；验证 storage、clamp 与 ARIA value tests。
- [x] 3.2 [P0, depends: 1.3, 2.1, 2.2, 2.3, 3.1] 执行 focused Vitest、`npm run typecheck`、`npm run lint`、`git diff --check` 与 OpenSpec strict validation；输出为无新增 regression 的验证记录。
- [x] 3.3 [P1, depends: 3.2] 启动 desktop dev surface，检查 `1:2` 外层、Master-Detail、窄宽度、drag/keyboard separator 与 note/Composer 基本交互；记录平台限定与未覆盖项。
