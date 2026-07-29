## 1. Source excerpt projection

- [x] 1.1 [P1, depends: none] 输入 `ConversationItem[]`，实现 feature-local pure helper，输出最后一轮可读 user / assistant excerpt；用 focused unit cases 验证 tool/reasoning 尾项、空白文本、缺失 assistant 与仅 assistant 边界。
- [x] 1.2 [P1, depends: 1.1] 输入 `threadItemsByThread[sourceSessionId]`，在 `useLayoutNodes` continuation projection 中输出稳定 excerpt props；验证缺失数组不触发 history load。

## 2. Card presentation

- [x] 2.1 [P1, depends: 1.1] 输入 excerpt props，在 expanded `ProviderContinuationContextCard` 中输出紧凑、line-clamped、i18n 化的 user / assistant 摘录与 fallback。
- [x] 2.2 [P1, depends: 2.1] 扩展 component tests，验证 collapsed 默认态、展开内容、无 Assistant、未加载/不可用 fallback、icon navigation 与再次折叠。

## 3. Contract and verification

- [x] 3.1 [P1, depends: 1.2, 2.2] 同步 `native-provider-continuation` main spec，并执行 focused Vitest、`npm run typecheck`、lint、build 与 OpenSpec strict validation。
- [x] 3.2 [P2, depends: 3.1] 记录 verification evidence，完成 OpenSpec verify、sync 与 archive；保留人工视觉验收由用户执行且不启动 App。
