---
type: research
status: active
---

<!-- DOC-LIFECYCLE: active-pointer -->

# Project Memory · Pick Gate 文档指针

**更新**: 2026-08-10  
**用途**: 把「发送前记忆挑选闸门」的实现指导收口到 OpenSpec change，避免在 historical research 里分叉。

## 读哪里

| 优先级 | 路径 | 内容 |
|--------|------|------|
| 0 | `openspec/changes/add-memory-pick-gate/README.md` | **变更总索引** |
| 1 | `openspec/changes/add-memory-pick-gate/ux.md` | **UI/UX 定稿**（时序、C 布局、交互矩阵、a11y、文案 key） |
| 2 | `openspec/changes/add-memory-pick-gate/design.md` | **工程设计**（架构、状态机、DTO、编排、测试、触点） |
| 3 | `openspec/changes/add-memory-pick-gate/proposal.md` | Why / 边界 / 拍板表 |
| 4 | `openspec/changes/add-memory-pick-gate/tasks.md` | 实现任务拆分 |
| 5 | `openspec/changes/add-memory-pick-gate/specs/**` | 行为 delta |
| 6 | `docs/prototypes/memory-pick-gate-ui-variants.html` | 可交互金样 |

## 与历史文档关系

- `00`–`04` project-memory research 为 **historical / superseded** 基线，说明 Phase1 与旧消费模型。  
- **不得**用旧「仅 Claude+Codex」「隐式自动注入」章节覆盖本 change。  
- 主行为 specs 仍以 `openspec/specs/project-memory-*` 为准；本 change 落地后通过 delta + sync 更新。

## 一句话

用户气泡先待发送 → 其下无框挑选流 → 本轮手勾或 session Top3 → 确认后才调模型。
