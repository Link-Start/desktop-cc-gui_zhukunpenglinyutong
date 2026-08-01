## Why

当前 Mermaid PNG exporter 仅通过 browser `<a download>` 触发 `blob:` 下载；该路径在 Tauri WebView 中不会可靠打开系统保存流程，导致 control 可见但无法真正保存文件。需要把 Desktop runtime 接入原生 Save Dialog 与受限 IPC 写入，同时保留 Web runtime fallback。

## 目标与边界

- Tauri 中点击“下载 PNG”后打开 native Save Dialog，并将 Canvas 编码结果写入用户选择的位置。
- backend 只接受有效 PNG payload，并设置明确大小上限。
- 用户取消保存不视为错误；转换或写入失败继续使用现有 recoverable feedback。
- 非 Tauri runtime 保留 browser anchor download fallback。

## 非目标

- 不新增 SVG/JPEG/WebP 导出。
- 不改变 2x、16384px、32M pixels Canvas budget。
- 不改变 viewerjs toolbar、缩放或 fullscreen lifecycle。
- 不引入通用任意路径 binary write API。

## What Changes

- 在 Tauri runtime 使用 `@tauri-apps/plugin-dialog.save` 获取目标路径。
- 新增 narrow Tauri command `save_mermaid_png(path, pngBytes)`，验证 PNG signature 与 payload budget 后写入文件。
- 调整 frontend exporter：native save 优先，browser `<a download>` 仅作为非 Tauri fallback。
- 补充 native success、cancel、invalid payload、write failure 与 browser fallback 测试。

## Capabilities

### New Capabilities

<!-- 无 -->

### Modified Capabilities

- `markdown-mermaid-block-fullscreen-viewer`: Mermaid PNG download 在 Tauri runtime 必须通过 native Save Dialog 完成真实文件保存，并保留 Web fallback 与可恢复失败语义。

## 方案对比

1. **Native Save Dialog + narrow Tauri command（采用）**：复用已安装的 dialog plugin，仅增加 PNG 专用写入 command；权限边界最小，行为可测试。
2. **引入 `@tauri-apps/plugin-fs`**：需要新增 frontend/Rust dependency 与 broad filesystem capability，扩大权限面，当前单一导出需求不值得。
3. **继续 `<a download>`**：代码最少，但 Tauri WebView 已证明不满足产品行为，淘汰。

## 验收标准

- Tauri 点击下载后出现系统 Save Dialog，确认后生成可打开的 `image/png` 文件。
- 取消 Save Dialog 后 viewer 保持打开且 control 恢复可用，不显示错误。
- invalid/oversized PNG payload 被 backend 拒绝，不落盘。
- Web runtime 继续执行 anchor fallback，并清理 Object URL。
- focused frontend/Rust tests、lint、typecheck、runtime contract 与 strict OpenSpec validation 通过。

## Impact

- Frontend: `src/features/markdown/mermaidFullscreen/downloadMermaidPng.ts`、`src/services/tauri/mermaidExport.ts` 及测试。
- Backend: 新增 Mermaid PNG export command，并注册到 `src-tauri/src/command_registry.rs`。
- API: 新增 IPC `save_mermaid_png(path: String, png_bytes: Vec<u8>)`。
- Dependencies: 无新增 dependency；复用 `@tauri-apps/plugin-dialog` 与 Rust standard library。
