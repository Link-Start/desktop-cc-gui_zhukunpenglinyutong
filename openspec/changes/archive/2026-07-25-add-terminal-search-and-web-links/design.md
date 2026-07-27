## Context

xterm addon 必须在 Terminal instance 初始化时加载；搜索 UI 属于 Panel，URL opener 属于 trust boundary。

## Decisions

1. session hook 创建 addon，并向 panel 暴露 `findNext`/`findPrevious`，不暴露 addon instance。
2. Cmd/Ctrl+F 仅在 TerminalPanel 内拦截，Escape 关闭搜索栏。
3. WebLinks handler 解析 URL 后只允许 `http:`/`https:`，调用 `openUrl` 失败时记录 toast。
4. addon 版本与现有 xterm 5.5 对齐，不升级 xterm major。

## Risks / Trade-offs

- addon dynamic import 失败不得阻断 terminal startup。
- 搜索 query 为空时不执行。
- link scheme 必须 fail closed。

## Migration Plan

1. 增加依赖与 session contract。
2. 增加 UI 与 shortcut。
3. 运行 Terminal focused tests、typecheck、lint。
