# Verification: honor-native-session-renamed-titles

日期：2026-07-27。命令均在仓库根执行。

## 自动化验证结果

| 命令 | 结果 |
|---|---|
| `cargo test --manifest-path src-tauri/Cargo.toml --lib scan_codex_summaries` | 5/5 通过 |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib scan_session_source_file` | 6/6 通过 |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib local_codex_thread_entry_preserves_parent_session_id` | 1/1 通过 |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib global_codex_catalog_entry_preserves_parent_session_id` | 1/1 通过 |
| scoped `rustfmt --edition 2021 --check`（可独立解析的本 change Rust files） | 通过 |
| `npx vitest run src/features/threads/utils/sessionDisplayProjection.test.ts src/features/threads/hooks/useThreadActions.helpers.test.ts src/features/threads/hooks/useThreadActions.threadList.test.ts` | 39/39 通过 |
| `npm run typecheck` | 通过 |
| `npm run lint` | 0 errors；8 个既有 hooks warnings |
| `npm run check:runtime-contracts` | 通过 |
| `openspec validate honor-native-session-renamed-titles --strict --no-interactive` | 通过 |
| `git diff --check` | 通过 |
| `codex review --uncommitted`（隔离 worktree，仅包含本 change） | 未发现明确的新增 correctness 问题；review 独立复跑 39 个 frontend tests 与 `git diff --check`，均通过 |

## 场景核对

- Codex index overlay：同一 `CODEX_HOME/session_index.jsonl` 中最后一个有效 `thread_name` 胜出；malformed/blank records 不破坏 first-message fallback。
- Codex home isolation：不同 home 的 titles 不串用；同 UUID 跨 home dedupe 时不会把一个 home 的 native title 复制给另一个 home 的 winning source fact。
- Claude transcript scan：最后一个有效 `custom-title.customTitle` 进入独立 `nativeTitle`，原 `first_real_user_message` 保持 fallback 语义；scanner version 从 3 增至 4 使旧 cache 失效。
- Cross-layer projection：workspace catalog、Codex local/daemon fallback、Claude direct fallback、Tauri boundary 与 centralized frontend title resolver 均保留 optional `nativeTitle`。
- Title precedence：GUI `customTitle` > persisted `mappedTitle` > runtime `nativeTitle` > previous-vs-fallback heuristic；`Agent 12`、generic session name 与短 hex 等合法 rename 不再被 weak-title heuristic 丢弃。
- Backward compatibility：旧 backend 缺少 `nativeTitle` 时，normalizer 保持字段 absent，并沿用原 title projection。

## Review 结论

Codex `/review` 已在只包含本 change 的隔离 worktree 中完成跨层 diff、调用链与针对性回归审查。未发现需要阻断或优先修复的新增 correctness finding，因此无需追加代码修改。

## Repo-wide 既有阻断（非本次引入）

- `npm run doctor:strict`：`check:runtime-contracts` 通过，随后既有 branding gate 命中 `mossx-host` 与 Kimi test paths；本 change 未触及命中文件。
- `npm run test`：批量运行至第 188/923 个 test file 时，`src/features/composer/components/ChatInputBox/types.test.ts` 仍期望 5 个 Codex models，而 production list 已有 7 个；单独重跑稳定失败，多出 `gpt-5.4-mini` 与 `gpt-5.3-codex-spark`。
- repo-wide Rust lib suite：此前基线为 1635 passed / 5 failed；失败集中在 process-group teardown 与 workspace cache timing，相关单测复跑呈既有 deterministic/flaky 特征，本 change focused Rust tests 全绿。
- `openspec validate --all --strict --no-interactive`：460 passed / 2 failed；既有 `add-tokentracker-usage-dashboard` 与 `reduce-client-polling-overhead` 缺少 delta specs，targeted validation 通过。
- `cargo fmt --check`：既有未修改的 `src-tauri/src/vendors/cc_switch.rs`、`src-tauri/src/workspaces/commands.rs` formatting 阻断；本 change 可独立解析的 Rust files scoped check 通过。

## 手工 gate

未启动 GUI 做人工端到端操作。核心解析、跨层字段传递、弱标题 precedence 与 fallback 均由 focused Rust/Vitest 覆盖；PR reviewer 可按实际 Codex `/rename` 或 Claude custom title 做补充 smoke test。
