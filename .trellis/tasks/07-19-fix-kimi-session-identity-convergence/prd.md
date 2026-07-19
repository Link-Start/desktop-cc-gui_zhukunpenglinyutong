# 修复 Kimi 会话身份收敛

## Goal

修复 Kimi 首轮消息偶发生成两个 sidebar conversation、orphan row 永久运行且无法选择或删除的问题。

## OpenSpec

- Change: `add-kimi-engine`
- Contract: `kimi-engine-runtime`

## Requirements

- Kimi canonical session identity 只能来自 CLI 的真实 `session_*`。
- `kimi-pending-*` promotion 必须与已经被 history scan 加入的 canonical row 合并。
- terminal event 必须清理 canonical identity 和 matching pending alias 的 lifecycle state。
- 不改变其他 engine 的 session lifecycle。

## Acceptance Criteria

- [ ] 一次 Kimi 提问只显示一个 sidebar row。
- [ ] 完成、失败或停止后不残留永久“运行中”。
- [ ] canonical row 可以选择、加载和删除。
- [ ] frontend/Rust regression 在修复前失败、修复后通过。
- [ ] focused tests、typecheck、lint、runtime contracts 与 OpenSpec validation 通过。
