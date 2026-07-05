## Why

这次变更不是单纯换皮。它把很多分散的基础控件、focus ring、border、popover、tooltip、input/select/tabs 等交互基础层，统一到同一套 shadcn / radix / zinc 语义上。代码已经落地，但如果没有 OpenSpec，后续继续做设置页、Composer、Diff、Sidebar polish 时，很容易重新长出一批同义但不兼容的控件。

既成事实是：`src/components/ui/**` 已经成为客户端基础控件层，`components.json`、theme CSS、global CSS 都已经跟随迁移。这个 retro proposal 的目标是把“以后该复用哪里、不要再新造什么”写清楚，而不是重新证明实现是否应该做。

用户已经认可当前最新代码和测试结果，所以这里记录的是已验收产品事实：视觉基线已从历史自定义控件混合态，转向 shadcn zinc token + radix interaction primitives。

## What Changes

- 以 `src/components/ui/**` 作为通用 UI primitive 的 canonical layer。
- 把常用控件的交互语义交给 radix-backed components，例如 `select`、`tabs`、`tooltip`、`switch`、`checkbox`、`dialog`、`field`。
- 让 dark/light/system theme 共享 zinc-compatible token，减少 feature CSS 自己硬编码颜色和 focus 样式。
- 保留各 feature 的业务组件边界，只把可复用基础控件下沉到 shared primitive 层。

## Scope / Impact

- Affected commits: `c4f9de84`.
- Impact file/surface: `src/components/ui/**`
- Impact file/surface: `components.json`
- Impact file/surface: `src/styles/globals.css`
- Impact file/surface: `src/styles/themes.*.css`
- Impact file/surface: `src/features/composer/** selectors`
- Impact file/surface: `src/features/vendors/**`

## Non-Goals

- 不重写信息架构。
- 不要求一次性删除所有旧 CSS。
- 不改变 runtime/backend behavior。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
