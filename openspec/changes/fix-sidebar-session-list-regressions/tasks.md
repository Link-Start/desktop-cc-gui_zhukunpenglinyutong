## 1. P0-0 吸收半成品

- [x] 1.1 修 `session_index/store.rs` 双 `#[test]`，确认 `cargo test session_index` 能编。输入：半成品 diff。输出：Index provider 列 roundtrip 绿。
- [x] 1.2 核对并保留：全局开关 UI、Index provider 透传、pending skip / remap tombstone、focus merge。输入：工作区相关文件。输出：与诊断文 §5 白名单一致。依赖：1.1。
- [x] 1.3 删除被吸收的未跟踪目录 `openspec/changes/restore-native-provider-labels` 与 `openspec/changes/stabilize-native-sidebar-during-execution`。依赖：本 change artifacts 已齐。

## 2. P0 标签与绑回

- [x] 2.1 `commitThreadSelection` / `handleSelectThread` 带上 `providerProfileId` / `providerProfileName` 并设 composer target。输入：`commitThreadSelection.ts`、`useAppShellLayoutNodesSection.tsx`。输出：切会话 picker 跟着变。验证：vitest。
- [x] 2.2 send 在用户未改选时使用 active thread binding，禁止全局上次选中盖账本。输入：composer send / ChatInputBox target。输出：payload.providerProfileId = 会话 binding。验证：vitest。依赖：2.1。
- [x] 2.3 Index merge 保留 `providerProfileName`（半成品已有 id）。输入：`useThreadActions.ts` merge。输出：刷新不丢 name。验证：既有 summary 单测扩一条。
- [x] 2.4 VendorSettingsPanel 测试改为「任意 CLI 页可见全局开关」，不再要求 Codex tab。输入：`VendorSettingsPanel.test.tsx`。验证：vitest。

## 3. P0 占位一对一

- [x] 3.1 `shouldHidePlaceholderNativeDraftFromSidebar` 增加 `isActive`：active 豁免；非 active 的弱标题（含 `Agent N`）隐藏。输入：`sessionIndexThreadSummaries.ts`。验证：单测四条 scenario。
- [x] 3.2 Sidebar / last-good / Index 投影传入 activeThreadId。子会话（`parentThreadId`）不走顶层 hide。验证：Sidebar / summaries vitest。依赖：3.1。
- [x] 3.3 确认 pending 不写 Index、remap tombstone；`setThreads` 不得把已 remap pending 再保成第二条顶层。验证：reducer / sessionIndex 单测。

## 4. P0 刷新不蒸发

- [x] 4.1 `session-index-imported` 去掉 `startupHydrationMode: "first-paint"`，只 merge。输入：`useWorkspaceThreadListHydration.ts`。验证：hydration vitest。
- [x] 4.2 merge 路径：Index ∪ 现有 ∪ last-good；短页不得盖长列表；tombstone / 删除先于 union。输入：`useThreadActions.ts`。验证：vitest「20 条内存 + 12 条 Index → 仍 20+」。依赖：4.1。

## 5. P1 Shared sqlite

- [ ] 5.1 `shared_sessions_v2` migration v3：加 `workspace_id` / `title` + index。输入：`shared_event_log/schema.rs`。验证：`cargo test` schema migrate。
- [ ] 5.2 创建 / 改标题 / 选 target 写入这两列。输入：shared session 写路径。验证：Rust 单测 upsert 后 list 能查到。依赖：5.1。
- [ ] 5.3 升级 backfill：从 Shared meta 目录一次性 upsert 进 v2（写层，不挂 first-paint）。验证：Rust backfill 单测。依赖：5.2。
- [ ] 5.4 `list_shared_sessions` 改读 v2 + `shared_binding_state` 聚合 native ids。验证：Rust + 前端 hydration 不再依赖目录 walk 权威。依赖：5.3。

> 2026-08-19 产品确认 Shared 扫目录是设计，**5.x 不做**。不改读源。

## 6. 验证与收口

- [x] 6.1 跑本 change 触及的 vitest + `openspec validate fix-sidebar-session-list-regressions --type change --strict --no-interactive`。用户确认测试通过。
- [x] 6.2 ADR 校准：Shared v2 schema **未改**，不回写 foundation 文档。
- [x] 6.3 手测：标签、切会话不卡、加载中不再先闪空。不 archive 本 change（Shared 5.x 取消但仍挂着 tasks）。
