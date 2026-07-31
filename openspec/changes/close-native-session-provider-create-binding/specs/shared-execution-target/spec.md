## ADDED Requirements

### Requirement: Shared Provider Channel Switch MUST Reload Model Catalog Before Updating Target

Shared Session 模型选择器在同一 CLI 下切换 Provider 时，MUST 先加载该 Provider 的 model catalog，再更新 `selectedNextTarget`；MUST NOT 在 catalog 未就绪时沿用上一 Provider 的 model id。

#### Scenario: switch claude provider reloads models for next send

- **WHEN** 用户在 Shared Session 的 Claude 目标 Picker 中将 Provider 从 A 切换为 B（不发送消息）
- **THEN** 系统 MUST 按 `engine=claude + providerProfileId=B` 拉取（或命中缓存）模型目录
- **AND** 对话框模型列表 MUST 展示 B 的模型，而不是 A 的模型
- **AND** 系统 MUST 将 `selectedNextTarget` 更新为包含 B 与 B catalog 内合法 model 的完整 target（在 catalog 非空时）
- **AND** 系统 MUST NOT 创建新会话、MUST NOT 走 Native Provider 续接流程

#### Scenario: empty catalog does not keep previous provider model id

- **WHEN** 用户切换到 Provider B 且 B 的 model catalog 当前为空（仍在加载或加载失败）
- **THEN** 系统 MUST NOT 把上一 Provider A 的 `modelCatalogEntryId` / `model` 写入 B 的 `selectedNextTarget`
- **AND** 加载成功后用户再次选择或切换完成时 MUST 使用 B 的模型

#### Scenario: picker still selection-only

- **WHEN** 用户仅切换 Shared Provider/Model 而不提交消息
- **THEN** 系统 MUST 只更新 `selectedNextTarget`（及为展示所需的 catalog/mapping）
- **AND** MUST NOT 创建 hidden binding 或启动 native session（与既有 four-level picker 契约一致）

### Requirement: Shared Claude Model Labels Prefer Provider-Scoped Catalog Runtime Names

当 Shared/Atomic catalog 返回带 `providerProfileId` 的 Claude 模型行时，选择器展示名 MUST 优先使用该行的 provider-scoped runtime name（如 `model.model`），MUST NOT 被全局 localStorage ANTHROPIC 映射中的上一渠道值永久盖住。

#### Scenario: scoped runtime name wins over stale global mapping

- **WHEN** 全局 Claude model mapping 仍为上一渠道（如 deepseek-v4-pro），而当前 Shared 渠道 catalog 行为 MiniMax runtime
- **THEN** 模型列表行 MUST 显示 MiniMax runtime 名（或 catalog 已写入的 label/model）
- **AND** MUST NOT 全部显示为上一渠道映射名
