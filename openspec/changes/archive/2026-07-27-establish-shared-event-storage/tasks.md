# Tasks: establish-shared-event-storage

## 1. Schema 与基础设施（A1.1）

- [x] 1.1 [P0, depends: none] `shared_event_log/{mod,error,schema,checksum}.rs`：六表 DDL + `user_version` migration + PRAGMA 设置 + deterministic-json/SHA-256；单测覆盖 migration 幂等、checksum 键序无关。
- [x] 1.2 [P0, depends: 1.1] `recovery.rs`：open 恢复（单错误输出 `quick_check`、ReadOnlyRecovery、不建空库覆盖、新建专用目录 0700 / DB 0600）；单测覆盖损坏文件与新建路径。

## 2. Writer 与幂等（A1.2、A1.3）

- [x] 2.1 [P0, depends: 1.1] `writer.rs`：`SharedEventWriter` 单写者 Actor（mpsc + 专用线程）、`append_event` 同事务 sequence 分配、`Duplicate` outcome；单测覆盖 sequence 单调、事务回滚、三条幂等路径 100 次重复写。
- [x] 2.2 [P0, depends: 2.1] `upsert_binding_state` 与 binding/cursor/pending 查询 API；单测覆盖 `(session_id, binding_key)` 唯一与 JSON 列 round-trip。

## 3. Provider Usage Ledger（A1.4）

- [x] 3.1 [P0, depends: 1.1] `ledger.rs`：PK 幂等、revision = 当前最高 + 1、supersedes 链校验、无 `session_id` 归属；单测覆盖 100 次重放、revision 跳跃拒绝、aggregate-only。

## 4. 崩溃/掉电测试台（A1.5）

- [x] 4.1 [P0, depends: 2.1, 3.1] `src-tauri/tests/shared_event_log_crash.rs`：victim 子进程模式，四个事务边界逐一 SIGKILL + 随机强杀 ≥50 轮；断言 all-or-nothing、无重复 sequence、quick_check 通过、重启幂等。

## 5. Gate 1 验证

- [x] 5.1 [P0, depends: 4.1] `cargo test --manifest-path src-tauri/Cargo.toml` 全量通过；`openspec validate establish-shared-event-storage --strict --no-interactive` 通过。
- [x] 5.2 [P0, depends: 5.1] 对照 Gate 1：无 UI/Adapter 条件下 sequence 单调、all-or-nothing、重启正确、Ledger 幂等，逐条勾选并回填任务清单。

## 6. Review Remediation（2026-07-27）

- [x] 6.1 [P0, depends: 2.1] `SharedEventStore` 收为 crate-private；集成与 crash harness 也只经 `SharedEventWriter` 写入，消除生产 API 绕过单写者边界。
- [x] 6.2 [P0, depends: 2.1,3.1] event / Ledger 幂等 key 命中时比较 payload checksum（Ledger 同时比较 event id）；不同内容返回 typed `IdempotencyConflict`。
- [x] 6.3 [P0, depends: 2.1] 仅最后一个 writer handle 可 shutdown；Clone 提前 shutdown 被拒绝且 actor 保持可用。
- [x] 6.4 [P1, depends: 1.2] 澄清 `quick_check(1)` 只限制错误输出而非 wall-clock；既有父目录不被擅自 chmod，unknown fidelity 读取 fail closed。
