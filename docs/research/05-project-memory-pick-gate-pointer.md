---
type: research
status: active
---

<!-- DOC-LIFECYCLE: active-pointer -->

# Project Memory · Pick Gate 文档指针

**更新**: 2026-08-10  
**用途**: 把「发送前记忆挑选闸门」与 Phase-2 检索/可观测升级的实现指导收口，避免在 historical research 里分叉。

## 读哪里

| 优先级 | 路径 | 内容 |
|--------|------|------|
| 0 | `openspec/changes/add-memory-pick-gate/README.md` | **闸门 Phase-1 变更总索引** |
| 1 | `openspec/changes/add-memory-pick-gate/ux.md` | **UI/UX 定稿**（时序、C 布局、交互矩阵、a11y、文案 key） |
| 2 | `openspec/changes/add-memory-pick-gate/design.md` | **工程设计**（架构、状态机、DTO、编排、测试、触点） |
| 3 | `openspec/changes/add-memory-pick-gate/proposal.md` | Why / 边界 / 拍板表 |
| 4 | `openspec/changes/add-memory-pick-gate/tasks.md` | 实现任务拆分 |
| 5 | `openspec/changes/add-memory-pick-gate/specs/**` | 行为 delta |
| 6 | `docs/prototypes/memory-pick-gate-ui-variants.html` | 可交互金样 |
| **7** | **`docs/research/06-memos-vs-mossx-memory-upgrade-research-2026-08-10.md`** | **MemOS 对照调研 + Phase-2 匹配/可观测/转接决策** |
| **8** | **`openspec/changes/enhance-memory-pick-retrieval-and-observability/`** | **Phase-2 OpenSpec change（proposal/design/tasks/delta）** |
| 9 | `openspec/specs/project-memory-local-semantic-retrieval/spec.md` | hybrid / 诚实 lexical 合同 |
| 10 | `openspec/specs/project-memory-retrieval-pack-cleaner/spec.md` | Pack / Instruction 合同 |

## 与历史文档关系

- `00`–`04` project-memory research 为 **historical / superseded** 基线，说明 Phase1 与旧消费模型。  
- **不得**用旧「仅 Claude+Codex」「隐式自动注入」章节覆盖本 change。  
- 主行为 specs 仍以 `openspec/specs/project-memory-*` 为准；闸门落地后通过 delta + sync 更新。  
- **MemOS 参考**：早期设计曾参考 MemOS；升级后的对照结论只以 `06-memos-vs-mossx-…` 为准，勿从旧口头印象推断。

## Phase 状态

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase-1 Pick Gate | 代码已合（含 always 读秒 arm/interrupt、顶栏 UI） | 时序 + 闸门 + pack source=memory-pick |
| Phase-2 匹配 + 可感 + 转接 | **OpenSpec 已写 · 待实现** | `enhance-memory-pick-retrieval-and-observability`；见 `06` §4；**不改采集 ABCD** |

## 一句话

- **Phase-1**：用户气泡先待发送 → 其下无框挑选流 → 本轮手勾或 session top(n) → 确认后才调模型。  
- **Phase-2**：hybrid 同核检索 + 空/超时可感埋点 + 注入语义转接（记忆服务原文，不抢戏）；采集写路径零回归。
