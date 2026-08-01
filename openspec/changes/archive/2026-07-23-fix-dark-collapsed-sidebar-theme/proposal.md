## Why

2026-07-19 引入的 desktop sidebar collapsed 公共规则把缺失的 `--desktop-main-background` 回退到 `#ffffff`。dark 与 system-dark 未定义该 token，导致折叠侧栏后 shell 缝隙和 Settings sidebar 继承白色背景，破坏主题一致性。

## 目标与边界

- 补齐 dark desktop shell token contract，使折叠态只使用 theme-aware surface。
- 为公共 collapsed fallback 增加 dark-safe 防御，避免缺失主题 token 时再次白屏。
- 保持 light/system-light 当前白色 shell、sidebar layout 与 collapse interaction 不变。

## What Changes

- 在 dark theme 基线中显式定义 desktop shell/sidebar/main background tokens。
- 将公共 collapsed sidebar 的硬编码白色 fallback 改为现有 dark-safe surface token。
- 添加 source-level CSS contract test，覆盖 dark、light、system-light 与公共 fallback。

## 技术方案对比

1. **推荐：补齐 theme token matrix，并修正公共 fallback。** 从 contract 根因修复，覆盖 dark/system-dark 和未来缺失 token 的主题。
2. **备选：只给 Settings sidebar 增加 dark selector。** diff 更局部，但无法修复 shell 白色竖条，并会复制主题判断。

选择方案 1；它复用现有 token，无新依赖、无组件分支。

## 非目标

- 不改变 sidebar 宽度、折叠动画、macOS traffic-light controls 或 titlebar placement。
- 不重新设计 Settings sidebar 的层级色差。
- 不改动 custom theme persistence 与 preset mapping。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `workspace-sidebar-visual-harmony`: 明确 desktop sidebar 折叠态在 dark、light 与 system appearance 下必须保持 theme-consistent shell/sidebar background。

## Impact

- CSS：`src/styles/themes.dark.css`、`src/styles/main.css`
- Test：`src/styles/desktop-shell-theme.test.ts`
- Spec：`openspec/specs/workspace-sidebar-visual-harmony/spec.md`
- 无 API、数据、依赖或 migration 变更。

## 验收标准

- explicit dark 与 system-dark 折叠侧栏后不出现 `#ffffff` shell/sidebar surface。
- Settings 页面在外层 sidebar collapsed 时不再继承白色 background。
- explicit light 与 system-light 仍保持现有白色 collapsed shell。
- focused Vitest、lint、typecheck、large-file gate 与 strict OpenSpec validation 通过。
