## 1. Missing-Diff Fallback

- [x] 1.1 [P1, depends: none] 为 `FileChangeRow` 增加 optional missing-diff action；输入为 callback，输出为仅在无 inline preview 时可激活的稳定 row，并用 focused component test 验证 callback、异常隔离和 callback 缺失场景。
- [x] 1.2 [P1, depends: 1.1] 在 `GenericToolBlock` 仅对 `added + missing diff` 传入 fallback；输出不得改变已有 add inline preview 或其他 change kind，并用 focused tests 验证分支矩阵。

## 2. Verification

- [x] 2.1 [P1, depends: 1.2] 运行 touched message tool-block Vitest suites 与 `npm run typecheck`，输出必须无新增失败。
- [x] 2.2 [P1, depends: 2.1] 运行 `openspec validate restore-added-file-diff-access --type change --strict --no-interactive` 并复核 git diff，确认只包含本 change 与目标实现文件。
