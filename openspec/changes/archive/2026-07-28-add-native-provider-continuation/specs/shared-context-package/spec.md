## ADDED Requirements

### Requirement: Context Package MUST Identify Native History Sources

`ContextPackage` 来源为 Native Session 时 MUST 记录 `kind=native-history`、reader identity、
source session/native identity、provider profile、source fingerprint 与 cursor range；source
checksum MUST 覆盖这些字段和 normalized entries。

#### Scenario: identical frozen native source compiles identically

- **WHEN** 同一 Reader、source fingerprint、cursor range、normalized entries、destination 与
  capabilities 被编译两次
- **THEN** 两个 Context Package MUST 具有相同 package id 与 source checksum

#### Scenario: source fingerprint changes package identity

- **WHEN** normalized text 相同但 authoritative source fingerprint 或 cursor range 不同
- **THEN** Context Package identity MUST 不同
- **AND** retry MUST NOT 把它们视为同一 materialization
