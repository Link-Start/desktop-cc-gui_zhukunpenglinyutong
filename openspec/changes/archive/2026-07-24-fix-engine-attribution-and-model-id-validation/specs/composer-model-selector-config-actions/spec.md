# Delta: composer-model-selector-config-actions

## ADDED Requirements

### Requirement: Custom Model Id Validation MUST Be Consistent Across Surfaces
`isValidModelId` 与 `MODEL_ID_PATTERN` MUST 在 `composer/types/provider.ts` 保持单一实现，`vendors/types.ts` MUST re-export 同一实现，保证 dialog 录入侧与 runtime hydration 侧校验口径一致，不得存在两份漂移的正则字面量或长度上限。

#### Scenario: single validation semantics across composer and vendors
- **WHEN** 同一 model id 分别经过 `vendors/types.ts` 与 `composer/types/provider.ts` 的 `isValidModelId` 校验
- **THEN** 两侧 MUST 返回相同结果
- **AND** 两侧 MUST 共享同一 `MODEL_ID_PATTERN` 与长度上限(≤128)

#### Scenario: bracketed model ids remain valid
- **WHEN** model id 含方括号(如 `[L]gemini-3-flash-preview`)
- **THEN** `isValidModelId` MUST 接受该 id
- **AND** `validateCodexCustomModels` MUST 在 runtime 校验后保留该 custom model

#### Scenario: invalid characters are rejected at the dialog surface
- **WHEN** 用户在 `CustomModelDialog` 输入含空白或非法字符的 model id
- **THEN** `isValidModelId` MUST 拒绝该 id
- **AND** 被拒绝的 id MUST NOT 在 runtime hydration 时被静默丢弃(因为录入侧与 runtime 侧口径一致)
