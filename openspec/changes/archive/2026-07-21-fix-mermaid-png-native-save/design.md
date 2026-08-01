## Context

Mermaid fullscreen 已能生成 bounded PNG Blob，但 persistence 层仍是 browser anchor。Tauri WebView 不保证 `blob:` + `download` 触发 native download，因此实现与 Desktop behavior contract 断裂。项目已安装 `@tauri-apps/plugin-dialog`，backend command registry 也承担 local file persistence。

## Goals / Non-Goals

**Goals:**

- Tauri runtime 使用 native Save Dialog 和 PNG-only IPC 完成落盘。
- Web runtime 继续使用 browser fallback。
- cancellation、conversion error、IPC rejection 均保持 viewer recoverable。
- IPC boundary 校验 PNG signature 与 128 MiB encoded payload ceiling。

**Non-Goals:**

- 不提供通用 binary writer。
- 不改变 Canvas size/scale budget。
- 不增加 filesystem plugin 权限。

## Decisions

### Decision: runtime-aware persistence 位于 exporter

`downloadMermaidPng()` 继续拥有 decode → rasterize → encode → persist 完整流程。它使用 `isTauri()` 选择 persistence adapter：Tauri 调用 native dialog，再通过 `saveMermaidPngFile()` service wrapper 进入 IPC；Web 调用 anchor fallback。这样 component 只处理 pending/error，不感知 runtime，feature 也不直接调用 `invoke()`。

Alternative：把 dialog 放进 React component。该方案会把 persistence detail 泄漏进 UI orchestration，并拆散 exporter tests，拒绝。

### Decision: 使用 PNG-only Tauri command

新增 `save_mermaid_png(path, png_bytes)`；backend 校验 8-byte PNG signature、非空 payload 与 128 MiB ceiling，再写入用户经 native dialog 选择的路径。

Alternative：安装 `tauri-plugin-fs`。这会增加 dependency 与 broad filesystem capability，而需求只有单一 export verb，拒绝。

### Decision: cancellation 不是 failure

Save Dialog 返回 `null` 时 exporter 正常 resolve；button 从 pending 回到 idle，不显示错误。只有 rasterization、IPC validation 或 filesystem write failure 才进入现有 error feedback。

### Contract

- Frontend service: `saveMermaidPngFile(path, pngBytes)` 映射到 `invoke("save_mermaid_png", { path, pngBytes })`。
- Backend: `save_mermaid_png(path: String, png_bytes: Vec<u8>) -> Result<(), String>`。
- Validation: PNG signature `89 50 4E 47 0D 0A 1A 0A`; `0 < len <= 128 MiB`。

## Risks / Trade-offs

- [大 PNG 经 JSON/IPC 复制产生额外内存] → Canvas 总像素已有 32M ceiling；encoded payload 再设 128 MiB hard limit。
- [用户选择不可写路径] → backend 显式返回 filesystem error，viewer 保持打开并允许重试。
- [Web runtime regression] → 保留既有 anchor cleanup tests。
- [dialog 确认后文件被覆盖] → overwrite 是 native Save Dialog 的显式用户选择；command 不绕过系统确认。

## Migration Plan

1. 注册 backend command 与测试。
2. exporter 接入 native dialog/IPC，并保留 Web fallback。
3. focused frontend/Rust gates 与 Tauri manual save。
4. 回滚时移除 command registration，并恢复 exporter 仅使用 anchor。

## Open Questions

无。现有 filename、PNG budget 与错误文案继续复用。
