## Why

当前 Mermaid 全屏视图只能查看和缩放，用户无法把已经渲染完成的图表直接保存为图片。对超长 sequence diagram 等场景，截图会损失清晰度且操作成本高，因此需要在共享全屏 viewer 中提供稳定的 PNG 下载能力。

## 目标与边界

- 在消息侧与文件预览侧共用的 `MermaidFullscreenViewer` 右下角提供下载入口。
- 将当前已渲染且 XML-safe 的 SVG 转换为 2x PNG，并限制最大像素规模，避免超大 Canvas 导致 WebView 内存压力。
- 使用透明背景和稳定文件名 `mermaid-diagram.png`；失败时向用户提供可理解的反馈。
- 保持现有 fullscreen、theme、singleton、panel-lock 与 cleanup contract 不变。

## What Changes

- 为 Mermaid fullscreen viewer 增加带 i18n 与 accessible name 的“下载 PNG”按钮。
- 新增 feature-local SVG-to-PNG 下载 helper，复用现有 SVG normalization 结果，不新增依赖。
- 覆盖 Unicode、`foreignObject`、超大图缩放、失败处理和 Object URL cleanup。
- 扩展现有 Mermaid fullscreen behavior spec 与 focused tests。

## 技术方案对比

- **采用：Browser Canvas rasterization**。复用 viewer 已持有的 XML-safe SVG Data URL，经 `Image` 解码后绘制到 Canvas 并 `toBlob("image/png")`。无需新增依赖，消息与文件 surface 可共享。
- **不采用：仅下载原始 SVG**。仓库已有 `downloadSvg()`，但它不满足用户要求的 PNG 图片交付，也不方便直接用于常见文档和聊天工具。
- **不采用：引入第三方 SVG export library**。功能范围小，原生 Web API 已足够；新增依赖会扩大 bundle、维护和安全审计成本。

## 验收标准

- 消息侧和文件预览侧打开 Mermaid fullscreen 后，右下角均出现“下载 PNG”按钮。
- 点击后下载 `mermaid-diagram.png`，输出分辨率默认为图表逻辑尺寸的 2x。
- 中文、日文、Emoji 与包含 XHTML `<foreignObject>` 的 Mermaid SVG 能完成导出。
- 超大图按最大像素预算等比降采样，不创建无界 Canvas。
- 转换或下载失败不会关闭 viewer，并显示本地化错误反馈。
- 下载结束或失败后释放临时 Object URL；现有 fullscreen viewer tests 不回归。

## 非目标

- 不增加 SVG/PDF/JPEG 格式选择器。
- 不增加自定义倍率、背景色、文件名或系统保存路径设置。
- 不改 Mermaid source、render theme 或 viewerjs 内置 8 个 toolbar action。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `markdown-mermaid-block-fullscreen-viewer`: 增加共享 fullscreen viewer 的 PNG 下载入口、rasterization 边界、错误反馈与资源清理 contract。

## Impact

- Frontend：`src/features/markdown/mermaidFullscreen/`、对应 CSS、i18n locale 与 focused tests。
- Behavior spec：`openspec/specs/markdown-mermaid-block-fullscreen-viewer/spec.md` 的 delta。
- API / backend / dependency：无变化。
