# 动态派生 Codex 限额标题

## OpenSpec

- Change: `derive-rate-limit-label-from-window-duration`
- Source of truth: `openspec/changes/archive/2026-07-24-derive-rate-limit-label-from-window-duration/`

## 目标

复用现有 `RateLimitSnapshot.*.windowDurationMins`，让 Usage panel 与本地 `/status` 动态显示限额窗口标题，消除 `5h limit` hardcode。

## 范围

- frontend presentation mapping 与 focused tests。
- 不修改 backend、IPC、刷新逻辑、百分比、reset time 或 multi-limit protocol。

## 验收

- 行为、边界与验证命令以对应 OpenSpec proposal/design/spec/tasks 为准。
