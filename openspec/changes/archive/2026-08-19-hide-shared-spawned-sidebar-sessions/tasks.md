## 1. Index omit Shared protocol owners

- [x] 1.1 [P0][依赖: 无] Claude Index：首条真实 user 为 MOSSX 协议则保留 MOSSX 标题入库（history.jsonl「继续」不得覆盖）。输入: `writers.rs` peek/omit。输出: protocol owner 标题仍以 `MOSSX_` 开头。验证: cargo 单测 history 标题 vs MOSSX 正文
- [x] 1.2 [P0][依赖: 1.1] protocol hide 收录文件 sessionId。输入: `shared_visibility.rs`。输出: `protocolHiddenNativeIds` 含文件 UUID。验证: visibility 单测

## 2. Sidebar pup hide by Shared-owned parent

- [x] 2.1 [P0][依赖: 1.2] `buildSharedSidebarHiddenParentKeys` 并入 protocol file ids；parent 不在 threads 时仍 hide、禁止升根。输入: `sharedSessionSummaries.ts` / `useThreadRows.ts`。输出: Shared-owned Claude subagent 不进侧栏树。验证: Vitest
- [x] 2.2 [P0][依赖: 2.1] Codex `thread_spawn.parent_thread_id` ∈ hide set 则藏；TUI Socrates/Singer 负例可见。输入: `isSharedSidebarHiddenPup` + identity。输出: Shared pup hide / native tree keep。验证: Vitest 正负例

## 3. Ingest 不得把 omit owner 加回

- [x] 3.1 [P0][依赖: 1.2] Index early-paint / merge 对 protocol-owned id 走同一 hide identity，禁止「继续」行回流。输入: `nativeIndexProjection` / helpers strip。输出: 友好标题 native 行仍被剥。验证: Vitest

## 4. 碰撞测试与校验

- [x] 4.1 [P0][依赖: 1–3] 碰撞：Claude dump 形态 fixture（MOSSX + subagent parent=fileUuid）必须藏；本机 Socrates `01a00d8f-…` / Singer `019fc810-…` 必须显。验证: focused cargo + vitest
- [x] 4.2 [P0][依赖: 4.1] `openspec validate hide-shared-spawned-sidebar-sessions --strict`。不自动 commit
