## ADDED Requirements

### Requirement: Global search SHALL present API endpoint results as a dedicated section
系统 SHALL 将 `SearchResult.kind = api` 的结果显示在独立 API section，并提供 API content filter；section 内 MUST 保持 unified ranking 产生的顺序。

#### Scenario: Render API metadata
- **WHEN** unified search 返回 API endpoint results
- **THEN** 每个结果 MUST 显示 protocol 或 HTTP method、path/operation、handler/source metadata 与 workspace scope

#### Scenario: Keyboard selection
- **WHEN** API result 是当前 selected result 且用户按 Enter
- **THEN** 系统 MUST 打开同一个 underlying endpoint result

#### Scenario: API hydration coexists with file hydration
- **WHEN** file index 与 API endpoint index 具有不同 hydration 状态
- **THEN** palette MUST 分别呈现对应状态
- **AND** 任一 provider 的 loading/error MUST NOT 覆盖另一 provider 的可用结果
