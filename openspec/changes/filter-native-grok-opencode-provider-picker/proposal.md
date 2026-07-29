## Why

Grok 与 OpenCode Native Session 的 model selector 没有进入 Provider-scoped picker，
导致它们错误展示其他 CLI group，与 Claude/Codex/Kimi 的独立会话行为不一致。

## 目标与边界

- Grok Native Session 只展示 Grok CLI 的 Provider Profiles 与 Models。
- OpenCode Native Session 只展示 OpenCode 的 Provider Profiles 与 Models。
- 复用既有 Native Provider catalog owner，不新增选择器分支或视觉样式。
- Shared Session 与 Home create-session 继续展示五 CLI Atomic picker。

## 非目标

- 不改变 Provider continuation、Model runtime identity 或 send payload。
- 不修改 Shared Session/Home 的多 CLI 选择能力。
- 不新增 backend command、存储结构或依赖。

## What Changes

- 将 Grok/OpenCode 纳入 Native Provider Profile picker capability。
- Native catalog owner 对五个受支持 CLI 统一只返回当前 CLI group。
- 增加 Grok/OpenCode Native scope 回归测试，并保留 Shared/Home 五 CLI 断言。

### 方案对比与取舍

- **方案 A：在 `ModelSelect` render 时按 CLI 名称过滤。** 能隐藏错误菜单项，但 catalog
  owner 仍输出错误数据，其他消费方仍可能泄漏。拒绝。
- **方案 B：补齐 Native Provider capability allowlist，并由 catalog owner 统一按当前
  CLI 收敛。** 复用 Claude/Codex/Kimi 现有 contract，数据源与 UI 一致。采用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `composer-control-surface`: Native model selector 的 current-CLI scope 扩展到
  Grok 与 OpenCode。

## Impact

- Frontend：`ChatInputBox` Native picker capability 判定、Provider target catalog owner
  及 focused Vitest。
- Backend / IPC / storage：无变化。
- Dependencies：无新增依赖。

## 验收标准

- Grok 独立会话 model selector 只显示 Grok CLI Provider/Models。
- OpenCode 独立会话 model selector 只显示 OpenCode Provider/Models。
- Claude/Codex/Kimi Native、Shared Session、Home create-session 行为不回退。
- focused Vitest、TypeScript typecheck、targeted ESLint 与 OpenSpec strict validation
  全部通过。
