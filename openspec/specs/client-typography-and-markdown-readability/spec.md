# client-typography-and-markdown-readability Specification

## Purpose
TBD - created by archiving change retro-typography-font-and-markdown-readability. Update Purpose after archive.
## Requirements
### Requirement: Client typography MUST keep UI chrome and reading surfaces distinct

系统 SHALL 区分 app chrome typography 和 long-form Markdown/document reading typography，不得用单一局部样式覆盖两类目标。

#### Scenario: UI chrome 渲染

- **WHEN** UI chrome 渲染
- **THEN** 当 sidebar、settings、toolbar、composer 控件渲染 label 时，应使用 app chrome 字体变量并保持控件密度。

#### Scenario: Markdown 长文渲染

- **WHEN** Markdown 长文渲染
- **THEN** 当 message Markdown、file preview Markdown 或文档内容渲染 prose 时，应使用 reading-surface typography，并保持段落、代码块、列表可读。

### Requirement: Packaged fonts MUST be local assets

客户端使用的字体资产 SHALL 本地打包，不能依赖网络字体加载。

#### Scenario: 离线启动

- **WHEN** 离线启动
- **THEN** 当桌面应用离线启动时，配置字体必须从 local asset 或 system fallback 加载，不能因为网络不可用导致字体缺失。

