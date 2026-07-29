## Context

Shared history loader 已在每次 load 时读取
`VITE_MOSSX_SHARED_PROJECTION`、`mossx.sharedProjection` 与
`ccgui.sharedProjection`。当前没有 UI 控制面，人工验证必须打开 DevTools，
且 visually identical 的 Projection/V0 结果容易误判。

`OtherSection` 已包含多项 localStorage-backed diagnostics controls，并复用
`Switch`、i18n 和 focused test pattern，适合承载该临时测试入口。

## Goals / Non-Goals

**Goals:**

- 让测试者在设置页发现并切换 Shared Projection。
- 复用现有 flag 与 Settings toggle 视觉模式。
- 状态变化后确定性重跑应用初始化和 history loader。
- 保持默认关闭、V0 fallback 与 Change A dark-launch 边界。

**Non-Goals:**

- 不新增 AppSettings/Rust persistence。
- 不为单个当前会话新增热切换协议。
- 不改变真实 Shared Send 路径。

## Decisions

### D1：flag key 与读写逻辑归 Shared Projection DataSource 所有

导出 `SHARED_PROJECTION_STORAGE_KEY` 与 setter，由 Settings 只调用 public
helper。这样 loader、test control 与单元测试不各自复制 key。

备选是直接在 `OtherSection` 调 `localStorage.setItem`。代码更少，但会形成第二个
flag contract，后续改名容易 drift，因此不采用。

### D2：关闭通过 removeItem 恢复默认值

开启写 `"1"`；关闭删除 override，不写 `"0"`。环境变量或兼容 key 仍可独立开启，
UI 文案明确这是 local override。

备选是保存到 AppSettings。它需要 frontend type、Rust serde、默认值和持久化更新，
与测试用途不匹配，因此不采用。

### D3：状态变化后调用 location.reload

整页 reload 能重跑 history loader，并避免向 AppShell 引入新的自定义事件和
跨层 reload orchestration。handler 只在状态确实变化时 reload。

备选是局部刷新当前 Shared session。它会触及 active thread state、history
request race 与 Canvas lifecycle，超出测试入口范围，因此不采用。

### D4：总清单承担认知地图职责

Wave 0–6 每个任务行补充“大白话说明 / 改变点 / UI 变化”，不改变技术任务、
依赖、验收和状态。远期条目也改成相同口径。

## Risks / Trade-offs

- [Risk] reload 会打断未保存输入 → 设置说明提前提示，入口只用于开发验证。
- [Risk] `VITE_MOSSX_SHARED_PROJECTION=1` 时关闭 local override 仍保持开启 →
  UI 明确显示 effective state，并说明 build flag 优先。
- [Risk] 文档表格变宽 → 单元格保持短句，技术细节继续留在原任务与验收列。

## Migration Plan

1. 发布时默认 flag 不变，用户不会自动进入 Projection。
2. 测试者手工开启；需要回滚时关闭开关，local override 被删除并 reload。
3. Change B 稳定后再决定删除测试入口或升级为正式配置。

## Open Questions

- Change B 完成 V0→V2 切换后，该入口是删除还是迁移到“实验性功能”，留待
  Change B closure 决策。
