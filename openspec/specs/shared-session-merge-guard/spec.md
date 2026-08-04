# shared-session-merge-guard Specification

## Purpose

TBD - created by archiving change for `shared-session-merge-guard`.

## Requirements

### Requirement: Shared Thread Entries MUST Survive Merge

线程列表 merge 操作中，`shared:` 前缀 id 的条目 MUST NOT 因任何 merge 来源数据缺失而丢失。其 `threadKind` 字段 MUST NOT 被覆盖为非 `"shared"` 值。

#### Scenario: shared entry with kind lost during merge is preserved

- **WHEN** 线程列表 merge 时 incoming 来源包含一个 `shared:` id 条目且其 `threadKind` 为 `undefined` 或 `"native"`
- **AND** existing 中已存在同一 `shared:` id 的条目
- **THEN** merge 结果中该条目 MUST 保留
- **AND** 其 `threadKind` MUST 保持或被显式矫正为 `"shared"`

#### Scenario: shared thread kind is always corrected for shared-prefixed ids

- **WHEN** merge 结果中任何条目的 id 以 `shared:` 开头
- **THEN** 该条目的 `threadKind` MUST 为 `"shared"`

### Requirement: Shared List Failure Or Partial Result MUST Preserve Existing Shared Entries

当 `listSharedSessions` 调用失败、返回空列表、或返回**不完整**列表时，线程列表 MUST 保留 previous frame（`existingThreads`）中已有的 `shared:` id 条目。

#### Scenario: preserve source is previous frame not rebuilt native scan

- **WHEN** 系统准备 merge shared sessions
- **THEN** 用于「补回」的 existing shared 集合 MUST 取自 **上一帧 `existingThreads`**（或等价 previous workspace summaries）
- **AND** MUST NOT 仅从本轮 native 扫描重建的 `allSummaries` 中提取（该集合在 merge 前通常不含 `shared:`）

#### Scenario: shared list empty preserves existing shared threads

- **WHEN** `listSharedSessions` 返回空数组（含 catch 归一为空）
- **AND** previous frame 中存在一个或多个 `shared:` id 条目
- **THEN** merge 后 MUST 仍保留所有 previous `shared:` 条目

#### Scenario: non-empty shared list is authoritative for membership

- **WHEN** `listSharedSessions` 返回非空数组
- **THEN** merge 结果中的 `shared:` 成员集合 MUST 以该返回为准
- **AND** MUST NOT 把 previous frame 中已不在返回列表内的 `shared:` 条目强制复活（避免已删除会话回魂）

#### Scenario: native-sourced entry does not overwrite shared entry identity

- **WHEN** native 扫描结果中某条目 id 不以 `shared:` 开头
- **THEN** 该条目按正常 merge 规则处理
- **AND** 不得将任意 `shared:` 条目的 `threadKind` 改为 `"native"`
