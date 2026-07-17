## 1. Runtime capability merge

- [x] 1.1 调整 Codex model catalog/merge：输入为 runtime model metadata 与公共 fallback，输出为 runtime-first 的逐字段 capability；验证 `useModels` focused tests 覆盖非空值不被覆盖。依赖：无；优先级：P0。
- [x] 1.2 增加按模型差异与 degraded fallback 测试：输入为 Sol/Terra/Luna 不同 options/default 和空 metadata，输出为对应 reasoning options/default；验证 focused Vitest 通过。依赖：1.1；优先级：P0。

## 2. Typed Composer effort support

- [x] 2.1 将 `ultra` 接入 `ReasoningEffort`、level metadata 与 normalization：输入为 runtime `ultra`，输出为可见、可选、可发送的 typed effort；验证 selector/adapter tests。依赖：1.1；优先级：P0。
- [x] 2.2 为所有 reasoning locale 补齐 `ultra` label/description：输入为现有 locale modules，输出为完整 translation key；验证 typecheck 与 locale consistency tests。依赖：2.1；优先级：P1。

## 3. Verification and contract closure

- [x] 3.1 运行 focused Vitest、`npm run typecheck` 与 `npm run lint`，修复本变更引入的问题。依赖：1.2、2.2；优先级：P0。
- [x] 3.2 运行 OpenSpec strict validation，并核对 delta spec 与实现一致。依赖：3.1；优先级：P0。

## 4. Runtime hydration regression correction

- [x] 4.1 将 capability precedence 与 selector display order 解耦：输入为 startup fallback 和延迟到达的 runtime metadata，输出为 runtime 覆盖后的模型专属 options，同时保持 runtime model list 顺序；验证 deferred hydration regression test。依赖：3.2；优先级：P0。
- [x] 4.2 在当前 workspace 收到 `codex/connected` 后重拉 model catalog：输入为 cold-start degraded empty response 与 runtime ready event，输出为第二次 `model/list` hydration；验证 active/non-active workspace event regression test。依赖：4.1；优先级：P0。
