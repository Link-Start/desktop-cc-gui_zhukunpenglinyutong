## Why

Native Session 幕布在 2026-08-01 前后完成统一呈现升级（轻量摘要墙下线、Grok/Kimi/OpenCode 过程投影、过程阶段自动折叠、终轮 footer meta、fileEdit 场景折叠、滚动所有权）。渲染核 `Messages → Timeline → Row` 与 Shared 共用，但 Shared **历史投影管线**仍停留在“摘要级 ConversationItem”，重开 / 切换后幕布保真度明显落后于 Native。

产品预期是：**同一套幕布契约，Shared 与 Native 在可读过程与终轮元数据上对齐**。

## 目标与边界

- 明确 Native 今日幕布增量 vs Shared 投影缺口矩阵。
- 把 Shared 历史路径补到与 Native 幕布**契约兼容**的水平：终轮 footer（完成时间 / 耗时 / token）、工具过程卡可分类与可折叠、bash 可按引擎策略隐藏。
- 继续走 **一套 Messages 核**；不拆 Shared 专用 Row。
- 改动集中在 Shared Projection（Rust projector + FE dataSource 契约）与回归测试。

## 非目标

- 不为 Shared 重写第二套 Messages / Timeline。
- 不把 Canonical Fact 升级成完整 Native transcript 镜像（artifact 全量 diff / 私有 payload 原样保留仍可按需降级）。
- 不改 Native engine history loader / Grok jsonl 桥（已服务 Native + Shared live）。
- 不改 Shared send pipeline / binding / recovery。
- 本 change 默认允许实现与验证；git commit 需用户明确要求。

## What Changes

### 已确认的分层结论

| 层 | Native | Shared | 是否共通 |
|----|--------|--------|----------|
| L3 渲染核 Messages / process collapse / fileEdit / scroll | ✅ 今日已升级 | ✅ 同核 | **共通** |
| L2 Live adapter | 薄 engine adapter | `sharedRealtimeAdapter` + `buildConversationItem` | **基本共通**（live 事件仍可走富 item） |
| L1 History / projection | engine-specific loaders（富 item + final meta） | `SharedProjector` + `toSharedConversationItems` | **缺口在此** |

### Native 今日多加、Shared 欠缺（根因）

1. **终轮 footer meta 不完整**
   - Native：`finalCompletedAt` + `finalDurationMs` + `finalInputTokens` / `finalOutputTokens`
   - Shared projector：只写 `isFinal` + `finalCompletedAt`；`UsageRecorded` 投影成 `metadata`，FE 明确丢弃 → 重开后无耗时/token
2. **历史 tool 保真度不足**
   - Native：`fileChange` / `commandExecution` / `mcpToolCall` + `changes[]` / 可 parse 的 args
   - Shared：统一 `kind=tool` + `toolType=tool_name` + `arguments_summary`/`output_summary`，fileEdit 场景与 bash hide 分类弱
3. **过程阶段折叠 / 读改写卡**依赖 tool 分类与 turn 归属；摘要级 tool 导致 Shared 历史过程叙事残缺
4. **Live 路径相对完整**（owner rewrite threadId 后走 `buildConversationItem`）；用户感知“欠缺”多出现在 **history reload / 切回重投** 后

### 变更范围

- `src-tauri/src/shared_projection/projector.rs`：终轮 meta 盖章；tool 类型/路径保真增强
- `src/features/messages/presentation/sharedProjection/dataSource.ts`：已支持 final* 字段时补测试；必要时透传 `changes`
- 回归：Rust `shared_projection` 测试 + FE dataSource 测试
- 文档：analysis 矩阵补 Shared 历史行

## 方案对比

| 方案 | 说明 | 结论 |
|------|------|------|
| **A. 投影侧补齐 footer + tool 分类/路径** | 不改 Messages 核；history 重载即可对齐 | **采用** |
| B. Shared 历史改走 Native loader | 破坏 canonical ownership / multi-target | 拒绝 |
| C. 只在 FE merge legacy 富 item | V2 无 legacy 时仍空 | 仅作 fallback，不作主路径 |

## Capabilities

### New Capabilities

- `shared-session-curtain-parity`：Shared 历史投影与 Native 幕布契约对齐（final meta、tool 过程分类、可渲染 detail）

### Modified Capabilities

- （若触及既有 shared-projection 行为，在 apply 时补 delta）

## Impact

- Shared Session 重开 / 投影 rebuild 后的幕布可读性
- Rust shared_projection 测试
- FE sharedProjection dataSource 测试
- 无 DB schema 变更；Usage 仍保留 metadata 项供 shadow/comparator，同时盖章到 assistant message

## 验收标准

1. Shared 历史终轮 assistant 在有 `UsageRecorded` 时展示 token；在有 request+commit 时间时展示耗时
2. Shared 历史 tool 可被 `classifyToolCategory` 分到 read/edit/bash/search；edit 类尽量带 path 线索
3. bash/command 在 shared 目标引擎为 claude/codex/grok/kimi/opencode 时仍可被幕布 hide 策略命中
4. Native Session 行为无回归
5. 既有 usage precedence 测试仍通过（metadata 项不消失）
