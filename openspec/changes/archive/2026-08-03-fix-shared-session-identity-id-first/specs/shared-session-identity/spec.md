# shared-session-identity Specification (delta: ADDED)

## ADDED Requirements

### Requirement: Shared Thread Identity MUST Resolve Id-First

系统 MUST 以 thread id 前缀 `shared:` 作为 Shared Session 身份的 hard gate；`threadKind` 投影 MUST 仅作为兜底信号，MUST NOT 单独充当身份判定依据。身份判定 MUST 收敛到单一共享 helper（id-first, kind-second），picker、发送、删除、续接等消费方 MUST NOT 各自维护第二份判定逻辑。

#### Scenario: shared id with missing threadKind resolves as shared

- **WHEN** 活动 thread id 以 `shared:` 开头，且 thread summary 缺失或 `threadKind` 非 `"shared"`
- **THEN** 系统 MUST 将该会话判定为 Shared Session
- **AND** MUST NOT 因投影丢失而退化为 Native 行为

#### Scenario: identity helper is the single source

- **WHEN** 任意消费方（picker 分叉、续接 guard、kind 解析、删除清理）需要判定 Shared 身份
- **THEN** 其 MUST 使用共享 helper 的 id-first 判定
- **AND** MUST NOT 内联第二份 `threadKind === "shared"` 作为唯一身份依据

### Requirement: Thread Kind Resolution MUST Return Shared For Shared Ids

`getThreadKind` / `resolveThreadKind` 对 `shared:` 前缀的 thread id MUST 恒返回 `"shared"`，无论 thread summary 是否存在、`threadKind` 是否丢失；发送路径与删除清理 MUST 共用该解析结果。

#### Scenario: send path stays shared when projection is lost

- **WHEN** 发送路径解析 `shared:` thread 的 kind 且 summary 缺失或 `threadKind` 丢失
- **THEN** 解析结果 MUST 为 `"shared"`
- **AND** 发送 MUST NOT 落到 native runtime 路径

#### Scenario: delete cleanup survives projection loss

- **WHEN** 删除一个 `shared:` thread 且其 summary `threadKind` 已丢失
- **THEN** 系统 MUST 仍执行 Shared Session 绑定清理（`clearSharedSessionBindingsForSharedThread`）

### Requirement: Provider Continuation MUST Reject Shared Thread Ids

Native Provider 续接链路（Composer 请求闸与 prepare 闸）对 source thread id 为 `shared:` 前缀的请求 MUST 静默拒绝，无论 `isSharedSession` prop 或 `threadKind` 投影当时的取值。

#### Scenario: shared id never emits continuation request

- **WHEN** Composer 处理 target 变更且活动 thread id 以 `shared:` 开头、identity prop 已退化为 false
- **THEN** 系统 MUST NOT 调用 `requestProviderContinuationDialog`
- **AND** MUST 走 Shared target 持久化路径（或 locked 时明确 no-op）

#### Scenario: prepare gate rejects shared source id

- **WHEN** `prepareProviderContinuationDialog` 收到 source thread id 以 `shared:` 开头的请求且 summary `threadKind` 非 `"shared"`
- **THEN** 其 MUST 静默 return，不打开续接 dialog

#### Scenario: native continuation unchanged

- **WHEN** source thread id 为 native（如 `claude:` / `codex:` 前缀）且满足既有续接条件
- **THEN** 续接行为 MUST 与变更前一致，不受 id 硬闸影响

### Requirement: Shared Session Flag MUST Have A Single Id-First Computation Source

`isSharedSession`（及其等价 prop）MUST 由单一来源以 `resolveIsSharedSession(activeThreadId, activeThreadSummary)` 计算并沿 prop 链下传；MUST NOT 在 layout 与 app-shell 层各自复制判定表达式。

#### Scenario: layout and shell agree on identity

- **WHEN** 活动 thread 为 `shared:` id 且 summary `threadKind` 丢失
- **THEN** composer、status panel、messages 等下游消费方 MUST 收到一致的 Shared 身份
- **AND** MUST NOT 出现「picker 当 native、history 当 shared」的身份分裂
