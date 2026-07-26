# Implementation Evidence

## Source inventory 与 precedence

- Codex：backend `model/list` runtime source、config model / custom configured
  source、per-workspace last-good cache、generated fallback。
- Claude：Rust curated builtin、settings/env configured override、frontend custom
  configured models。既有 runtime-model dedupe/override behavior 保留。
- Kimi：`KIMI_MODEL_NAME` env、`config.toml` configured models、generated
  fallback；provider metadata 从 config 一直保留到 DTO。
- Gemini：configured runtime model 优先，generated fallback 只保留 stable
  roster；移除 frontend 未发布 preview hardcode。
- OpenCode 处于 soft-retired boundary，不新增 fallback owner；其 runtime
  discovery 继续作为兼容只读输入，治理在专属 change 完成。
- Shared merge 固定 `runtime > configured > cached > fallback`，同层
  first-owner，key 为 engine + provider + model id。

## DTO、cache 与 generated owner

- `ModelCatalogEntry` 将 provider、protocol、source、provenance、
  observedAt / lastVerifiedAt / lifecycle 正交建模，不从 model prefix 推断。
- Rust / daemon `ModelInfo` 现在序列化 provider，并增加 protocol、
  provenance；Kimi、Claude 与 generated fallback loaders 写入完整 metadata。
- `createModelCatalogCache` 只在非空 validated refresh 后 commit；失败返回
  last-good reference、stale/error，`useModels` 保留原 selection 并输出
  secret-safe debug evidence。
- `generatedModelCatalog.json` 是 Codex / Gemini / Kimi fallback 唯一 roster owner；
  TypeScript 与 Rust `include_str!` 都从同一 artifact 投影。

## Consumer 与 migration

- Codex Composer、Project Map、ChatInputBox 继续消费
  `CODEX_MODEL_CATALOG` compatibility facade，但 roster 已由 generated
  artifact 生成。
- `useModels` 使用 shared precedence merge，并保留 runtime 下发的
  provider / protocol / provenance。
- Claude custom model projection增加 configured provenance；model mapping
  migration 读取两个 legacy key 后只写 canonical key，并删除 legacy copies。
- `check:model-provider-catalog` 校验 roster completeness、duplicate id、
  Rust/TS owner parity 与 provider serialization。

## Verification

- focused Vitest：merge/cache、last-good refresh、storage migration、
  Composer model fallback、Claude custom/provider fixtures。
- focused Rust：20 个 engine status tests，包含 generated DTO round-trip。
- daemon compile、TypeScript compile、catalog governance gate、strict
  OpenSpec validation。
