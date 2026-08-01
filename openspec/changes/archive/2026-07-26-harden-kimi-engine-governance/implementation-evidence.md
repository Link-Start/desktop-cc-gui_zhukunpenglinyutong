# Implementation Evidence

## Canonical identity 与消息幕布

- 既有 Kimi pending → canonical reducer contract 已覆盖 stale history、late
  ensure、residual row 清理；`useThreadItemEvents` 覆盖 promotion 后 buffered
  delta 路由，`useAppServerEvents` 覆盖 promotion 后 terminal completion。
- 本批次未改变 `liveAssistantTextChannel` 与逐 delta 路径，只补治理和错误
  contract，避免把高频状态重新挂回 AppShell root chain。

## Config 与 provider reliability

- `read_kimi_config_document` 显式返回 `missing`、`loaded`、`malformed`、
  `io-error`，`KimiCurrentConfig` 向 frontend 投影 `configStatus` 与
  `diagnostic`。
- engine model loader 对 missing 使用 generated fallback；malformed / I/O
  failure 同样保留 fallback，但写入 `EngineStatus.error`，不再伪装正常。
- provider durable deletion 与 `~/.kimi-code/config.toml` cleanup 分离；
  cleanup 失败返回 `partial-warning`，frontend 保留 residual config warning。

## Governance 与验证

- engine branch scanner 从 `engineIds.json` 读取 built-in IDs，测试显式验证
  Kimi 被 registry 加载。
- focused Vitest 覆盖 provider warning 与 Kimi promotion；Rust fixtures 覆盖
  四种 config 状态；scanner、TypeScript、daemon compile、strict OpenSpec
  validation 通过。
