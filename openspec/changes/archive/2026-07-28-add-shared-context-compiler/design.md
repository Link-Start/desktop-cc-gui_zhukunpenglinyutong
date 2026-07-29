## Context

Change B 已把 Shared Turn 的 target、Binding、prompt ACK 与 terminal commit 接到真实
Runtime，但 `shared_session_v2_prepare_context` 仍只检查 V0 snapshot 的 8 Turn /
4000 字符文本前缀。Change C 必须把上下文交付升级成 Canonical Log 派生的 durable
protocol，同时保持 Native Canvas、V0 rollback 和 AppShell render baseline 不变。

上游决策来自
`docs/research/mossx-multi-cli-provider-session-foundation-design.md` §5.6、§9、§14.3、
Phase 3 与 §17.3/17.5。

## Goals / Non-Goals

**Goals:**

- 产生 schemaVersion 1 的 ContextPackage、ProjectionManifest、真实 compression report。
- 由 Runtime capability 与 destination Binding identity 决定五种 mode。
- 对 canonical entries 做确定性 compatibility transform、atomic tool pairing 和
  type-aware folding。
- package、artifact、pendingDelivery、accepted/committed cursor 可审计、可恢复。
- Codex structured import 只以 JSON-RPC success 为 ACK；Claude transcript/checkpoint
  只以 checksum echo 为 context ACK；Kimi capability 弱时显式降级。
- degraded-context UI 展示真实 mode、omission、disposition 与 token delta。

**Non-Goals:**

- NativeHistoryReader、Provider Continuation、Conversation Family。
- 修改 Claude/Codex/Kimi vendor history file。
- ML compression、自动 target routing、silent fallback。
- 把 streaming delta 或 frontend ConversationItem 变成 canonical source。

## Decisions

### 1. Rust owns compilation and durable delivery truth

新增 `src-tauri/src/shared_context/` domain：

```text
types.rs          ContextPackage / Manifest / capabilities / delivery DTO
compiler.rs       source entries -> package + projection
transformer.rs    compatibility + atomic tool normalization
compression.rs    deterministic per-type folding + measured report
artifact_store.rs atomic artifact persistence/retrieval
delivery.rs       prepare/accept/commit cursor transaction helpers
commands.rs       thin Tauri commands
```

Frontend 只通过 typed service 调用 `prepare / accept / retrieve`，不计算 checksum、
sequence 或 cursor。备选方案是 Renderer 编译再传 Rust；拒绝，因为会出现双 truth、
跨 WebView 差异和无法原子恢复。

### 2. Canonical source is immutable; package is a derived artifact

Compiler 读取 `SharedEventWriter.events_for_session()` 中 canonical fidelity entries。
`acceptedThroughSequence` 是本 Binding 下次 source range 的 exclusive lower bound；
`throughSequenceInclusive` 固定为本次编译快照上界。编译结果不推进 cursor。

Package 使用 canonical JSON serialization 后的 SHA-256 checksum；`packageId` 由
`sessionId + bindingKey + source range + sourceChecksum` 确定性派生。相同输入重编译
得到相同 identity，便于 recovery。

### 3. Mode selection is capability predicates, never engine branching

固定优先级：

```text
existing destination identity + delta capability
  -> native-delta
structured historyImport
  -> native-history-import
nativeClone
  -> native-history-clone
user-channel transcript + within budget
  -> portable-transcript
otherwise
  -> checkpoint
```

Engine Adapter 只负责 probe 后提供 `RuntimeCapabilities`。Compiler 不匹配
`EngineType::Codex/Claude/Kimi` 来选 mode。

### 4. Native-delta excludes destination-owned facts

Compiler 同时检查：

- canonical provenance `bindingKey`；
- durable `attemptId -> bindingKey -> nativeSessionId` ownership；
- destination `bindingKey + nativeSessionId`。

目标 Binding 原生拥有的 Entries 不进入 package，也不通过回退 cursor补发。缺少
destination identity 时 `native-delta` predicate 为 false。

### 5. Transformer preserves semantic closure

- Provider-private thinking/signature：同协议且 capability 允许才保留，否则 omission。
- Tool call/result：按 exchange id 配对；目标不支持 tool history 时整对省略；孤立项
  生成 explicit incomplete exchange，不伪装成功。
- Tool ID：使用稳定映射表同时重写 call/result。
- Image/attachment：目标不支持时转 ArtifactRef + omission，不静默删除。
- aborted/error assistant：不进入成功 portable turn；写 typed omission/outcome fact。
- historical control：标记 reference-only，永不作为当前 control 执行。

### 6. Compression is deterministic and prefix-stable

稳定前缀只包含 checkpoint Goal/Constraints/Key Decisions 与 deterministic facts，
按 stable entry id 排序并 canonical serialize。新事实只追加 delta 区。

分类型规则：

- tool JSON/array：schema、count、首尾样本；
- code/diff：path/signature/hunk header；
- log：error/warning、首尾行、重复计数；
- image/attachment：ArtifactRef；
- turns：语义骨架，移除 private blocks。

每次 fold 写入 manifest omission，compression report 记录 source/package token
估算与 per-type strategy。Token 估算使用现有 deterministic character estimator，
不引入 tokenizer dependency。

### 7. Artifact Store is atomic and permission-scoped

目录位于 app data Shared Session domain：

```text
shared-context-artifacts/<workspaceHash>/<sessionId>/<artifactId>.json
```

写入使用同目录 temp file、`sync_all`、atomic rename；metadata 保存 checksum、owner
workspace/session、media type、createdAt。读取 command 必须同时匹配 workspaceId、
sessionId、artifactId 和 checksum。检索结果强制 `referenceOnly=true`。

### 8. Delivery uses a two-phase cursor

`shared_binding_state.context_cursor_json` 扩展为：

```text
acceptedThroughSequence
committedThroughSequence
pendingDelivery {
  packageId/sourceChecksum/throughSequence
  operation/phase/clientTurnId/native ids/timestamps/probeAttempts
}
```

- Tx3 prepare：append `context.deliveryPrepared` + pending `prepared`。
- Context ACK：append `context.deliveryAccepted`、advance accepted、phase
  `accepted-awaiting-commit`。
- Turn terminal canonical commit：advance committed、clear pending。
- compile failure：不写 pending，不推进 cursor。
- ACK ambiguous：保留 pending，进入 recovery-required。
- accepted 后 Run failed：accepted 不回退；terminal fact 后 committed 前进。

### 9. Adapter boundaries

- Codex：新增 `thread/inject_items` request helper；只有成功 response 产生 strong
  `ContextImportAck`。unsupported method 返回 typed capability downgrade，重新编译为
  transcript/checkpoint；timeout/disconnect 为 ambiguous，不自动 fallback/retry。
- Claude：Projection 生成带 `MOSSX_CONTEXT_PACKAGE:<packageId>:<checksum>` marker 的
  user-channel transcript/checkpoint；runtime echo checksum 匹配才记 context accepted。
- Kimi：本 change 不伪造 ACP strong ACK。probe 未证明 import/echo 时只能
  `portable-transcript/checkpoint` + `ackFidelity=weak`，ambiguous 走 recovery。

### 10. Frontend integration preserves render baseline

V2 send 调用新的 prepare command，UI 仍复用 `SharedSendStatusBar` 的
degraded decision Promise。状态只在阶段边界更新，不逐 entry/delta setState，不挂
AppShell 根 hook，不新增 polling。

## Risks / Trade-offs

- [Risk] Codex 安装版本不支持 `thread/inject_items` → capability probe 缓存按
  binary/protocol fingerprint；typed unsupported 后重新编译降级，Manifest 留痕。
- [Risk] Claude echo 在旧版本不可用 → 不推进 accepted；保留 pending 并进入 recovery。
- [Risk] package 较大导致磁盘增长 → 大 payload artifact 化；GC 只删除无 durable ref
  且超过 retention 的文件，本 change 先提供 orphan scan，不自动删除。
- [Risk] character-based token estimate 不等于 Provider tokenizer → 字段明确命名
  `estimatedTokens`，compression report 记录 deterministic measured estimate，
  不宣称 billing token。
- [Trade-off] checkpoint omission ACK 后不自动补发 → 以 progressive retrieval 换取
  exactly-once cursor；UI 必须显示 disposition。

## Migration Plan

1. 新增 compiler/types/artifact store 与纯 Rust tests，不接生产 send。
2. 扩展 Binding cursor JSON，读取旧 `last_synced_sequence` 时迁移为 accepted/committed
   同值，保留旧字段。
3. 接入 prepare/accept/commit commands 与 frontend typed mapping。
4. feature flag 开启时使用 Context Package；关闭时继续 Change B/V0 rollback。
5. 增量 matrix 通过后更新 Gate 5、sync specs、archive change。

回滚只需关闭 Shared V2/context flag；Canonical facts、artifact 与新 cursor 保留，
旧 reader 忽略未知 JSON 字段。

## Open Questions

无阻塞问题。Kimi ACP arbitrary history import 仍按 S3 结论视为 unsupported；未来若
protocol probe 得到强 ACK，再增加 capability，不修改既定 cursor 语义。
