# react-scan-frame-diagnostics Specification

## Purpose
TBD - created by archiving change retro-react-scan-and-frame-diagnostics. Update Purpose after archive.
## Requirements
### Requirement: Rendering diagnostics MUST be runtime-gated

React scan overlay、frame-drop attribution 和 web-vitals collection SHALL 由 runtime settings 控制，默认关闭。

#### Scenario: diagnostics disabled

- **WHEN** diagnostics disabled
- **THEN** 当性能诊断关闭时，react-scan overlay 和 frame-drop attribution 不得运行 active collection loops，普通渲染不应支付诊断开销。

### Requirement: Frame diagnostics MUST avoid sensitive content

Frame-drop diagnostics SHALL 捕获 render/timing attribution，不得存储 raw prompt、message body、stdout、stderr 或 secrets。

#### Scenario: 记录掉帧

- **WHEN** 记录掉帧
- **THEN** 当 conversation 期间创建 frame-drop diagnostic entry 时，可以包含 component names、timing、visible-row counts、interaction context，但不能包含原始对话内容。

