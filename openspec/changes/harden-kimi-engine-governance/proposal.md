## Why

Kimi 已是完整 CLI engine，但 scanner、config diagnostics、provider cleanup 和 main spec 没有跟上。其 pending-to-canonical promotion 又处于消息一致性关键路径，foundation 重构最容易在这里产生重复 row 或永久 processing。

## 目标与边界

- 将 Kimi 纳入 engine branch governance。
- 保留并加强 canonical promotion 时序 contract。
- 区分 config missing、malformed 与 I/O error。
- provider cleanup failure 必须可观察。
- 补齐 runtime/history/lifecycle/provider durable requirements。

## What Changes

- scanner 从 canonical built-in registry 获取 engine ID，短期确保覆盖 `kimi`。
- Kimi config loader 返回结构化状态，仅 missing 可静默 fallback。
- cleanup 主删除与外部 config 清理返回 typed success/warning/error。
- 扩展 Kimi main spec Purpose、history、CLI lifecycle、provider materialization 与 promotion regression。

## 方案比较与取舍

- 方案 A：把 Kimi 特例全部吸收到通用 identity/catalog change。会掩盖 Kimi 配置和 promotion 的独立失败模式，拒绝。
- 方案 B：通用 foundation + Kimi compatibility change。采用；共享 contract，保留 engine-specific 验收。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `kimi-engine-runtime`: 补齐 canonical convergence、history、CLI lifecycle、provider/config diagnostics 与 governance gate。

## 验收标准

- history-first、queued-delta-late、terminal-after-promotion 均只保留 canonical row。
- config malformed/I/O failure 不伪装成 builtin-only 正常状态。
- provider cleanup 残留通过 warning 可见。
- scanner 能阻止新增 Kimi literal engine branch。

## 非目标

- 不重写 Kimi CLI protocol。
- 不为 Kimi 伪造 mid-turn stdin。
- 不改变用户已有 Kimi session ID。

## Impact

- Kimi Rust runtime/history/provider modules。
- Kimi realtime/history frontend adapters。
- Engine scanner、OpenSpec main spec 和 focused tests。
