## Why

Shared Session 在 realtime 幕布中能够显示 reasoning，但重新打开 history 后 reasoning 消失；同一 Turn 的实时 assistant row 无 Execution Target 标识，reload 后又可能显示“历史配置未知”。根因是 Shared history loader 用不完整的 canonical projection 整体替换了已持久化的 presentation snapshot，且 realtime normalized item 未携带冻结的 `TurnExecutionSnapshot`。

## 目标与边界

- 让 Shared Session 复用 Native Session 的 `NormalizedThreadEvent → ConversationItem → assembler` 幕布事实链。
- realtime 与 history 对同一 Turn 展示一致的 CLI、Provider、Model、Reasoning effort。
- history 保留 realtime 已展示并持久化的 reasoning/tool facts，保持原顺序且不重复。
- canonical projection 继续提供 authoritative Turn identity；Legacy snapshot 只补充 presentation-only transcript facts。
- 显式 local/default target 固化为 `providerProfileSource = "disk"` 与“本地配置”；真正缺少 durable identity 的 legacy Turn 仍显示“历史配置未知”。

## 非目标

- 不从 Native history 文件反向拼装 Shared Session。
- 不改变 Provider 私有 reasoning 的 portability/context delivery 规则。
- 不迁移或重写既有 Shared Session 文件。
- 不启用全量 Shared Projection rollout，不新增轮询或 AppShell root subscription。

## What Changes

- Shared realtime adapter 把 `activeTurnTarget` 注入映射后的 assistant `ConversationItem`，沿用现有 assembler 合并与 snapshot persistence。
- Shared history loader 从“canonical 整体替换 legacy”改为 assembler-based convergence：Legacy snapshot 保持 transcript 顺序，canonical items 覆盖/补齐 frozen target identity。
- Shared local/default send boundary 补齐明确的 disk Provider snapshot，防止新 Turn 误落“历史配置未知”。
- 增加 focused tests，覆盖 realtime Badge、history reasoning preservation、canonical/legacy 去重与 Provider identity。

## 方案对比

1. **仅 UI fallback**：改动最小，但没有修复 history fact loss，reload 后仍不可靠。
2. **仅扩展 canonical commit**：能修未来 Turn，但无法恢复现有 Legacy snapshot 已保存而 canonical 缺失的 reasoning。
3. **Native-style convergence（采用）**：复用 normalized adapter/assembler；Legacy 提供 presentation transcript，canonical 提供 authoritative identity。同时修复既有与未来会话，且不访问 Native history。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `conversation-realtime-history-parity`: Shared realtime 与 history 必须通过同一 Conversation fact/assembler 语义收敛，reasoning 不得在 reload 后消失。
- `shared-canonical-projection`: canonical/legacy dual-read 必须保留 presentation-only transcript facts，并用 canonical frozen identity 覆盖而非丢弃 transcript。
- `shared-execution-target`: realtime assistant item 与 reload projection 必须携带同一 frozen target；local/default target 必须明确固化 disk semantic。

## 验收标准

- Shared realtime assistant row 在生成期间显示正确的 CLI / Provider / Model / Reasoning Badge。
- reload 后同一 Turn 的 Badge 不变。
- realtime 可见的 reasoning 在 history 中仍存在，顺序一致且不重复。
- Claude 与 Codex Shared Session focused fixtures 均通过。
- 不引入 Native history access、root render subscription 或秒级轮询。

## Impact

- Frontend realtime routing、conversation assembler、Shared history loader、Execution Target normalization。
- Focused Vitest suites 与 OpenSpec delta specs。
- 无新 dependency、无持久化 schema migration、无 breaking API。
