# Verification: add-shared-context-compiler

## 结论

Change C 的实现、spec 与增量测试一致。未发现阻塞归档的 correctness、data-loss、
owner routing 或 duplicate delivery 问题。Gate 5 可以关闭，Change D 可以开工。

## 摘要

| 维度 | 结果 |
|---|---|
| 完整性 | 44/44 implementation tasks 完成；archive task 在归档提交完成 |
| 正确性 | 13/13 requirements 有实现证据；32/32 scenarios 有代码或增量测试覆盖 |
| 一致性 | Rust 编译与 durable truth、capability-driven mode、two-phase cursor、阶段边界 UI 均遵循 design |

## 实现证据

| Contract | 证据 |
|---|---|
| ContextPackage / Manifest / compression | `src-tauri/src/shared_context/types.rs`、`compiler.rs` |
| deterministic checksum/package/prefix | `src-tauri/src/shared_context/compiler.rs`、`src-tauri/tests/shared_context.rs` |
| Compatibility Transformer | `src-tauri/src/shared_context/compiler.rs` |
| Artifact ownership / checksum / orphan report | `src-tauri/src/shared_context/artifact_store.rs`、`src-tauri/tests/shared_context.rs` |
| two-phase cursor / pending recovery | `src-tauri/src/shared_context/delivery.rs`、`src-tauri/src/shared_session_v2.rs` |
| Codex JSON-RPC ACK | `src-tauri/src/shared/codex_core.rs`、`src-tauri/src/shared_sessions.rs` |
| Claude checksum echo | `src-tauri/src/engine/claude/event_conversion.rs`、`src/features/shared-session/runtime/sharedRuntimeTerminal.ts` |
| V2 send ordering / recovery | `src/features/shared-session/runtime/sendSharedSessionTurnV2.ts` |
| degraded mode / omissions / compression UI | `src/features/shared-session/components/SharedSendStatusBar.tsx` |
| typed commands / DTO | `src-tauri/src/command_registry.rs`、`src/features/shared-session/services/sharedSessions.ts` |

## Review 修复记录

1. Context source upper bound 原先可能包含当前 `turnRequested`。已固定为当前 sequence
   的前一条，避免 user prompt 在 prefix 与本轮 prompt 中重复出现。
2. V0 snapshot prefix 与 Context Package 曾可能双重交付。存在 `contextDelivery` 时已
   禁用旧 prefix。
3. Claude 曾在真实 terminal 前构造完成态。已删除 fake terminal，等待 runtime
   settlement；strong context ACK 只接受匹配 replay echo。
4. terminal event sequence 曾可能误写为 context cursor。现在只使用 package
   `throughSequenceInclusive`，由 delivery commit 推进。
5. strong ACK wait error 曾绕过 recovery。现在统一写 `ackAmbiguous` 与
   `recovery-required`。
6. unresolved pending 曾可被另一 Target 绕过。begin 现在 fail closed。
7. orphan scan 曾漏报完整但无 durable ref 的 artifact。现在同时报告 temp、
   malformed 与 unreferenced completed artifact，且不自动删除。
8. `turnCommitted` 与 committed cursor/pending 曾分两次写。现在通过
   `append_canonical_fact_with_binding_at` 在同一 SQLite transaction 原子提交。

## 增量验证

以下命令通过；按用户要求未跑全量测试：

```bash
cargo test --lib shared_context
cargo test --test shared_context
cargo test --test shared_session_v2
cargo test --lib convert_event_preserves_replayed_user_message_as_raw_ack_evidence
cargo test --lib context_import_requires_jsonrpc_success
pnpm vitest run \
  src/features/shared-session/runtime/sendSharedSessionTurnV2.test.ts \
  src/features/shared-session/runtime/sharedRuntimeTerminal.test.ts
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint \
  src/features/shared-session/components/SharedSendStatusBar.tsx \
  src/features/shared-session/runtime/sendSharedSessionTurnV2.ts \
  src/features/shared-session/runtime/sendSharedSessionTurnV2.test.ts \
  src/features/shared-session/runtime/sharedRuntimeTerminal.ts \
  src/features/shared-session/runtime/sharedRuntimeTerminal.test.ts \
  src/features/shared-session/runtime/sharedSendStateStore.ts \
  src/features/shared-session/services/sharedSessions.ts
openspec validate add-shared-context-compiler --strict --no-interactive
```

结果：

- Rust：`shared_context` unit 3、integration 1、Shared V2 integration 11、
  Claude/Codex ACK 定点各 1，全部通过。
- Frontend：2 files / 18 tests 通过；TypeScript 与 scoped ESLint 通过。
- 已存在的 Rust warning 未由 Change C 引入，不阻塞本 change。

## 人工 smoke（发布前，不阻塞归档）

1. Shared V2 开启，Claude Provider A 连续对话后切 Codex Provider B；确认上下文
   状态显示 mode、source/package token estimate，回答能引用历史。
2. 构造超预算或不兼容内容；确认 degraded 详情列出 omission/disposition，取消时
   不发送，确认后才继续。
3. Claude strong echo 场景断开 runtime；确认状态进入 recovery，不能直接重发或切
   另一 Target 绕过 pending。
4. 切回原 Provider；确认已有 Binding 不重复注入自身历史。
