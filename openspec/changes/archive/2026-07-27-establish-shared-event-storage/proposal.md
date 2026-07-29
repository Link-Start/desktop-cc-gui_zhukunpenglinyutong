# Proposal: establish-shared-event-storage

## Why

Wave 0（`establish-session-foundation-contracts`）已冻结 Canonical Fact Schema 与领域契约，但 Shared Session V2 仍没有可落盘的存储地基：事件、sequence、cursor、pending delivery、Provider Usage Ledger 目前只存在于设计文档。本 change 实施任务清单的 **Wave 1（A1.1–A1.6 + Gate 1）**：SQLite WAL Canonical Event Storage，为 Wave 2（A2 Canonical Ingress）提供唯一写入口与崩溃安全保证。

按 dark-launch 纪律，本 change 不接入任何 UI、Runtime Adapter 或真实流量；Shared 产品行为保持 V0。

## 目标与边界

- 新增 Rust 存储模块 `src-tauri/src/shared_event_log/`：SQLite WAL schema + migration、`SharedEventWriter` 单写者 Actor、唯一 sequence allocator、unique constraints + `dedupe_key` 幂等、Provider Usage Ledger writer、启动恢复（单错误输出 `quick_check`、integrity failure → read-only、不建空库覆盖）。
- Event insert 与 `shared_sessions_v2.next_sequence` 分配/更新在同一 SQLite transaction；payload 以 Wave 0 Schema 的 envelope 为逻辑契约存储（payload 字段级校验属 Wave 2 A2.1）。
- `payload_checksum = SHA-256(UTF-8 deterministic-json(schemaVersion + factType + payload))`，deterministic-json 固定 key ordering 与编码规则。
- 崩溃/掉电测试台：每个事务边界强杀子进程 + 随机点强杀，重启断言 all-or-nothing 与幂等。
- 复用已有 `rusqlite 0.32 (bundled)` 与 `serde_json`，不新增任何依赖。

## 非目标

- 不做 Canonical Fact 类型定义与 payload 字段校验（A2.1）、Run/Turn Assembler（A2.3）、UI Projection（A3）、Runtime Adapter（B/C）。
- 不新增 `#[tauri::command]`、不改 frontend、不接真实 Shared 流量（dark launch 边界不破）。
- 不迁移 V0 snapshot 数据（Legacy Import 属 A3.3）；`shared_legacy_import` 表只建结构。
- 不引入 Hash Chain、自研加密、retention/delete 能力（Foundation §14.4.4/§14.4.6）。
- 不把 DB 部署到 Network Filesystem，不实现备份调度（仅遵守 Backup API 边界约束）。

## What Changes

- 新增 capability spec `shared-event-storage`：schema 保留项、单写者事务语义、幂等键、Ledger 归属、启动恢复与崩溃验收的 Requirement/Scenario。
- 新增 `src-tauri/src/shared_event_log/`（schema / writer / ledger / recovery / checksum / error 子模块）并在 `lib.rs` 导出。
- 新增 `src-tauri/tests/` 崩溃/掉电集成测试台（子进程强杀模型）与模块内单元测试。
- DB 文件权限 `0600`、父目录 `0700`；PRAGMA：`journal_mode=WAL`、`foreign_keys=ON`、`synchronous=FULL`、bounded `busy_timeout`。

## Capabilities

### New Capabilities

- `shared-event-storage`: Shared Session V2 的 SQLite WAL Canonical Event Storage——六表 schema 与 migration 保留项、`SharedEventWriter` 单写者 Actor 与同事务 sequence 分配、event/dedupe 幂等、attempt+factType 唯一约束（usage 例外路径）、Provider Usage Ledger 独立归属与 revision/supersede 幂等、启动 integrity 恢复与 read-only 降级、崩溃/掉电 all-or-nothing 验收。

### Modified Capabilities

- 无。纯新增模块，不改变任何现有 capability 行为。

## 方案对比与取舍

1. **推荐：SQLite WAL + 单写者 Actor（Foundation §14.4.1 已定）。** 本地事务、Unique Constraint、Crash Recovery、Projection Query 一站解决；仓库已依赖 `rusqlite`，零新依赖。代价是需要 schema migration 与 WAL checkpoint 管理。
2. **备选：继续 JSONL append。** 与旧实现接近，但多表状态（event + sequence + cursor + ledger）无法原子提交，尾行损坏处理复杂，sequence/cursor 要手写并发控制——这正是 V0 出问题的根源，不采用。
3. **取舍：Actor 用 std::sync::mpsc 专用线程而非 tokio::spawn。** 写路径是同步 rusqlite 调用，专用 OS 线程天然串行化且不阻塞 tokio runtime；A2 接入 Event Bus 时再以 channel 对接，不提前引入 async 复杂度。

## 验收标准

- 无 UI、无 Runtime Adapter 条件下证明：sequence per-session 单调；event insert + `next_sequence` 同事务 all-or-nothing；100 次重复写同一 event/attempt 不产生重复 Fact；Provider Usage Ledger 按 `(provider, window, subject, revision)` 幂等且 supersede 链正确、不伪造 `session_id`。
- 崩溃测试台：子进程在每个事务边界被 SIGKILL、以及随机点强杀 ≥50 次后，重启结果满足 all-or-nothing，无半提交、无重复 sequence、quick_check 通过。
- 启动恢复：integrity 损坏时进入 read-only recovery 并给 typed error，不创建空库覆盖；DB 缺失时才允许新建。
- Schema 保留项（Foundation §14.4.2 七条）逐条落档于 design.md。
- `cargo test --manifest-path src-tauri/Cargo.toml` 通过；`openspec validate establish-shared-event-storage --strict --no-interactive` 通过。

## Impact

- Backend：`src-tauri/src/shared_event_log/**`（新增）、`src-tauri/src/lib.rs`（导出一行）、`src-tauri/tests/**`（新增崩溃测试台）。
- 产品行为：零变化（模块无调用方，dark launch）。
- 后续依赖：Wave 2 A2 的 Canonical Fact 写入与 Commit Sink 以 `SharedEventWriter` 为唯一入口；A3 Projection 读取本模块的只读连接；B/C 的 Binding/Cursor/Pending 持久化复用 `shared_binding_state`。
