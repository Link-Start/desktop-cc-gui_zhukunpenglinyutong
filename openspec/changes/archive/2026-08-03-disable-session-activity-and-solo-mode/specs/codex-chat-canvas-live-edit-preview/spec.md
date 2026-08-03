## MODIFIED Requirements

### Requirement: Live Edit Preview Is Explicitly Opt-In

系统 MUST 将 live edit preview 设计为显式 opt-in 能力。在 session activity 派生下线后，自动预览 MUST 无法获得 file-change timeline 数据源，行为上等同于未启用。

#### Scenario: preview stays off until user enables it

- **WHEN** 用户尚未开启 live edit preview
- **THEN** 系统 MUST NOT 自动打开文件或 diff 视图

#### Scenario: preview has no activity timeline while activity is disabled

- **GIVEN** workspace session activity 处于 runtime disabled
- **WHEN** AI 产生 file-change
- **THEN** live edit preview MUST NOT 依赖 activity timeline 自动打开文件
- **AND** 系统 MUST NOT 因 timeline 为空而抛错

#### Scenario: preview can be enabled inside solo

- **WHEN** Solo 模式亦被禁用
- **THEN** 本 scenario 不适用（Solo 不可达）
- **AND** 系统 MUST NOT 因 Solo 不可达导致 preview 模块崩溃

### Requirement: User Navigation Has Priority Over Preview

用户手动导航行为 MUST 高于自动预览行为。

#### Scenario: disabling preview fully stops automatic opening

- **WHEN** live edit preview 关闭，或 activity 数据源不可用
- **THEN** 系统 MUST 停止自动打开文件或 diff
- **AND** 系统 MUST NOT 要求 activity panel 仍提供手动跳转入口（activity 已 disabled）

### Requirement: SOLO Integration Remains Optional

live edit preview MUST NOT 依赖 Solo 作为唯一承载前提；在 Solo 禁用后，preview 模块 MUST 仍可安全 no-op。

#### Scenario: capability is not hard-coupled to solo container

- **WHEN** Solo 入口被移除且 activity 下线
- **THEN** live edit preview 协调逻辑 MUST 以 no-op 或空 timeline 安全退出
- **AND** MUST NOT 把核心打开文件链路硬编码为仅 Solo 可调用
