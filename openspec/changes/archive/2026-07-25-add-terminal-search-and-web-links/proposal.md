## Why

Terminal 当前只加载 FitAddon。长日志无法在 terminal 内搜索，URL 也没有统一、安全的点击打开行为；现有“发送选区到 Composer”只能缓解复制上下文，不能替代定位能力。

## What Changes

- 加载与 xterm 5.5 兼容的 SearchAddon、WebLinksAddon。
- TerminalPanel 提供 Cmd/Ctrl+F 搜索栏、next/previous、关闭与结果反馈。
- WebLinksAddon 只把 `http:`/`https:` URL 交给 Tauri opener。
- 保留 selection-to-Composer 行为。

## Capabilities

### New Capabilities

- `terminal-search-and-web-links`：Terminal 支持本地 buffer 搜索与安全 web link 打开。

### Modified Capabilities

- 无。

## Impact

- Frontend：useTerminalSession、TerminalPanel、controller。
- Dependencies：`@xterm/addon-search`、`@xterm/addon-web-links`。
- 无 backend schema 变化。
