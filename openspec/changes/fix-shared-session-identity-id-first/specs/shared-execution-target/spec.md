# shared-execution-target Specification (delta: ADDED)

## ADDED Requirements

### Requirement: Shared Target Change MUST Survive Identity Projection Loss

Shared Session 的 target picker 变更 MUST 只更新 `selectedNextTarget`；即使 Shared 身份投影（`threadKind` / `isSharedSession` prop）暂时丢失，系统 MUST NOT 因此退化为 Native 行为——MUST NOT 触发 Native Provider 续接、MUST NOT 新建会话、MUST NOT 将 `shared:` id 作为 native session 来源。

#### Scenario: channel switch with lost projection persists shared target only

- **WHEN** 用户在 Shared Session 中将 target 切到 Claude/Codex managed 渠道，且当时 `threadKind` 投影丢失（summary 存在但 kind 非 shared）
- **THEN** 系统 MUST 调用 Shared target 持久化（`set_shared_session_selected_engine`）并 hydrate `selectedNextTarget`
- **AND** MUST NOT 调用 `requestProviderContinuationDialog`
- **AND** MUST NOT 弹出「续接没有完成」类 Native 续接 UI

#### Scenario: locked shared picker stays inert under projection loss

- **WHEN** `sharedTargetPickerLocked` 为 true 且身份投影丢失
- **THEN** target 点选 MUST 为 no-op
- **AND** MUST NOT 落到 Native 续接分支（locked 不构成身份判定的替代依据）
