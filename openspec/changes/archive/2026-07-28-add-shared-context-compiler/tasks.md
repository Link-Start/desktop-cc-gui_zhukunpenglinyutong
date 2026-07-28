## 1. Context Package Contract（P0，依赖 Gate 4）

- [x] 1.1 新建 `shared_context` Rust domain module，定义 schemaVersion 1 的 package/manifest/capability DTO；验证：serde round-trip test
- [x] 1.2 实现 canonical JSON + SHA-256 source checksum 与 deterministic package id；验证：同输入 identity 稳定 test
- [x] 1.3 实现 `ContextCompressionReport` 与 per-category measured estimate；验证：source/package/perType 汇总一致 test
- [x] 1.4 实现 stable prefix/delta serialization；验证：连续 package 前缀 byte-identical test

## 2. Capability-driven Compiler（P0，依赖 1）

- [x] 2.1 定义五 mode capability predicate 与固定优先级；验证：table-driven mode matrix
- [x] 2.2 从 Shared Canonical Log 按 accepted cursor 读取 source entries；验证：range/source order test
- [x] 2.3 实现 destination-owned provenance/attempt mapping 排除；验证：native-delta 不重灌自身 entries
- [x] 2.4 缺少 Binding identity 时禁止 native-delta；验证：fail-closed predicate test

## 3. Compatibility Transformer（P0，依赖 2）

- [x] 3.1 规范化 portable user/assistant/text blocks 与 provider-private thinking omission；验证：protocol matrix
- [x] 3.2 实现 Tool Call/Result stable id mapping 与 atomic pair；验证：paired/orphan/unsupported matrix
- [x] 3.3 实现 Image/Attachment ArtifactRef downgrade；验证：image capability matrix
- [x] 3.4 实现 aborted/error assistant 与 historical control reference-only 规则；验证：不得伪装成功/执行 control
- [x] 3.5 建立 Claude→Codex→Claude、Claude Provider A→B、Codex Provider A→B source×target matrix

## 4. Deterministic Compression / Checkpoint（P0，依赖 3）

- [x] 4.1 实现 tool JSON/array schema+count+head/tail fold；验证：重复编译稳定
- [x] 4.2 实现 code/diff signature/path/hunk fold；验证：关键锚点保留
- [x] 4.3 实现 log error/warning/head/tail/repetition fold；验证：异常证据保留
- [x] 4.4 实现固定结构 Structured Checkpoint 与 incremental stable header；验证：章节顺序/前缀稳定
- [x] 4.5 所有 fold/omission 写 Manifest disposition；验证：无未解释的 token loss

## 5. Artifact Store / Retrieval（P0，依赖 3）

- [x] 5.1 实现 workspace/session-owned atomic Artifact Store；验证：temp+sync+rename fault test
- [x] 5.2 实现 checksum/ownership typed validation；验证：tamper/cross-session denied
- [x] 5.3 实现 progressive retrieval Tauri command 与 Desktop/daemon registry；验证：payload parity
- [x] 5.4 检索响应强制 `referenceOnly=true`，历史 control inert；验证：control regression test
- [x] 5.5 实现 orphan scan（只报告不自动删）；验证：referenced artifact 不误报

## 6. Two-phase Cursor / Pending Delivery（P0，依赖 1、2）

- [x] 6.1 扩展 binding cursor JSON：accepted/committed/pending phase，并兼容旧 cursor；验证：migration round-trip
- [x] 6.2 Tx3 原子写 `context.deliveryPrepared` + pending；验证：compile 失败无写入
- [x] 6.3 Context ACK 原子写 `context.deliveryAccepted` + accepted cursor；验证：committed 不提前
- [x] 6.4 terminal canonical commit 后推进 committed 并清 pending；验证：duplicate commit 幂等
- [x] 6.5 重启从 pending phase 恢复 recovery state；验证：禁止跨 Target 绕过

## 7. Runtime Adapter（P0，依赖 4、6）

- [x] 7.1 Codex capability probe 与 `thread/inject_items` helper；验证：method supported/unsupported contract
- [x] 7.2 Codex JSON-RPC success 才 context accepted，timeout/disconnect ambiguous；验证：不 fallback duplicate
- [x] 7.3 Claude transcript/checkpoint marker 与 checksum echo matching；验证：match/mismatch/missing matrix
- [x] 7.4 Kimi strong capability 缺失时返回 weak/unsupported，不宣称 exactly-once；验证：typed fidelity
- [x] 7.5 Adapter contract suite：accepted/rejected/drop/crash/resume/provider isolation/schema change

## 8. Shared V2 Send / UI Integration（P0，依赖 5–7）

- [x] 8.1 新增 compile/prepare/accept/retrieve service DTO 与 Tauri commands；验证：TS/Rust payload mapping
- [x] 8.2 V2 send 在 prompt 前执行 Context Package prepare/confirmation/delivery ACK；验证：阶段顺序
- [x] 8.3 degraded-context UI 展示 mode、omissions、disposition、compression；验证：未经确认无 side effect
- [x] 8.4 状态更新只发生阶段边界，不引入 root polling/per-entry setState；验证：render contract regression
- [x] 8.5 feature flag 关闭保留 Change B/V0 rollback，已提交 canonical facts 可读

## 9. Gate 5 Closure（P0，依赖 1–8）

- [x] 9.1 Rust compiler/delivery/artifact/source×target 增量测试通过
- [x] 9.2 Shared Vitest、typecheck、scoped ESLint、daemon/runtime contract 增量门禁通过
- [x] 9.3 `openspec validate add-shared-context-compiler --strict --no-interactive` 通过
- [x] 9.4 更新 master checklist Wave 5、编写 verification evidence 与 executable Trellis spec
- [x] 9.5 完成 cross-layer review，无 correctness/data-loss/routing finding
- [x] 9.6 Commit、OpenSpec sync/archive、Trellis task archive 与 session record
