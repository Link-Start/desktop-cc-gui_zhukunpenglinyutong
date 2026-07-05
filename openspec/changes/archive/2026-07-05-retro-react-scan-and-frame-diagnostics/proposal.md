## Why

性能问题如果没有现场证据，就会变成主观感受。用户看到“卡”，开发者需要知道是哪个组件重渲染、哪段时间掉帧、当时是否在 streaming、是否有 recent interaction。

既成事实是：react-scan controller 和 settings toggle 已接入；frame-drop attribution 和 web-vitals runtime gate 已加入；diagnostics report/export 可以辅助定位。已有 `enable-claude-lightweight-streaming-and-frame-attribution` 进一步覆盖 Claude lightweight streaming 和 frame attribution，本 retro change 记录更基础的诊断 surface。

关键边界：diagnostics 默认关闭，不能为了诊断引入新卡顿；诊断记录不能包含 prompt、message body、stdout/stderr、secret 等敏感内容。

## What Changes

- 接入 react-scan diagnostics controller 和设置页开关。
- 掉帧归因到 recent react-scan renders。
- web-vitals collection 改为 runtime-gated。
- 提供 diagnostics report/export plumbing。

## Scope / Impact

- Affected commits: `de47ee6d`, `95c613fc`.
- Impact file/surface: `src/services/reactScanController.ts`
- Impact file/surface: `src/services/perfBaseline/**`
- Impact file/surface: `src/services/rendererDiagnostics.ts`
- Impact file/surface: `src/features/settings/components/settings-view/sections/OtherSection.tsx`
- Impact file/surface: `vite.config.ts`

## Non-Goals

- 不强制所有用户开启 diagnostics。
- 不收集 message content 或 sensitive prompt data。
- 不重复定义 Claude lightweight streaming contract。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
