## 1. Archived Change Boundary

- [x] 1.1 确认 `refactor-messages-presentation-architecture` 已移入 archive，不在 active list。
- [x] 1.2 验证同步后的 `messages-presentation-architecture` main spec strict valid。
- [x] 1.3 核对 archived tasks/evidence 已记录完成状态，不恢复或修改旧 change。

## 2. Measured Baseline and Inventory

- [x] 2.1 记录核心文件 line-count、77 files / 698 passed / 7 skipped baseline。
- [x] 2.2 记录 typecheck/lint pass 与 large-file gate 51 个既有 failures。
- [x] 2.3 使用 TypeScript AST 精确 inventory 外部 messages deep imports。
- [x] 2.4 使用 TypeScript AST 精确 inventory messages 到所有 peer features imports。
- [x] 2.5 为每条 import 记录 architecture classification。

## 3. Non-Regression Gate

- [x] 3.1 实现 exact baseline allowlist，禁止 wildcard exception。
- [x] 3.2 覆盖 import/export/import-type/dynamic import/require/mock 与 relative/alias path。
- [x] 3.3 添加 `check:messages-boundaries` package script。
- [x] 3.4 运行 baseline gate，并用临时 unlisted fixture 验证 failure 后移除 fixture。

## 4. Acceptance Contract and Verification

- [x] 4.1 写入 dependency direction、streaming lanes、async media scope requirements。
- [x] 4.2 运行 current change strict validation 与 main spec strict validation。
- [x] 4.3 运行 `git diff --check`，确认无 fixture、无 roadmap/archived change 修改。
- [x] 4.4 将最终命令与结果更新到 `verification.md`。
