# Tasks

- [x] 1. 添加 diagnostics CPU storm 回归测试
  - [x] 1.1 `useDebugLog`：高频 watchdog scheduled 与 `thread/list response` 不写入 `diagnostics.threadSessionLog`
  - [x] 1.2 `rendererDiagnostics`：idle composer render-budget 不写入 renderer lifecycle log
  - [x] 1.3 `useThreadEventHandlers`：watchdog fired 保持强制诊断，scheduled 不再作为默认 durable 诊断输出
- [x] 2. 实现最小止血修复
  - [x] 2.1 过滤 durable thread session mirror 中的 high-churn / large-response 条目
  - [x] 2.2 将 Codex no-progress watchdog scheduled 诊断降为 verbose-only
  - [x] 2.3 在 composer render-budget service 层跳过 idle empty composer 样本
- [x] 3. 验证
  - [x] 3.1 跑定向 Vitest
  - [x] 3.2 记录未覆盖的 full-suite 风险
