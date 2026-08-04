# Verification: Stabilize Client Runtime And Diagnostics

- Verified At: `2026-07-18`
- Scope: Fast Markdown Worker、Timeline/streaming、history reopen、model catalog probe、diagnostics retention、Gemini hard-disable 与 owned child lifecycle
- Commit: 未提交；本报告记录 working-tree evidence

## 1. Outcome

实现与 change artifacts 已完成自动化 contract closure。用户已完成功能人工 smoke，Fast Markdown production Worker、history retry/stale-response、model health probe、diagnostics aggregation/redaction、Gemini zero-probe/zero-send 与 owned lifecycle 都有定向回归。

Task `7.3` 保持未勾选：功能 smoke 通过，但本轮没有保留 React Scan 关闭后的 quantified frame/first-delta trace，因此不能把 frame p95 `<30ms` 与 first-delta visible stall `<=700ms` 写成 measured fact。

## 2. Frontend Evidence

| Gate | Result |
|---|---|
| Gemini frontend closure focused suites | 17 files, 291/291 passed |
| Gemini historical/direct/session/Tauri send closure | 5 files, 244/244 passed |
| all `useThreadMessaging` suites | 5 files, 129/129 passed |
| Project Map/manual recovery core | 6 files, 98/98 passed |
| default batched frontend suite | 829/833 files passed; 4 files / 10 tests failed |
| `npm run typecheck` | passed |
| `npm run lint` | passed |
| `npm run check:runtime-contracts` | passed |
| `npm run test:fast-markdown-worker-production` | passed; production asset `fastMarkdown.worker-D5D5oAbv.js` executed without DOM access error |

The production Worker build retained existing chunk-size/dynamic-import warnings; no new Worker DOM dependency or runtime fallback failure was observed.

The default batched suite excludes three heavy `*.integration.test.tsx` files. The same four failing files were already present in the pre-final-Gemini-send baseline:

- `SettingsView.test.tsx`: stale `Client UI visibility` copy/section expectation, 1 failed test.
- `ProviderDialog.presets.test.tsx`: fixture expects `Moonshot` while the icon asset title is `MoonshotAI`, 1 failed test.
- `WorkspaceHome.test.tsx`: full module mock omits `TASK_RUN_STORE_UPDATED_EVENT`, 7 failed tests.
- `git-diff-visual-contract.test.ts`: fixture expects `overflow-y: auto` while current CSS is `hidden`, 1 failed test.

These failures keep the repository-wide test gate red. All change-focused suites, including the new message/session/Tauri Gemini policy tests, passed.

## 3. Rust / Process Evidence

| Gate | Result |
|---|---|
| Gemini library tests | 102/102 passed |
| daemon tests | 13/13 passed |
| mixed shutdown regression | 1/1 passed |
| `cargo check --bins` | passed |
| `cargo fmt --check` | passed |
| `npm run doctor:strict` | passed |

The supported local host proves Unix process-group cleanup, stale owner rejection, interrupt-before-registration tombstones, content-free argv, concurrent stdin/output progress, and explicit cleanup error propagation. Windows `taskkill` received a bounded 10-second timeout and fail-closed ownership retention, but that branch was not executed on a Windows host in this verification.

## 4. Gemini Capability Closure

- Fresh/missing/legacy `geminiEnabled` normalizes to `false`.
- Prompt Enhancer、Orchestration、Project Map、Checkpoint/commit-message、TaskRun recovery、manual recovery and direct thread/session/Tauri service owners reject or normalize before execution.
- Historical Gemini thread send and queued continuation reject before engine mismatch can create a Claude/Codex/OpenCode replacement thread.
- Bulk/preferred detection、shared detector and vendor preflight synthesize disabled evidence without running `gemini --version`.
- GUI/daemon local/remote async+sync command boundaries and session pre-spawn gate retain defense in depth.
- Historical records、filters、diagnostics、archive/delete and local catalog inspection remain readable.

## 5. Repository / Spec Gates

| Gate | Result |
|---|---|
| `openspec validate --all --strict --no-interactive` | 410/410 passed after final evidence reconciliation |
| `git diff --check` | passed |
| unmerged-file scan | empty |
| staged diff | empty |
| `npm run check:large-files` | passed in report mode; 41 findings reported |
| `npm run check:large-files:gate` | failed with 41 findings |

The hard large-file gate is existing governance debt rather than a clean gate: 36/41 findings are unchanged from `HEAD`. Five findings touch changed files, including one file already above the threshold in `HEAD`; this change does not claim the scheduled/manual hard gate is green.

## 6. Manual / Platform Qualifiers

- 用户确认本轮功能人工回归无异常。
- Quantified performance trace is not retained; task `7.3` remains open.
- Windows child cleanup is compile/review covered, not host-executed.
- Local process snapshot still shows an approximately eight-day-old Gemini parent/child chain with `PPID=1`. The new code intentionally does not kill by process name because it cannot prove ownership; it prevents new client-owned leakage and cleans only registry-owned children. Existing external/legacy orphans require explicit human inspection or termination.

## 7. Review Verdict

Final Rust review found no remaining P0/P1. Frontend review found one P1 cross-Provider send path through historical Gemini composer/queue; the shared message/session/Tauri owners were then changed to fail closed and the focused regressions passed. The change-specific gate is green, while the repository-wide frontend suite and hard large-file gate retain the explicitly listed baseline debt. No commit or staging action was performed.
