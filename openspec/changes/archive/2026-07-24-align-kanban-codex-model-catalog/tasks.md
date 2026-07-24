## 1. Catalog Contract

- [x] 1.1 [P0, no dependency] 输入 `useModels.models`，输出 AppShell → `KanbanView` → `KanbanBoard` → `TaskCreateModal` 的 typed `codexModels` prop contract；以 TypeScript typecheck 验证。
- [x] 1.2 [P0, depends on 1.1] 输入 selected engine、shared Codex catalog 与现有 engine statuses，输出 Codex 使用 shared catalog、其他 engine 保持原 source 的 model options；以 focused component test 验证 ids/order/labels。

## 2. Selection Stability

- [x] 2.1 [P0, depends on 1.2] 输入 catalog refresh 与当前 `modelId`，输出 preserve-valid / default / first / empty 的 deterministic selection；以 rerender regression test 验证。
- [x] 2.2 [P1, depends on 2.1] 输入用户选择的 shared catalog model，输出 create/update task payload 中兼容的 `modelId`；以 submit assertion 验证。
- [x] 2.3 [P0, depends on 2.1] 输入首次打开的 Codex edit/draft selection，输出等待目标 engine 生效后再 normalization，避免旧 engine options 覆盖有效 model；以 focused regression test 验证。
- [x] 2.4 [P1, depends on 2.3] 输入 empty Codex catalog，输出精确锁定 model selector 的 empty state assertion，禁止命中其他含空 option 的 select。

## 3. Quality Gates

- [x] 3.1 [P0, depends on 2.2] 运行 `TaskCreateModal.test.tsx` focused Vitest、`npm run typecheck` 与 `npm run lint`，输出零失败结果。
- [x] 3.2 [P1, depends on 3.1] 运行 `npm run check:runtime-contracts`、`npm run check:large-files` 与 change strict validation，输出可归档的验证证据。
