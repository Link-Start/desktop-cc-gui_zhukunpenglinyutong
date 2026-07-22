## Context

`.app.layout-desktop.sidebar-collapsed` 在 `.app` 上重写 `--desktop-shell-background` 与 `--desktop-sidebar-background`。light/system-light 定义了 `--desktop-main-background`，dark 基线没有，因此公共 `#ffffff` fallback 会同时渲染 app shell 暴露区，并通过 CSS custom property inheritance 污染嵌入 Settings sidebar。

## Goals / Non-Goals

**Goals:**

- 建立 dark/light/system appearance 完整的 desktop shell token contract。
- collapsed 状态缺少 `--desktop-main-background` 时仍回退到 theme-aware surface。
- 用一个 source contract test 锁定 token 与 selector，避免依赖脆弱的截图测试。

**Non-Goals:**

- 不改变 layout grid、sidebar visibility、transition 或 titlebar controls。
- 不引入新的 theme resolver、runtime state 或 dependency。
- 不调整 Settings component markup。

## Decisions

### Decision: dark theme 显式定义 desktop shell token

在 `themes.dark.css` 的 canonical `:root` token 集中定义：shell/main 复用 `--surface-messages`，sidebar 复用 `--surface-sidebar`。explicit light 与 system-light 现有更具体 token 继续覆盖这些基线。

Alternative：只修改 collapsed selector fallback。拒绝，因为 token matrix 仍不完整，其他 `--desktop-*` consumer 仍可能遇到相同缺口。

### Decision: 公共 fallback 使用 `--surface-messages`

collapsed selector 继续保持“shell == main”的既有语义，但最终 fallback 改为 `var(--surface-messages, #0d0f14)`，避免未知/custom appearance 缺 token 时默认白色。

Alternative：新增 dark-only selector 覆盖 `#ffffff`。拒绝，因为会复制 appearance branch，且不能保护未来主题。

### Decision: 使用 CSS source contract test

沿用 `src/styles/*.test.ts` 读取 CSS 的项目模式，断言 dark token、公共 fallback 和 light/system-light override 均存在。

Alternative：组件/jsdom computed-style test。拒绝，因为 jsdom 对 CSS import/custom property cascade 的渲染证据有限，测试成本更高但信号更弱。

## Risks / Trade-offs

- [Risk] `themes.dark.css :root` 同时是 system-dark 基线 → explicit light/system-light 已用更具体规则覆盖；测试锁定覆盖关系。
- [Risk] source test 不能替代真实 WebView visual QA → 验证 selector contract，并保留一次 dark 折叠人工 smoke test 作为建议，不阻塞自动闭环。
- [Trade-off] collapsed Settings sidebar 会沿用“shell == main”背景，而非单独维持 sidebar 层级色差；这是现有 collapsed 设计语义，本次只消除错误白色 fallback。

## Migration Plan

1. 先补 dark desktop tokens。
2. 再替换公共 collapsed fallback。
3. 运行 focused test、lint、typecheck、large-file 与 strict OpenSpec validation。
4. 回滚时同时撤销两处 CSS 和 contract test；无数据迁移。

## Open Questions

- 无。
