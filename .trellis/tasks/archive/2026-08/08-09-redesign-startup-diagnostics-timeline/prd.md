# 重构启动诊断时间轴

## 规范来源

- OpenSpec change：`openspec/changes/redesign-startup-diagnostics-timeline/`
- Visual decision：A `adaptive compact`

## 目标

- 将 `StartupGateOverlay` 的 startup/runtime 双栏原始列表替换为单列 vertical timeline。
- 按启动阶段、运行阶段展示；相同 operation 仅在 project/status 兼容时聚合，并显示 `×N` 与耗时摘要。
- workspace-scoped 节点常显 project name；hover/focus/click detail 显示完整 path、technical identifier 与耗时明细。
- 每个已知 operation 提供“后台在做什么”的简短说明；未知项保留 technical label 并使用诚实 fallback。
- 一键复制继续使用原始 events/notices，内容、顺序与详细度不变。

## 能力边界矩阵

| 能力 | 本任务 | 并行 cold-start 任务 |
|---|---|---|
| 诊断展示形态、聚合、语义说明 | 修改 | 不依赖 |
| 展开诊断后的 passive behavior / 禁止 `scrollIntoView` | 保留，不重引入自动滚动 | 修改并已加回归测试 |
| startup scheduler / hydration / timeout | 不修改 | 保留 |
| renderer diagnostics persistence / frame monitor | 不修改 | 保留 |
| Tauri / Rust / session scanner | 不修改 | 保留 |

## 独占目标文件

- `src/features/app/components/StartupGateOverlay.tsx`
- `src/features/app/components/StartupGateOverlay.test.tsx`
- `src/features/app/components/StartupDiagnosticsTimeline.tsx`（新增）
- `src/features/app/components/StartupDiagnosticsTimeline.test.tsx`（新增）
- `src/features/app/utils/startupDiagnosticsTimelineProjection.ts`（新增）
- `src/features/app/utils/startupDiagnosticsTimelineProjection.test.ts`（新增）
- `src/i18n/locales/zh/runtimeNotice.ts`
- `src/i18n/locales/en/runtimeNotice.ts`

落盘前必须确认以上文件无新增并行改动。`StartupGateOverlay.tsx` 与其 test 已出现并行 passive-diagnostics 修改；实施时逐段 semantic merge，保留删除 `scrollIntoView` 与对应回归测试。其余 performance/cold-start dirty files 全部只读。

## 验证

- focused Vitest：projection、component、overlay 与 raw diagnostic copy。
- `npm run typecheck`
- target ESLint
- `npm run check:large-files`
- `openspec validate redesign-startup-diagnostics-timeline --strict --no-interactive`

## 回滚

恢复 `StartupGateOverlay` 原双栏 render，删除新增 timeline 文件与 i18n keys。无 backend、storage 或 data migration。
