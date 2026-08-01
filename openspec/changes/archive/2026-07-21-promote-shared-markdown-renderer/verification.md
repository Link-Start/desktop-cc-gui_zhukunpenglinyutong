# Verification: Promote Shared Markdown Renderer

- Verified At: `2026-07-21`
- Scope: Markdown canonical owner、runtime/support migration、external callers、lazy/worker contracts
- Commit: 未提交；本报告记录 working-tree evidence

## 1. Outcome

共享 Markdown owner 已迁入 `src/markdown/**`。`src/features/messages/components/Markdown.tsx` 仅保留 compatibility re-export；resource normalization、heavy-island policy 与 streaming scheduler 已拆分为独立模块。所有已盘点的外部 Markdown caller 和 `FileMarkdownPreview` language badge 均改用 neutral path。

为满足 new-file ratchet，canonical shell 进一步拆成 `Markdown.tsx` 687 行与 `MarkdownBlocks.tsx` 406 行；本 change 未新增 large-file finding。

## 2. Test Evidence

| Gate | Result |
|---|---|
| canonical `src/markdown` suite | 20 files, 127/127 passed |
| Markdown + external smoke batch | 24 files, 155/155 passed |
| affected external caller smoke | 4 files, 28/28 passed |
| full messages suite | 60 files, 582 passed, 7 skipped |
| `npm run typecheck` | passed |
| focused ESLint | passed |
| `npm run build` | passed |
| `npm run test:fast-markdown-worker-production` | passed; `fastMarkdown.worker-D5D5oAbv.js` |

Build retains the repository's existing CSS-property、dynamic-import and chunk-size warnings; no new Markdown runtime failure was observed.

## 3. Architecture Evidence

| Gate | Result |
|---|---|
| `npm run check:messages-boundaries` | passed; inbound `11/11`, outbound `61/61`, new `0` |
| external `messages/components/Markdown` imports | zero |
| external `messages/rendering/markdown` imports | zero |
| `src/markdown/**` imports from messages | zero |
| `npm run check:bundle-chunking` | passed; advisory budgets unchanged |
| `npm run check:runtime-contracts` | passed |
| `openspec validate promote-shared-markdown-renderer --strict` | passed |
| `git diff --check` | passed |

The lazy shell test proves the canonical `Markdown.tsx` does not statically import `react-markdown`、remark or rehype, while `FullMarkdownRuntime.tsx` retains the full parser stack behind dynamic import.

## 4. Baseline Qualifier

`npm run check:large-files:gate` exits non-zero with the repository's existing 51 findings. During implementation the unsplit canonical shell temporarily produced a 52nd finding; after extracting `MarkdownBlocks.tsx`, the result returned to the original 51-item baseline. No changed or new file from this phase remains in the finding list.

## 5. Review Verdict

`codex review --uncommitted` reported no discrete correctness issues. The reviewer independently reran typecheck、targeted Markdown/affected tests、messages boundary check and production build, all passing.
