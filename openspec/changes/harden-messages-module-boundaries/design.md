## Context

Phase 0 只建立治理边界，不迁移 owner，也不改变 behavior。当前 repository 允许
relative path 与 `@/` alias；imports 还可能通过 `export ... from`、TypeScript
`import("...")` type、dynamic import、CommonJS `require` 或 Vitest/Jest mock 出现。
纯文本 `rg` 会漏掉 minified source imports，也可能把测试字符串误判为 dependency。

## Decisions

1. **AST-based discovery**：checker 使用现有 `typescript` compiler API，扫描
   `src/**` 的 TS/TSX/JS family，提取真实 import/export/import-type/dynamic-import/
   require/mock specifier，并解析 relative path 与 `@/` alias。
2. **Two directed boundaries**：
   - 外部文件导入 `src/features/messages` root/index 以外路径，记为
     `outside -> messages private` debt。
   - messages 内文件导入其他 `src/features/<peer>`，记为
     `messages -> peer feature` debt。
3. **Exact non-regression allowlist**：baseline key 为
   `source file | import kind | exact specifier`，并按 occurrence count 比较。
   删除或迁移 existing debt 允许通过；新 key 或超过 baseline count 的重复 import 失败。
4. **No wildcard exceptions**：不按目录 wildcard、basename 或 substring 放行，避免
   Phase 0 allowlist 被误用为永久 architecture policy。Phase 8 应删除已偿还项并收紧到
   final dependency graph。
5. **Evidence separation**：归档 change/main spec、historical clean messages baseline、
   concurrent worktree rerun 与 repository-level large-file debt 分开记录，禁止把其他
   agent 的 Phase 1 RED 或 51 个既有 large-file failures归因于本 governance change。

## Dependency Classification

- `public API`：conversation composition、public types 或 compatibility surface 的现有调用。
- `shared capability misplaced`：Markdown、diff、tool constants/icons、command tags 等应迁移
  到 neutral shared owner 的 capability。
- `intentional runtime dependency`：conversation state、streaming diagnostics、tasks、
  Markdown runtime、theme 等当前 data/runtime contract。
- `producer-specific presentation coupling`：browser-agent、intent-canvas、project-memory、
  note-cards 等 producer-specific metadata/presentation coupling。

## Non-Goals

- 不创建 `src/features/messages/index.ts`，不重写任何 existing import。
- 不移动 Messages/Timeline/Rows/Markdown/toolBlocks owner。
- 不修复 Phase 1 memo/async correctness tests。
- 不修改 large-file baseline、roadmap 或 archived change。

## Verification Strategy

- 正向：current baseline 执行 checker 必须 exit 0 且报告 38 inbound、70 outbound、0 new。
- 负向：创建临时 source fixture，加入一个未 allowlist 的 messages deep import，checker
  必须 exit 1 并打印 file/line/kind/specifier；随后删除 fixture并复跑 exit 0。
- Contract：current change 与 messages main spec 分别 strict validate。
- Hygiene：`git diff --check` 与最终 `git status --short` 证明无残留 fixture，且不覆盖
  shared worktree 的其他 agent changes。
