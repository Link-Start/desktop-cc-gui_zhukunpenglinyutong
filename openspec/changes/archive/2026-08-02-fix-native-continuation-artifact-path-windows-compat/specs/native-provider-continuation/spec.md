## ADDED Requirements

### Requirement: Continuation Artifact Storage Paths MUST Use Platform-Safe Keys

Native Provider Continuation 的 artifact 存储 MUST 使用 platform-safe 的确定性路径
key，不得将 logical `sessionId`（含 `engine:` 前缀的组合串）直接作为 filesystem
path segment。record JSON 内 MUST 继续保存 caller 提供的原始 `sessionId`。读取
MUST 兼容 legacy `{sessionId}` 目录布局，确保升级前已落盘的 artifact 仍可被
`read_artifact` / `read_typed_artifact` 读取，且 `scan_orphan_artifacts` 不因路径
布局变化误删被引用 artifact。

#### Scenario: Windows prepares a continuation from a prefixed native session

- **WHEN** source `sessionId` 为 `claude:<nativeSessionId>` 或 `kimi:<nativeSessionId>`
- **THEN** artifact 写入 MUST 使用 platform-safe key 构造目录（不包含 `:` 等
  Windows 保留字符），不得产生 `os error 267` / `ERROR_DIRECTORY`
- **AND** record JSON 内的 `sessionId` MUST 保持原始 `claude:<nativeSessionId>` 值

#### Scenario: legacy artifact layout remains readable after upgrade

- **WHEN** 磁盘上已存在
  `shared-context-artifacts/{workspace_hash}/{sessionId}/<artifact>.json` 旧布局
- **THEN** `read_artifact` / `read_typed_artifact` MUST 在新 key 路径未命中时
  fallback 读取 legacy 路径
- **AND** 被引用 artifact MUST NOT 被 `scan_orphan_artifacts` 清退

#### Scenario: unsafe segment values are rejected at the store boundary

- **WHEN** 任一 bare path segment（如 `artifact_id`）包含 Windows 保留字符
  `\ / < > : " | ? *`、控制字符、尾随点/空格或保留设备名（`CON` 等）
- **THEN** artifact store MUST fail closed，返回 invalid segment 错误，禁止将其
  写入路径
