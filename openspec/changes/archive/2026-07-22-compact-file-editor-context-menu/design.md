## Context

文件 tab menu 与 file editor menu 共用 `.fvp-tab-context-menu` 的 `34px` min-height、`8px 10px` padding 和 `7px` outer padding。上一变更已为 file editor menu 增加 `.fvp-file-context-menu` modifier，因此本次可在不改 DOM、不扩散 shared defaults 的情况下局部压缩密度。

## Goals / Non-Goals

**Goals:**

- 明显减少 file editor menu 总高度。
- 保持 `13px` text、现有宽度、ellipsis、shortcut slot 与 scrolling。
- 保持其它菜单视觉不变。

**Non-Goals:**

- 不删除或重排 menu items。
- 不修改 global UI scale 或 shared renderer defaults。
- 不增加 JS runtime logic。

## Decisions

### Decision 1: 使用 scoped CSS override

在 `.fvp-file-context-menu` 及其 descendants 上覆盖 outer padding、item geometry、separator spacing 和 icon geometry。它利用已有 modifier class，不增加 component prop 或 state。

Alternative：修改 `.fvp-tab-context-menu` 会连带压缩 tab menu；修改 `.renderer-context-menu` 会影响全应用菜单，均不采用。

### Decision 2: 保持文字与宽度不变

只缩小 vertical whitespace 和 icon，保持 `13px` font 与 `238px` min-width。长中文 action 不会因本次调整增加截断，shortcut hint 也保留右侧空间。

### Decision 3: 维持最小 `30px` click target

`min-height: 30px` 配合 `padding: 5px 8px`。这是桌面高密度菜单的折中；继续压到 26px 以下会显著降低鼠标命中稳定性。

## Risks / Trade-offs

- [Risk] selector specificity 不足 → 使用 `.fvp-file-context-menu .renderer-context-menu-*` 覆盖已有 file-view selector。
- [Risk] icon 与文字缩放不同步 → 同时覆盖 icon container 与 SVG 为 `14px`。
- [Risk] 菜单过密 → 保持 `30px` min-height、`13px` font 与 unchanged line-height。

## Migration Plan

纯 CSS 可回滚变更。删除 `.fvp-file-context-menu` compact overrides 即恢复原密度，无数据迁移。

## Open Questions

无。
