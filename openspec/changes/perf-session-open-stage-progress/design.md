# Design: perf-session-open-stage-progress

## Context

打开超大会话时，幕布停在「正在加载对话窗口…」。Shared 已经有 `HistoryLoadingProgress`（prepare / session / projection / merge / finalize + percent），`HistoryLoadingSurface` 只在 `progress != null` 时画 spine。Native / DSH 选中只 `setThreadHistoryLoading(true)`，`progress` 一直是 `null`，所以只有 indeterminate 爬行灯。

DSH 打开税在 `load_dsh_session`：最多 40 次串行 host `session.history`（每页 200 message）。JS `await loadDshSession()` 期间主线程不一定忙，但幕布不能动。IPC 返回后再 `parseDshHistoryMessages` + `applyHydratedItems`。没有页事件，用户无法区分「host 还在拉第 12 页」和「JS 卡在 hydrate」。

`setThreadHistoryLoadingProgress` 的 equality 只比 `phase/percent/titleKey/detailKey`，不含 `detailParams`。页号若只活在 params 里，同 percent 会被吞。

约束：

- 不重开 `shouldVirtualizeTimelineRows`
- 不把 timeout 当打开完成
- 不新增 AppShell root state
- 不在本 change 做 DSH tail-first IPC
- 复用 Shared 进度模型，不平行造一套

## Goals / Non-Goals

**Goals:**

- Native / DSH / Claude 打开幕布能指出当前阶段。
- DSH 每拉完一页，画布在 IPC 返回前更新页号和 percent。
- Shared 现有阶段不被改口径。
- 阶段更新必须能画出来（JS 重阶段之间 yield 一帧）。

**Non-Goals:**

- 不缩短 host 40 页墙钟（那是 tail-first）。
- 不改 remote `load_dsh_session` 桥。
- 不改芯片 / 上翻 / DOM 窗。
- 不把 `latest_assistant_text` 那种内部 `load_dsh_session` 也刷幕布。

## Decisions

### D1. 复用 `HistoryLoadingProgress`，不新增进度类型

Native 阶段映射到同一 `phase` 枚举，靠 `titleKey` 区分表面：

| 打开步骤 | phase | Native 语义 | Shared 语义（不变） |
|---|---|---|---|
| 选中 / 开始 | `prepare` | 准备打开 | 准备打开 Shared |
| 拉历史 | `session` | host / 磁盘 IPC | 拉 V0 快照 |
| 规范化 | `projection` | parse / fold 后的 JS 消息 | 拉 canonical 投影 |
| 写入画布 | `merge` | hydrate + first-paint | 合并 V0 ⊕ 投影 |
| 结束 | `finalize` | 幕布可卸 | 画布恢复完成 |

**替代**：给 Native 另起 `phase: "host-page" | "parse"`。会拆 spine 和 i18n，诊断收益为零。

### D2. DSH 页事件是事实，percent 在 JS 算

Rust emit：

```text
event: dsh-history-load-progress
payload: {
  sessionId,          // host session id（无 dsh: 前缀）
  pageIndex,          // 1-based；0 = 开始拉
  maxPages,           // HISTORY_MAX_PAGES（40）
  pageEventCount,
  totalEventCount,
  hasMore
}
```

`load_dsh_session` 本体加可选 callback。`latest_assistant_text` 继续走无 callback 路径。command 层拿 `AppHandle` emit。

JS 映射：`percent = 12 + floor(pageIndex / maxPages * 50)`，夹在 12–62。细节文案带页号和累计事件数。

**替代**：Rust 直接 emit 已算好的 `HistoryLoadingProgress`。会把 i18n / phase 合同绑进 Rust，Shared 和 Native 更难共模型。

### D3. 幕布：有 progress 就出 spine

`HistoryLoadingSurface` 今天 `isShared = progress != null`。改为：

- `progress == null`：爬行灯（未知 / 尚未报阶段）
- `progress != null`：spine + percent + 细节
- spine 短标签：Shared 仍是 准备/快照/投影/合并；Native 是 准备/快照/解析/组装

选中线程时，Shared 以外也立刻写 prepare progress，避免再闪一次无阶段爬行灯。

### D4. equality 必须含 `detailParams`

抽出 `sameHistoryLoadingProgress`。页 3 和页 4 即使 percent 相同也要更新。percent 仍按页递增，双重保险。

### D5. yield 只为画阶段，不卸幕布

`yieldHistoryLoadingPaint` = 双 `requestAnimationFrame`。用在 prepare → session、session 返回 → parse、parse → hydrate 之间。禁止 `setTimeout(N)` 当「打开完成」。幕布仍由现有 `setThreadHistoryLoading(false)` 卸。

### D6. 本切片不做 tail-first

设计上把 DSH tail-first（最新一页先返回、幕布卸、后台旧页进 pending）留在 Open Questions。本切片验收只要求「15 秒里能看见卡在第几页」。

## Risks / Trade-offs

- [Risk] 页事件打进 `historyLoadingProgressByThreadId` 每页一次 setState → 走现有 domain bag，每页一次可接受；禁止把事件打进 AppShell 根业务 hook。
- [Risk] 双 rAF 让打开墙钟多 1–2 帧 → 相对 15 秒可忽略；换来阶段可见。
- [Risk] remote 模式没有页事件 → 幕布停在「正在拉取会话历史」直到 IPC 返回；proposal 已列为非目标。
- [Risk] sessionId 带不带 `dsh:` 对不上 → emit 规范化后的 host id；JS 同时认 `realSessionId` 与 `dsh:${id}`。
- [Risk] 内部 `load_dsh_session`（turn 结束后取 assistant 文本）误刷当前画布 → 无 callback 即不 emit。

## Migration Plan

1. 先落地 builder / equality / surface（纯前端，可独立验）。
2. 再落地 Rust callback + event + JS subscribe。
3. 最后把 DSH / 其他 Native resume 接到阶段报告。
4. 回滚：停 emit、选中不再写 Native prepare，幕布回到爬行灯；Shared 路径不动。

## Open Questions

- DSH tail-first IPC 的 cursor / pending 合同（独立 change）。
- remote 桥要不要透传页事件。
- Claude unified loader 是否要在磁盘 80 条 message 展开时报 parse 条数（本切片先覆盖 DSH + 非 unified Native）。
