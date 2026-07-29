# Verification: compose-shared-session-execution-target

## 结论

Change B 的实现已与 proposal/design/spec 对齐。Gate 4 使用增量、分层自动化证据闭环；
未运行全量测试，也未把 Rust storage matrix 单独冒充 UI/runtime 验收。
OpenSpec verify 结果为 40/40 tasks、13/13 requirements、32/32 scenarios，
无 CRITICAL / WARNING；delta specs 已同步到主 specs 并归档。

## Gate 4 能力矩阵

| 验收点 | 自动化证据 |
|---|---|
| 一个 Shared Sidebar Row、切换不新建公开 Row | Shared Session 既有 identity contract + `shared_session_v2_target_matrix.rs` |
| Claude/Official、Claude/OpenRouter、Codex/OpenAI 三个 Hidden Binding | `shared_session_v2_target_matrix.rs` |
| 切回 Claude/Official 复用原 Binding | `shared_session_v2_target_matrix.rs` |
| Picker 选择只写下一轮 target | `Composer.file-reference-token.test.tsx` + `targetStore.test.ts` |
| Turn Provenance 来自 immutable snapshot | `dataSource.test.ts` + `MessagesRows.stream-mitigation.test.tsx` |
| Provider 删除后 Badge 可解释且标 unavailable | Projection availability enrichment + MessageRow component test |
| typed prompt ACK 后才写 accepted | `sendSharedSessionTurnV2.test.ts` + `shared_session_v2.rs` |
| Codex 真实 terminal 后才 commit | `sharedRuntimeTerminal.test.ts` + `sendSharedSessionTurnV2.test.ts` |
| 失败不重路由 | `sendSharedSessionTurnV2.test.ts` + target matrix |
| 同 Engine 双 Provider Interrupt 不串线 | `useThreadMessaging.test.tsx` + Desktop/daemon command routing |
| provisioning 强杀不 duplicate-create | `shared_session_v2.rs::process_kill_in_creating_window_never_creates_a_second_binding` |

## 增量验证命令

```bash
npm run typecheck
npx vitest run src/features/shared-session \
  src/features/messages/presentation/sharedProjection/dataSource.test.ts \
  src/features/messages/components/MessagesRows.stream-mitigation.test.tsx \
  src/features/composer/components/Composer.file-reference-token.test.tsx
npx vitest run src/features/threads/hooks/useThreadMessaging.test.tsx \
  -t "routes a shared Claude interrupt to the active provider binding"
cargo test --manifest-path src-tauri/Cargo.toml \
  --test shared_session_v2 \
  --test shared_session_v2_target_matrix \
  --test shared_projection
cargo test --manifest-path src-tauri/Cargo.toml --lib delta_sync
cargo check --manifest-path src-tauri/Cargo.toml --bin cc_gui_daemon
npm run check:runtime-contracts
openspec validate shared-execution-target --type spec --strict --no-interactive
openspec validate shared-send-pipeline --type spec --strict --no-interactive
openspec validate shared-session-engine-selection --type spec --strict --no-interactive
```

## 未执行

- 按用户要求未运行 `npm run test` 或全量 `cargo test`。
- 增量结果：Shared/UI 18 files、146 tests；Rust Shared integration 26 tests，
  delta-sync unit 3 tests；provider-scoped Interrupt 1 test，均通过。
- `openspec validate --all` 未作为本 change 门禁：仓库另有
  `add-tokentracker-usage-dashboard`、`reduce-client-polling-overhead` 两个未完成 change
  未通过；Change B 同步出的三份主 spec 已分别 strict validate。
- `useThreadMessaging.test.tsx` 全文件仍有 10 个 OpenCode/Gemini retirement
  既有基线失败；Change B 新增的 provider-scoped Interrupt case 单独通过。
- Desktop 人工点击矩阵留作发布前 smoke，不再阻塞 Change C 的代码阶段。
