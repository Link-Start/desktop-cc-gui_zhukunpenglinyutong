# workspace-file-tree-right-panel-tabs Specification

## Purpose
TBD - created by archiving change retro-workspace-file-tree-and-right-panel-tabs. Update Purpose after archive.
## Requirements
### Requirement: File tree panel MUST keep root actions and row interactions reachable

Workspace file tree panel SHALL 在 layout refactor 后继续暴露 root actions 和 file/folder row interactions。

#### Scenario: 打开文件树

- **WHEN** 打开文件树
- **THEN** 当 workspace file tree 可见时，root-level actions 必须可达，file/folder rows 必须保留 selection、expansion、action behavior。

### Requirement: Right-panel tabs MUST preserve activation when pinned

Right-panel tabs SHALL 支持 pinning，并保持正常 activation 行为。

#### Scenario: pin 右侧 tab

- **WHEN** pin 右侧 tab
- **THEN** 当用户 pin 一个 right-panel tab 时，该 tab 必须继续可用，pinning 不得破坏正常 tab activation。

