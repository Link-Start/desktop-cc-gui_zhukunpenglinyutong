# Stabilize Semantic Navigation Lifecycle

## Goal

实现 OpenSpec change `stabilize-semantic-navigation-lifecycle`：让 Java、TypeScript/JavaScript、Rust semantic provider 在单次 navigation timeout 后保留健康 session，支持 readiness/indexing 状态、idle prewarm 与安全 data ownership。

## Requirements

- 以 `openspec/changes/stabilize-semantic-navigation-lifecycle/**` 为 behavior source of truth。
- 15 秒 request timeout 只 cancel request，不杀死存活 provider。
- indexing 不自动触发 workspace-wide fallback。
- Java/TS/JS/Rust 共用 lifecycle metadata 与 prewarm contract。
- dev/release cache namespace 隔离，同 data directory 防止双 owner。
- 不新增第三方 dependency，不进入 typing/hover 热路径。

## Acceptance Criteria

- [ ] OpenSpec tasks 全部完成并严格验证。
- [ ] Rust lifecycle、timeout、notification、data ownership tests 通过。
- [ ] Frontend normalization、prewarm、indexing UI focused tests 通过。
- [ ] Typecheck、targeted lint、runtime contracts、cross-layer check 通过。

## Technical Notes

保持现有 `CodeNavigationResponse.result` 兼容；新增 lifecycle metadata 与 narrow prepare command。所有 async effect 必须 cleanup，backend global session locks 不跨 process lifecycle await。
