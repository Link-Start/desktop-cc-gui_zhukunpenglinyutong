# Messages Components 目录整理 PRD

## 关联变更

- OpenSpec change: `refactor-messages-presentation-architecture`
- Scope: `src/features/messages/components` 的一级小型组件、pure helpers 与对应 tests
- Delivery mode: move-only, behavior-preserving refactor

## 目标

1. 保留 `Messages.tsx`、`MessagesTimeline.tsx`、`MessagesRows.tsx`、`Markdown.tsx` 与 `toolBlocks/**` 的当前位置。
2. 将小型 UI components 按 `conversation / context / media / recovery` 分类。
3. 将 Markdown runtime helpers 迁入 `rendering/markdown`。
4. 将 presentation policy、pure utilities、constants 与 types 移出 `components`。
5. 测试与被测源码 co-locate；跨组件集成测试继续保留在核心入口附近。

## 硬约束

- 不修改 JSX、CSS、i18n、DOM contract、streaming、virtualization 或 runtime recovery 行为。
- 不引入 dependency、barrel export、global state 或新 abstraction。
- 不整体移动四个超过 large-file threshold 的核心入口。
- 不深入改造 `Markdown.tsx` 与 `toolBlocks/**` 内部实现。
- 所有 import 更新必须保持单向 dependency 与 type-only import 语义。

## 验收标准

- `components` 一级实现文件显著减少，源码按职责可发现。
- paired tests 与源码位于同一目录。
- messages suite、typecheck、lint、large-file、`git diff --check` 通过。
- OpenSpec strict validation 通过。
