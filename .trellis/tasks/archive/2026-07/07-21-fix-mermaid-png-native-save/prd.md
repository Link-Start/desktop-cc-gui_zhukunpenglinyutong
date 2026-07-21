# Fix Mermaid PNG native save

## Goal

实现 OpenSpec change `fix-mermaid-png-native-save`：让 Tauri 中的 Mermaid PNG control 打开 native Save Dialog 并真实写入图片。

## Requirements

- 复用 `@tauri-apps/plugin-dialog.save`。
- 新增 PNG-only Tauri IPC，验证 signature 与 128 MiB encoded payload ceiling。
- cancellation 不报错，failure 保持 viewer recoverable。
- 非 Tauri runtime 保留 anchor fallback。
- 不新增 dependency，不提供通用 binary writer。

## Acceptance Criteria

- [x] Native Save Dialog 可打开并保存有效 PNG。
- [x] invalid/oversized payload 不落盘。
- [x] cancel/error/success 与 browser fallback tests 通过。
- [x] frontend/backend quality gates 与 strict OpenSpec validation 通过。
- [x] main spec 已同步，change 已归档。

## Technical Notes

- OpenSpec source: `openspec/changes/fix-mermaid-png-native-save/`。
- IPC: `save_mermaid_png(path: String, png_bytes: Vec<u8>) -> Result<(), String>`。
