# Tasks: restore-sidebar-background-scan-sqlite

> 优先级：P0 投影并集 → P0 升级强制首拍 → P1 freshness 闸 → P2 事件重读。  
> 禁止与 `fix-model-picker-send-authority` 混测、混 commit。  
> 不重做 `complete-native-sidebar-session-index` 的路径钥匙 / 超时空提交 / 热路径零扫盘。

## 1. P0 last-good 做 floor

- [x] 1.1 把 `useThreadActions.ts` 空列表 last-good 从「整表替换」改成 D3 并集：Index 行保留；补 last-good 中更新或缺失的 `(engine, session_id)`。输入：`useThreadActions.ts` + last-good helpers。输出：Index 非空不再丢掉更新的 C。验证：vitest「A,B on Index + C on last-good → 画出 A,B,C」。
- [x] 1.2 空 Index fallback 不得把 last-good 写成新权威。输入：`lastGoodSnapshotCandidates` 赋值。输出：timeout 空回落仍画旧行，但不 `rememberLastGood` 覆盖。验证：vitest empty-timeout 不 promote。
- [x] 1.3 tombstone / 用户删除 / 权威空证明仍先于 union。输入：既有 filter。输出：已删行不会被 last-good 救回。验证：vitest 权威空 + tombstone。

## 2. P0 升级 / 冷启强制首拍

- [x] 2.1 importer 生命周期第一拍对每个 workspace `sync_session_index_core(..., force=true)`。输入：`importer.rs`。输出：首拍不可 `skipped_fresh` 结束。验证：Rust 单测 first_tick force。
- [x] 2.2 首拍延迟避开启动点击冻结（秒级，不得空转满 45s 才第一次读盘）。输入：`IMPORT_INITIAL_DELAY`。输出：冷启后有界时间内开始 force sync。验证：常量 / 单测；不把扫盘挂上 first-paint。
- [x] 2.3 后续 90s 拍保持 `force=false`。验证：Rust 第二拍走 freshness。

## 3. P1 freshness 不得挡住磁盘更新

- [x] 3.1 skip 前比较磁盘最新会话 mtime 与账本该引擎 `max(updated_at)`。输入：`writers.rs` / `store.rs`。输出：根 fingerprint 未变但子会话更新时继续 upsert。验证：Rust「root fresh + child newer → not skip」。
- [x] 3.2 timeout / list error 仍不标 fresh（对齐前序 D2，本 change 只加回归，不改契约）。验证：既有 timeout 单测仍绿。

## 4. P2 imported 事件重读

- [x] 4.1 `session-index-imported` 对 active workspace 重读 Index，merge 走 D3。输入：`useWorkspaceThreadListHydration.ts`。输出：upserted>0 后新行可见。验证：hydration vitest。
- [x] 4.2 force 首拍 partial 且 upserted=0 不得标权威空、不得清 last-good。验证：vitest。

## 5. 验证与边界

- [x] 5.1 确认 first-paint / 切项目 / focus-refresh 仍零引擎 disk list。验证：既有 hydration 哨兵 + 本 change 新测。
- [x] 5.2 跑触及的 Rust + vitest；`openspec validate restore-sidebar-background-scan-sqlite --type change --strict --no-interactive`。
- [ ] 5.3 Windows 手测：升级或杀进程前新建会话，重启后 ≤ 首拍窗口内出现在侧栏；无需手动刷新。**不 archive 直到手测勾选。**
