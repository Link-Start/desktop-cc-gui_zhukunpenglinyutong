## ADDED Requirements

### Requirement: File Editor MUST Expose Navigation Resolution Mode

File editor SHALL 对最近一次 navigation query 显示 localized resolution mode，并 MUST 区分 semantic certainty 与 fast-search fallback。

#### Scenario: Semantic result is returned
- **WHEN** definition、references 或 implementation query 使用 semantic provider 完成
- **THEN** UI MUST 显示“语义导航”及对应 language/provider identity
- **AND** single-target result MUST 继续直接跳转，不增加确认弹窗

#### Scenario: Fast-search fallback is returned
- **WHEN** semantic infrastructure 不可用且 bounded heuristic fallback 完成
- **THEN** UI MUST 显示“快速搜索（降级）”warning feedback
- **AND** MUST 说明结果可能包含同名项而不是显示 generic failure

#### Scenario: Cached result is reused
- **WHEN** navigation result 从 frontend cache 命中
- **THEN** UI MUST 保留原始 mode/provider/fallback metadata
- **AND** MUST NOT 把 cached fallback 误标为 semantic result

### Requirement: Navigation Retrieval Feedback MUST Be Action-Specific And Retryable

File editor SHALL 对 query preparation、empty、timeout、provider failure 与 retry 提供 compact、localized、action-specific feedback。

#### Scenario: Provider is preparing
- **WHEN** 用户首次触发可能冷启动的 Java 或 TypeScript semantic query
- **THEN** UI MUST 显示当前 action 与 language-specific loading copy
- **AND** editor content、selection 与 typing MUST 保持可操作

#### Scenario: Query fails or times out
- **WHEN** navigation query 在 fallback 前后仍失败或 frontend timeout
- **THEN** UI MUST 显示 localized reason category 与 retry action
- **AND** retry MUST 重用当前 cursor/action contract，禁止修改文件内容

#### Scenario: Candidate or reference results are shown
- **WHEN** query 返回 multiple candidates 或 reference list
- **THEN** panel header MUST 显示 action、result count 与 resolution mode
- **AND** existing keyboard/click navigation behavior MUST remain available
