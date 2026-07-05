# search-release-notes-diff-polish Specification

## Purpose
TBD - created by archiving change retro-search-release-notes-and-diff-polish. Update Purpose after archive.
## Requirements
### Requirement: Search palette chrome MUST prioritize scannable results

Search palette SHALL 避免与 result labels、scopes、actions 竞争注意力的 decorative chrome。

#### Scenario: 展示搜索结果

- **WHEN** 展示搜索结果
- **THEN** 当 SearchPalette 展示结果时，result labels 和 actions 必须是视觉重点；装饰性 project icon 可以移除。

### Requirement: Release notes navigation MUST remain compact and readable

Release notes modal header 和 navigation controls SHALL 在支持 viewport 中保持紧凑可读。

#### Scenario: 浏览 release notes

- **WHEN** 浏览 release notes
- **THEN** 当 release notes modal 打开时，navigation buttons 必须可见可理解，header chrome 不得挤压正文。

### Requirement: Diff panel emphasis MUST use theme tokens

Diff panel emphasis styling SHALL 使用 theme-compatible tokens，并避免不必要 nested shadow noise。

#### Scenario: 渲染 diff panel

- **WHEN** 渲染 diff panel
- **THEN** 当 diff panel 在 dark/light theme 渲染时，强调色必须符合当前 theme tokens，inner shadow 不得降低 diff readability。

