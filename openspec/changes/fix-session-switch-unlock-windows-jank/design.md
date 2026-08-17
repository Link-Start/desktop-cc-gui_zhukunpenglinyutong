# Design: fix-session-switch-unlock-windows-jank

## Context

0.9 AppShell S4：`selectAppShellDomainBag` / `sessionIdentityContext` 已进 render。首轮已把侧栏 / instance / search / workspace-flows 接到 `commitThreadSelection`，并去掉 empty-Claude force 与 empty-V0 hard-wait。

Review 后仍卡的 click-path：

1. `applyThreadSelectIdentity` 仍同步 `setActiveEngine`，identity 帧多一次 setter。
2. `setActiveThreadId` 对 `!isLoaded` 的 claude/shared 同步 `setThreadHistoryLoading(true)`。空 surface（含没开始对话）也拉幕布。
3. `items=[] && !isLoaded` 既是 never-started，也是「有历史尚未 resume」的正常态。不能对所有空 surface skip resume。
4. 0.8.9 `d82b82f81` 的可参考约束是「切会话不要扫盘 / full-catalog」，不是 engine-rail UI。

## Goals / Non-Goals

**Goals**

1. identity 帧只提交 workspace + thread。
2. 未加载且可能有历史的 Native / Shared 在 select 帧拉幕布；never-started 不 resume、不拉幕布。
3. 切会话不触发 thread list disk/full-catalog。
4. recovery click 先 paint；成功空 V0 可交互。

**Non-Goals**

- merge / cherry-pick 0.8.9 click handler 或 CLI rails。
- 把 Session Index 收成侧栏唯一数据源（冷启动路径，非 click）。
- 新增 bag key 或恢复 flatten API。
- 用固定 timeout 当冷启动修复。
- 把 empty hydrate 标 `loaded=true`。
- 改 recovery exit ladder / abandon 合同。

## Decisions

### D1 — identity 只留 workspace + thread（修订）

```text
applyThreadSelectIdentity   // selectWorkspace + setActiveThreadId
scheduleChrome(default startTransition)
  applyThreadSelectChrome   // engine + settings / diff / home / tab / collapse
```

`setActiveEngine` 属于 chrome。未知 engine source 忽略。

### D2 — never-started skip + 空 surface 不拉幕布（修订）

`decideThreadSelectResume`：

| 条件 | 动作 |
|------|------|
| processing | skip |
| `historyLoadingFailed` | skip（显式 `refreshThread` 才重试） |
| **known never-started** | skip（不 resume） |
| loaded 且未到 20s | skip |
| loaded 且 ≥20s | refresh |
| !loaded 且空 surface 且 20s 内已 resume | skip empty-cooldown |
| !loaded 且空 surface 首次（未知是否有历史） | resume，Native/Shared 拉幕布 |
| !loaded 非空 / 有历史 hint | resume，Native/Shared 拉幕布 |

**known never-started** 仅当：

- thread id 含 `-pending-`，或
- sidebar summary 明确 `sizeBytes === 0` 且无 `physicalPath`

禁止把「无 summary」或「summary 缺 size/path」当成 never-started——那会跳过第一次打开有历史的会话。

`sizeBytes === 0` 必须活过 catalog / live merge：

- `extractThreadSizeBytes` 保留显式 0，缺失字段仍是 `undefined`（禁止 `asNumber` 把缺失变成 0）
- `mergeSessionDisplaySummary` 用 `next.sizeBytes ?? previous.sizeBytes`，避免后到的 undefined 抹掉 Index 的 0

select 路径对未加载 Native / Shared **必须** `setThreadHistoryLoading(true)`。known never-started / loaded / failed 不拉幕布。真正的 Claude blank curtain 仍走 `scheduleClaudeBlankCurtainRecovery`。

删除已死的 `shouldForceThreadResumeOnCallback`（failed 已在决策层 skip）。

### D3 — 切会话不扫盘

`handleSelectThread` / `handleSelectWorkspaceInstance` / `navigateToThreadWithUiOptions` / search thread+message **不得**调用 `ensureWorkspaceThreadListLoaded` 或 force full-catalog。workspace 连接、展开侧栏、归档删除仍可 hydrate list。

### D4 — recovery prefetch + 一帧 yield（保持）

`recovery-required` 时 `prefetchRecoveryOwner(workspace+thread)`。click 先 `yieldRecoveryClickPaint`。`handleAuto` 第一次 `takePrefetched`，第二次 owner 查找不走 cache。

### D5 — 空 V0 = Phase-A（保持）

成功 `loadSharedSession`（含 `items=[]`）即 Phase-A。fail-closed 仅当 V0 load 本身失败。

### D6 — 无 ADR

不改 engine registry、Shared 支持集合、provider binding、canonical fact schema、ACK、recovery abandon 语义。

## Risks

| 风险 | 缓解 |
|------|------|
| Index 行缺 sizeBytes 的真实会话 | 当未知，后台 resume 一次，并显示 select 幕布 |
| 空会话 20s 内缺迟到 transcript | cooldown 后再 resume；failed 走显式 refresh |
| startTransition 推迟 engine 一帧 | 选中态先出，符合 Win hit-test |

## Migration

无数据迁移。行为：切未开聊 / 切单会话 / 点自动处理更快可点。
