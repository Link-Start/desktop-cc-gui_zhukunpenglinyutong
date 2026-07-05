## Context

记录 react-scan overlay、frame-drop attribution、runtime web-vitals gate、diagnostics report/export 的诊断能力。

性能问题如果没有现场证据，就会变成主观感受。用户看到“卡”，开发者需要知道是哪个组件重渲染、哪段时间掉帧、当时是否在 streaming、是否有 recent interaction。

## Decisions

- react-scan overlay 由 runtime setting 控制。
- Frame diagnostics 记录 component/timing/context，不记录 raw content。
- Web-vitals 采集从 build-time gate 转为 runtime gate。

## Risks And Guardrails

- 诊断本身造成性能损耗。
- 诊断内容泄露用户对话或命令输出。
- 防线：默认关闭、内容脱敏、只记录性能元数据。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-react-scan-and-frame-diagnostics --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
