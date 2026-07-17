# global-search-result-presentation Specification

## Purpose
TBD - created by archiving change group-global-search-results. Update Purpose after archive.
## Requirements
### Requirement: Global search results MUST be layered by content type

系统 SHALL 将非空的全局搜索结果按 `SearchResult.kind` 显示为具名 section，使不同内容类型具有清晰的视觉层次；section 内 MUST 保持 unified search 已产生的相关度顺序。

#### Scenario: Mixed result kinds are displayed
- **WHEN** SearchPalette receives non-empty results containing multiple kinds
- **THEN** 每个 non-empty kind MUST 显示对应 section heading
- **AND** 同一 kind 的结果 MUST 保持输入 ranked results 中的相对顺序

#### Scenario: A content filter leaves one result kind
- **WHEN** content filter causes only one result kind to remain
- **THEN** SearchPalette MUST display that kind section without empty headings for other kinds

#### Scenario: Result sections are visually distinguishable
- **WHEN** SearchPalette renders adjacent non-empty result sections
- **THEN** each section heading MUST use a distinct full-width header surface with stronger typography than result metadata
- **AND** the heading MUST remain visually associated with the results beneath it while scrolling

### Requirement: File result title MUST emphasize the file name

文件 search result MUST 使用 path basename 作为 primary title，并 MUST 保留完整 path 作为 location metadata 与 file open target。

#### Scenario: POSIX file path is displayed
- **WHEN** file provider emits a result for `src/common/config.ts`
- **THEN** result title MUST be `config.ts`
- **AND** `filePath` and `locationLabel` MUST remain `src/common/config.ts`

#### Scenario: Windows file path is displayed
- **WHEN** file provider emits a result containing Windows path separators
- **THEN** result title MUST be the final file-name segment
- **AND** the original path MUST remain unchanged for location and opening

### Requirement: Group headings MUST NOT interrupt result selection

SearchPalette MUST keep section headings outside the selectable result index so keyboard navigation and Enter activation remain continuous across section boundaries.

#### Scenario: Selected result crosses a section boundary
- **WHEN** selectedIndex identifies the first result in a later section
- **THEN** that result MUST receive active presentation
- **AND** pressing Enter MUST open the same underlying `SearchResult`

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
