## Why

Settings 不是静态表单，而是用户控制模型、快捷键、外观、供应商、运行时行为的配置中心。视觉重设计如果没有规范，很容易无意改变 persisted settings 语义。

既成事实是：设置页基本外观和供应商面板被重设计；快捷键录入交互被优化；vendor panel 配色统一；部分 idle polling render 被稳定；当前 UI 里 Claude thinking 被写死常开/强制可见。

这里必须把“已发生的产品事实”写清楚，尤其是 thinking visibility。它可能不是未来最终设计，但当前代码就是这样，后续如果要恢复用户控制，必须显式更新 spec。

## What Changes

- 重设计 settings panel 和 basic appearance sections。
- 优化 shortcut recording/editing。
- 统一 vendor/provider panel 色彩。
- 稳定 settings 相关 idle polling render。
- 记录当前 Claude thinking forced-visible 行为事实。

## Scope / Impact

- Affected commits: `01805ddc`, `a712f0df`, `00bed0a8`.
- Impact file/surface: `src/features/settings/components/**`
- Impact file/surface: `src/features/settings/components/settings-view/sections/ShortcutsSection.tsx`
- Impact file/surface: `src/features/settings/components/settings-view/sections/BasicAppearanceSection.tsx`
- Impact file/surface: `src/features/settings/components/SessionRadarHistoryManagementSection.tsx`
- Impact file/surface: `src/app-shell.tsx`
- Impact file/surface: `src/styles/settings*.css`

## Non-Goals

- 不新增 settings storage schema。
- 不改变 vendor credential semantics。
- 不重新设计完整 settings IA。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
