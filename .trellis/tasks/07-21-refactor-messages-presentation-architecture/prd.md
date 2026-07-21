# Messages Presentation Architecture 重构 PRD

## 关联变更

- OpenSpec change: `refactor-messages-presentation-architecture`
- Scope: `src/features/messages` 的核心三件套及其直接 helper
- Delivery mode: behavior-preserving incremental refactor

## 背景

`Messages.tsx`、`MessagesTimeline.tsx`、`MessagesRows.tsx` 已分别增长到约 2,864、2,311、2,040 行；`MessagesTimelineProps` 包含约 87 个顶层字段。当前实现已经通过 stable timeline snapshot、live row override、virtualization、hydration、scroll convergence 与 row-level live text channel 解决多轮真实性能问题，但职责边界、目录结构与接口规模已经降低可维护性。

## 目标

在完全保持 UI、交互、数据语义、DOM contract、streaming、virtualization、bottom-follow、runtime recovery 和公开 import 行为不变的前提下：

1. 按 `orchestration / timeline / rows` 建立高内聚目录边界。
2. 将 `MessagesTimeline` 的扁平 props 收敛为职责明确的 typed view models。
3. 将 pure helper 从 `components/` 同级堆叠迁入对应领域目录。
4. 将 timeline rendering、virtualization governance 与 row components 从超大文件中拆出。
5. 将 `Messages.tsx` 的 typed model stability、anchor navigation 与 linked-run surface 下沉到独立模块。
6. 保留三个核心 public entry 路径，避免仓库其他模块一次性迁移 import。

## 硬约束

- 不改变用户可见行为、CSS、i18n 文案和 DOM 语义。
- 不改变 `MessagesProps` 公共接口。
- 不改变 `Markdown` 与 `toolBlocks` 公共接口或内部实现。
- 不引入新 dependency、global store 或高频 React Context。
- 不恢复逐 delta parent timeline derive；`liveAssistantTextChannel` 保持现有 owner。
- 不把 move-only 与 behavior change 混在同一阶段。
- 现有 regression tests 必须在阶段边界保持通过。

## 非目标

- 不重新设计对话 UI。
- 不修改 Provider runtime、history loader 或 backend contract。
- 不优化 Markdown parser、tool card visual design 或 CSS。
- 不清理 `messages` 目录之外的无关技术债。

## 目标结构

```text
src/features/messages/
  components/        # stable public entry + untouched Markdown/toolBlocks
  orchestration/     # presentation, interactions, scrolling, typed models
  timeline/          # components, projection, virtualization
  rows/              # row components, row models, row presentation
  hooks/
  utils/
  presentation/
  constants/
  types.ts
```

## 验收标准

- `MessagesTimeline` 对外内部接口收敛为约 7 个 typed models。
- stable snapshot 与 live model 保持独立引用边界。
- 独立 presentation rows 位于 `rows/components`，MessageRow live text subscription 与 memo comparator 保持原 owner。
- timeline projection / virtualization / hydration / scrolling helpers 位于对应领域目录。
- 三个核心入口职责显著收敛，且无 circular dependency。
- focused messages tests、typecheck、lint 通过；full test、large-file 与 heavy-test-noise 的 pre-existing unrelated failures 有明确 evidence。
- `openspec validate --change refactor-messages-presentation-architecture --strict` 通过。
