## Why

`src/features/messages` 已完成第一阶段 presentation architecture 整理，但当前
仍存在外部 feature deep import messages private modules，以及 messages 反向依赖
peer features 的既有 coupling。若没有 measured baseline 与 static gate，后续分拆
public API、controllers、rows、Markdown/tool capabilities 时会继续增加隐性依赖债务。

## What Changes

- 保留并验证已归档的 `refactor-messages-presentation-architecture` change 与同步后的
  main spec，不恢复旧 active change。
- 记录 messages suite、typecheck、lint、large-file 与核心文件行数 baseline。
- 精确 inventory `outside -> messages private` 和 `messages -> peer feature` imports，
  并按 `public API`、`shared capability misplaced`、`intentional runtime dependency`、
  `producer-specific presentation coupling` 分类。
- 新增 `check:messages-boundaries` non-regression gate：允许既有精确 debt 被删除，
  禁止新增或重复同类 boundary violation。
- 建立后续 public API、streaming lanes 与 async media scope safety 的 acceptance contract。

## Impact

- Affected files：本 change artifacts、`scripts/check-messages-boundaries.mjs`、
  `package.json`。
- Runtime behavior：不修改 messages production code、DOM、streaming、virtualization、
  scroll、Markdown、tool rendering 或 async media behavior。
- Dependencies：复用仓库已有 `typescript` compiler API，不新增 dependency。
- Compatibility：现有 imports 全部进入精确 baseline allowlist；偿还 debt 不要求同步
  更新 allowlist，但任何新增 debt 立即失败。

## 验收标准

- archived change 仍位于 archive，main spec strict validation 通过。
- verification 记录 77 test files / 698 passed / 7 skipped 的已确认 baseline，
  typecheck/lint 通过，以及 large-file gate 的 51 个既有 failures。
- 双向 import inventory 与 checker baseline 数量、路径、kind、specifier 完全一致。
- baseline worktree 执行 `npm run check:messages-boundaries` exit 0。
- 临时 unlisted fixture import 使 gate exit 1，fixture 随后被移除。
- `openspec validate harden-messages-module-boundaries --strict` 通过。
