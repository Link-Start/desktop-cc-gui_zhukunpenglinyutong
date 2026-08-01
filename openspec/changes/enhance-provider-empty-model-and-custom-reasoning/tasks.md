## 1. 自定义模型 reasoning 默认档

- [x] 1.1 [P0] 新增 `src/features/models/customModelReasoning.ts`：默认档常量 + `resolveCustomModelDefaultReasoningEffort`；验证 TS strict。
- [x] 1.2 [P0][依赖: 1.1] `useModels.readCustomCodexModelOptions` 附加默认 reasoning metadata；验证 `enrichScopedCodexReasoningMetadata` 优先语义不变。
- [x] 1.3 [P0][依赖: 1.1] `ModelSelect.buildProviderExecutionTarget` 新增可选 `defaultReasoningEffort`；`handleTargetModelSelect`/`handleChannelSwitch` 对自定义 Codex 模型播种默认档；验证既有调用不播种。

## 2. 空模型兜底与引导

- [x] 2.1 [P0] `useProviderTargetCatalogOwners.ts` 导出 invalidation API + 事件；hook 监听事件重置本地状态并 `ensureProfiles`。
- [x] 2.2 [P0][依赖: 2.1] `ensureModels` 空结果 → `resolveProviderConfiguredDefaultModel` 兜底 row（不写模块级 cache）。
- [x] 2.3 [P0] 五个 vendor management hook + cc-switch import 成功路径调用 `notifyProviderTargetCatalogChanged`。
- [x] 2.4 [P0] `ModelSelect` 空模型渠道两行引导文案；i18n zh/en 新增 key。

## 3. 验证

- [x] 3.1 [P0] focused Vitest：`useProviderTargetCatalogOwners.test.tsx`、`ModelSelect.test.tsx`、`useModels.test.tsx` 全绿。
- [x] 3.2 [P0] `npm run typecheck` + target ESLint 通过。
- [x] 3.3 [P0] `openspec validate enhance-provider-empty-model-and-custom-reasoning --strict --no-interactive` 通过。
