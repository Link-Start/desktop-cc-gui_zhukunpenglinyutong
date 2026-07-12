# 全局搜索结果分层显示

## Goal

关联 OpenSpec change `group-global-search-results`，提升全局搜索混合结果的扫描效率，并让文件标题突出文件名。

## Requirements

- 结果按内容类型显示 section heading。
- 文件标题仅显示 basename，完整路径保留在位置 metadata 和打开目标。
- 保持现有 ranking、filters、keyboard navigation 与 selection behavior。

## Acceptance Criteria

- [ ] 混合结果按类型分层，空类型不显示 heading。
- [ ] POSIX 与 Windows 文件路径均正确提取 basename。
- [ ] 跨 section 的 active index 与 Enter action 正确。
- [ ] focused tests、typecheck、lint、large-file 和 OpenSpec validation 通过。

## Technical Notes

采用 presentation-only grouping；不修改 `SearchResult` schema、backend 或 search ranking。
