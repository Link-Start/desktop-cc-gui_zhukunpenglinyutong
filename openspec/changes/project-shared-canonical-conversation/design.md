# Design: project-shared-canonical-conversation

> 上游：Foundation Design §14.2、§17.6（[`mossx-multi-cli-provider-session-foundation-design.md`](../../docs/research/mossx-multi-cli-provider-session-foundation-design.md)）、Wave 2 实现（`assemble-shared-canonical-facts`）。
> 本文把 Canonical Fact → UI 的投影设计落成 Rust/TypeScript 模块设计；行为语义见 `specs/shared-canonical-projection/spec.md`。

## Context

Wave 2 完成后，Shared Event Log 已经能可靠地写入 canonical fact，但 UI 层（Canvas / Messages）仍只能消费 V0 的 snapshot 与 runtime event。需要一个单向、可重建、与 Native 完全隔离的投影层：

```text
Shared Event Log (canonical fact)
      ↓
Shared Projection (Rust)
      ↓
ConversationItem[] (JSON over Tauri IPC)
      ↓
Shared DataSource (Frontend)
      ↓
Canvas / Messages (render)
```

关键约束：
- `ConversationItem` 只能作为 Presentation Model，不得承载 Canonical Fact、ACK、Cursor 或 Recovery Truth（设计红线 #31）。
- `threadItems.ts` 不得承担 Canonical normalization、跨 Target replay 或 Shared persistence（红线 #34）。
- Legacy snapshot 必须以 `fidelity = "presentation-only"` 读取，不伪造 Tool ID/Signature/Target（红线 #24）。
- Shared/Native 双 DataSource 必须隔离，Native Canvas 行为零回归（§17.6）。

## Goals / Non-Goals

**Goals:**

1. Rust 侧实现 `SharedProjector`：把 `shared_event_log` 中的 canonical fact 映射为幕布兼容的 `ConversationItem` JSON。
2. 实现 Projection checkpoint：使用 `shared_projection_checkpoint` 表记录 `projectionVersion + throughSequence`；支持增量更新与全量 rebuild。
3. 实现 Legacy snapshot dual-read reader：读取旧 Shared snapshot（V0），映射为 `fidelity = "presentation-only"` 的 `ConversationItem`，旧文件不改写。
4. 实现 Shadow Projection 对比器：把 A2 Shadow Log 的 projection 结果与 Legacy dual-read 对比，只记录 mismatch，不反向写。
5. 前端实现 `SharedDataSource`：独立 DataSource，与 Native DataSource 隔离；Shared 会话走 Shared DataSource，Native 会话走原路径。
6. Canvas 防回归：Native golden fixtures + render regression 通过；Shared 不引入 duplicate Assistant Final、Tool Exchange 断裂或逐 delta 根 dispatch。

**Non-Goals:**

- 不实现 ContextCompiler（Wave 5 C）。
- 不实现 NativeHistoryReader / Provider Continuation（Wave 6 D）。
- 不接入真实 Shared 流量（Wave 4 B）。
- 不修改 `threadItems.ts` 的核心 normalization 逻辑。

## Decisions

| # | 决策 | 依据 |
|---|---|---|
| D1 | Projection 逻辑放在 Rust 侧（`shared_projection`），前端只消费 `ConversationItem[]` JSON | Rust 侧离 SQLite 最近，避免前端重复解析 fact payload；保持 Frontend 纯 Presentation |
| D2 | `ConversationItem` 作为 Presentation Model，不得承载 `bindingKey`、`cursor`、`ack`、`recovery` 等事实字段 | 设计红线 #31；任何 Canonical 事实只能通过 `SharedProjector` 派生，不能反向作为事实源 |
| D3 | Projection checkpoint 使用 `shared_projection_checkpoint` 表；`projectionName` 区分不同 projection（如 `canvas`、`sidebar`） | A1 已建好表；checkpoint 允许删除后完全 rebuild |
| D4 | Legacy dual-read 通过独立 `LegacySharedReader` 实现，输出 `fidelity = "presentation-only"` 的 `ConversationItem` | 设计红线 #24；旧数据不进入 Shared Event Log，不伪造缺失协议事实 |
| D5 | Shadow 对比器是 read-only 工具：读取 Shadow Log 与 Legacy snapshot，生成 mismatch 报告，不修改任何存储 | dark launch 纪律；A3 只消费 Shadow Log，不作为 ingress，不回写产品状态 |
| D6 | 前端 Shared DataSource 是可选 DataSource 实现；Messages/Canvas 组件保持兼容，不感知 Shared/Native 差异 | 最小侵入；Native 路径完全不变，Shared 通过 feature flag 切换 |
| D7 | Canvas 防回归通过 golden fixtures + render 测试实现：Native fixture 走原路径，Shared fixture 走 SharedProjection，对比渲染结果 | §17.6 硬门禁；Native golden fixtures 失败即阻断合并 |
| D8 | `projectionVersion` 每次修改投影规则时递增；checkpoint 不匹配时自动触发全量 rebuild | 保证投影规则演进后可重建 |

## Module结构

```text
src-tauri/src/shared_projection/
  mod.rs              // 公开导出
  types.rs            // ProjectionItem / ProjectionCheckpoint / MismatchReport
  projector.rs        // Canonical Fact → ProjectionItem 映射
  checkpoint.rs       // checkpoint upsert / read / invalidate
  rebuild.rs          // 全量 rebuild 逻辑
  legacy_reader.rs    // Legacy snapshot dual-read（presentation-only）
  comparator.rs       // Shadow vs Legacy 对比器
src-tauri/src/shared_event_log/writer.rs
  + read_projection_events(session_id) -> Vec<StoredEvent>
  + upsert_projection_checkpoint(checkpoint) -> Result<()>
  + get_projection_checkpoint(session_id, name) -> Option<StoredCheckpoint>
src/features/messages/presentation/sharedProjection/
  types.ts            // 与 Rust 对齐的 TypeScript 类型
  dataSource.ts       // SharedDataSource 实现
  comparator.ts       // Shadow 对比 UI 展示（可选，dev build）
src-tauri/tests/
  shared_projection.rs        // 投影、checkpoint、rebuild 集成测试
  legacy_dual_read.rs         // Legacy dual-read 集成测试
  canvas_regression.rs        // Canvas 防回归 golden fixture 测试
```

## 关键 API

```rust
pub struct ProjectionItem {
    pub id: String,
    pub kind: ProjectionItemKind,
    pub content: serde_json::Value,
    pub fidelity: Fidelity,
    pub checksum: String,
}

pub struct SharedProjector {
    pub fn project_events(&self, events: &[StoredEvent]) -> Vec<ProjectionItem>;
    pub fn rebuild(&self, writer: &SharedEventWriter, session_id: &str) -> Result<Vec<ProjectionItem>, StoreError>;
}

pub struct LegacySharedReader {
    pub fn read_snapshot(&self, path: &Path) -> Result<Vec<ProjectionItem>, StoreError>;
}

pub struct ShadowComparator {
    pub fn compare(&self, shadow: &[ProjectionItem], legacy: &[ProjectionItem]) -> MismatchReport;
}
```

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| Canonical Fact 字段与 `ConversationItem` 字段不匹配 | 投影信息丢失 | `content` 使用 `serde_json::Value` 保留完整原始字段；Renderer 只读常用字段，extra 字段不阻塞 |
| Projection rebuild 大 session 性能差 | 启动/重建慢 | checkpoint 增量更新；rebuild 只在 checkpoint 失效或版本升级时触发；测试覆盖大 session |
| Legacy snapshot 格式漂移 | dual-read 失败 | `LegacySharedReader` 对未知字段宽容，已知字段按 presentation-only 映射；不支持的字段进 `omissions` |
| Shared/Native DataSource 切换导致 Canvas 闪烁 | 用户体验 | DataSource 切换只在会话切换时发生；同一会话内不混用两种 DataSource |
| Shadow 对比产生大量 mismatch | 阻塞 A3 验收 | mismatch 分级：fatal（Tool Exchange 断裂 / duplicate final）必须修复；warn（字段缺失）允许记录后继续 |
