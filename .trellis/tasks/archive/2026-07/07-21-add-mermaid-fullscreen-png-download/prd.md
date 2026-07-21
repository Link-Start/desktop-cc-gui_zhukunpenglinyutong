# Mermaid 全屏 PNG 下载

## Goal

闭环实现 OpenSpec change `add-mermaid-fullscreen-png-download`，在共享 Mermaid fullscreen viewer 中提供有界、可恢复的 PNG 下载能力。

## Requirements

- 共享入口同时覆盖消息与文件预览 surface。
- 默认 2x、透明背景、`mermaid-diagram.png`。
- 受 16384px 最大边长和 32M pixels 限制。
- 下载中禁止重复触发，失败不关闭 viewer 并显示 i18n 反馈。
- 不新增依赖，不修改 viewerjs 固定 8-action toolbar。

## Acceptance Criteria

- [x] OpenSpec tasks 全部完成。
- [x] focused tests、typecheck、lint 通过。
- [x] OpenSpec target spec strict validation 通过。

## Technical Notes

- Behavior source of truth: `openspec/changes/archive/2026-07-21-add-mermaid-fullscreen-png-download/` 与同步后的主 spec。
- Implementation uses native `Image`、Canvas、Blob 与 Object URL APIs。
- 全量 `npm run test` 在 146/215 被既存 `SettingsView.test.tsx` 用例 `persists client UI visibility panel and control toggles` 中止；独立运行同样失败，本变更未修改 Settings 文件。
