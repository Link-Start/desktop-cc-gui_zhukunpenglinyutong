# Implementation Evidence

## Authoritative retirement policy

- frontend settings normalization 与 AppShell engine gate 固定为 false；
  backend、daemon `engine_enabled_in_settings` 对 OpenCode 无条件 false。
- legacy `opencodeEnabled=true` 与 `defaultEngine=opencode` 会被 startup
  sanitizer 归一；所有现存 command guards 在 process spawn 前返回
  `soft-retired and blocked by runtime policy`。

## Root / UI / CSS cleanup

- AppShell 不再 import / mount `useOpenCodeSelection` 或
  `useOpenCodeThreadBinding`；两个 root helpers 与 tests 已删除。
- 删除 1011-line `OpenCodeControlPanel`、四个 section、control hook 与专属
  tests；不继续 modernize 已退休 panel。
- 删除 `opencode-panel.css` eager import/file，以及 shared scrollbar /
  composer 中只服务 OpenCode panel/model picker 的 selectors。

## Retained compatibility boundary

- 保留 history/session identity reader、realtime parser、archive/delete 与
  Rust adapter，供旧会话读取、诊断和迁移。
- 保留的 execution handlers 只作为 compatibility surface；统一 backend
  policy guard 已 fail closed，不会 spawn OpenCode CLI。
- `check:opencode-retirement` 阻止 root hook、panel、CSS 或前后端 gate 回归。

## Verification

- focused AppShell/settings/Vitest、Rust policy tests、daemon compile、
  retirement gate、TypeScript 与 strict OpenSpec validation 通过。
