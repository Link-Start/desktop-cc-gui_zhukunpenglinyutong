## Why

model catalog 同时来自 runtime、configured/custom、frontend fallback、Rust fallback 和 provider preset，且 provider metadata 在 DTO 边界丢失。CLI refresh 失败时，不同 engine 可能清空列表、切换 roster 或由前端重新猜 provider。

## 目标与边界

- 建立 `runtime > configured > cached > generated fallback` 的统一 precedence。
- provider 与 protocol 正交建模。
- model metadata 携带 source、provenance、lifecycle、freshness 与 stale/error。
- refresh 失败保留 last-good cache。

## What Changes

- 统一 catalog DTO 和 merge policy。
- Codex/Claude/Kimi 的 runtime/configured/fallback 接入同一 contract。
- 每个 engine 只保留一个 generated fallback owner。
- provider metadata 完整序列化；prefix inference 仅作 legacy bare-ID fallback。

## 方案比较与取舍

- 方案 A：每个 engine 保持独立 catalog，只共享 TypeScript type。无法消除 precedence 和 degraded-mode 分叉，拒绝。
- 方案 B：共享 catalog runtime/policy，engine adapter 提供 source loader。采用；统一事实层但不抹平 engine discovery 差异。

## Capabilities

### New Capabilities

- `model-provider-catalog-runtime`: 定义跨 engine catalog source、precedence、cache、provider/protocol 与 provenance contract。

### Modified Capabilities

- `codex-model-catalog-coverage`: 收敛双重 fallback owner，并明确 last-good cache。
- `claude-dynamic-model-discovery`: 将 builtin/settings/custom merge 纳入统一 precedence 与 metadata contract。

## 验收标准

- refresh failure 不清空最后成功目录，并显示 stale/error。
- 同一 engine 只有一个 generated fallback roster。
- provider/source/provenance 穿过 Rust/daemon/TypeScript DTO。
- degraded mode 的 model order 和选择结果可重复。

## 非目标

- 不实现 marketplace provider 安装。
- 不承诺所有 CLI 都支持 runtime model discovery。
- 不删除用户 custom model。

## Impact

- Rust `ModelInfo`、engine status/catalog commands、daemon mirror。
- Frontend models/vendors/controller catalog merge。
- Codex、Claude、Kimi focused catalog tests。
