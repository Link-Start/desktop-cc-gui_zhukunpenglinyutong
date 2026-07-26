## Context

历史 retirement change 已移除 frontdoor，但 main `opencode-engine` 仍描述 active heartbeat/timeout/provider UX，代码也残留 root hook/CSS/panel。

## Goals / Non-Goals

**Goals:** production 不可达、legacy setting normalization、root cleanup、最小 compatibility。

**Non-Goals:** 不全删历史 parser/storage，不 modernize panel。

## Decisions

1. soft-retired 是显式 policy state，不等同 binary missing；所有入口先经过 policy。
2. legacy `enabled=true` 归一为 false，并产生一次 migration diagnostic，不恢复 UI。
3. history reader/diagnostics 可保留，但 send/start/control command 在 production policy 下 fail closed。
4. 删除不可达 UI 及专用 CSS；共用 parser 只有被 compatibility tests/reader 使用才保留。

## Risks / Trade-offs

- [旧用户无法继续 OpenCode] → breaking 事实在 release notes/notice 明示；恢复需新 proposal。
- [误删共享样式/helper] → `rg` caller audit + targeted build/tests。
- [main specs 冲突] → 移除 active UX requirements，新增 retirement capability。

## Migration Plan

先锁 policy tests，再移除 root wiring/CSS/panel，最后裁剪 dead runtime。可回滚 wiring，但不得绕过 policy。

## Open Questions

是否进入完整 hard-delete 不阻塞本 change；残余清单在 verification 中量化。
