# Kimi 会话身份收敛设计

## 问题

Kimi 新会话在 frontend 先以 `kimi-pending-*` 展示，CLI 随后才通过
`session.resume_hint` 暴露真实 `session_*`。当前 backend 在真实 identity
未知时预生成 UUID 并作为 `sessionId` 返回，同时 sidebar history 独立扫描
`session_index.jsonl`。三个 identity source 异步到达时会产生两个 row，且
`turn/started` 与 terminal event 可能落在不同 key，留下永久 processing residue。

## 决策

采用 pending alias + canonical promotion：

1. `kimi-pending-*` 仅是 frontend runtime alias，不是可持久化 session identity。
2. 新 Kimi turn 在 CLI 给出真实 `session_*` 前，backend response 不得声明
   canonical `sessionId`，也不得为 Kimi 预生成不可恢复的 UUID。
3. `session.resume_hint` 是 realtime canonical identity authority。promotion 必须以
   `workspaceId + turnId` 定位 pending owner，并原子迁移 items、processing、
   active turn、selection、title mapping 与 live text channel。
4. history scan 若先发现 canonical row，promotion 必须合并到该 row；不得保留
   pending sibling。terminal event 必须清理 canonical row 及其仍存在的 pending alias。
5. realtime delta 可能在 promotion 前以 pending id 入队、在 promotion 后才 flush。
   operation 落 reducer 前必须重新解析 canonical alias，禁止用 retired pending id
   执行 `ensureThread`、processing mark 或 content dispatch。
6. canonical row 的 `nativeThreadIds` 是 replaced-id tombstone。reducer 不得重建其中
   的 pending id，history refresh 也不得因 processing/item anchor 保留该 residual row。
7. 若 canonical identity 尚未确认，delete 不应伪装成功；pending row 只能由
   lifecycle settlement/reconciliation 清理。

## 备选方案

- 仅隐藏重复 row：拒绝，因为错误 identity 与 processing residue 仍存在。
- 等待真实 identity 后才创建 UI row：拒绝，因为会破坏 optimistic composer feedback。

## 验证

- Frontend regression 覆盖 history row 先到、pending promotion、queued pending delta
  迟到 flush、最后 terminal settlement 的完整顺序。
- Rust regression 覆盖新 Kimi turn 不返回 fabricated session id。
- Focused Vitest、Rust test、typecheck、lint、runtime contracts 与 strict OpenSpec
  validation 全部通过。
