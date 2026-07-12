## Why

Browser Dock 当前实现已经演进为 detached window + single native renderer window，但主线规格仍描述为右侧 companion split，后续实现会在错误事实源上继续漂移。用户还反馈默认浏览器窗口过小导致网页变形，并需要一个网页元素选择器，把选中的页面区域自动注入当前对话用于提问。

## 目标与边界

- 对齐 Browser Dock 规格与当前 detached runtime 事实，避免继续按旧 split 面板设计实现。
- 调整 Browser Agent renderer 默认窗口尺寸，使常见网页首屏不被挤压变形。
- 增加 read-only 网页元素选择器：用户显式进入选择模式、连续点击一个或多个可见元素后，将安全、结构化的元素证据追加注入当前 Composer。
- 复用现有 BrowserContextAttachment / annotation evidence 语义，不绕过隐私 redaction、stale state 和 conversation lifecycle。

## 非目标

- 不实现 AI 自动点击、输入、提交表单或多步 browser automation。
- 不发送截图二进制、DOM 原文、cookies、headers、storage、脚本或样式内容。
- 不恢复右侧 companion split；本变更承认 detached Browser Dock window 是当前产品形态。
- 不新增外部依赖。

## What Changes

- Browser Dock 默认打开为更大的 detached renderer window，保持最小尺寸约束，避免 example.com 这类页面被压扁。
- Browser Dock toolbar 新增“选择网页元素加入聊天”入口，进入连续点选模式。
- 选择模式在页面内 hover 高亮可见元素，点击后采集 bounded element facts，并保持模式继续可选下一个元素。
- 选择结果通过主窗口事件请求当前 Composer attach browser context，并追加携带 user annotation evidence。
- Composer 使用既有 BrowserContextPreview 显示选中页面上下文；用户可直接围绕一个或多个元素提问。
- OpenSpec 主能力 delta 补齐 detached window runtime、default sizing、selector-to-composer injection 约束。

## 技术方案对比

| 方案 | 描述 | 取舍 |
|---|---|---|
| A. 直接把选中文本拼到输入框 | 实现最快，把元素 text 插入 Composer draft | 丢失 URL/title/bounds/privacy/stale contract，后续 evidence 不可审计；不采用 |
| B. 复用 BrowserContextAttachment annotation evidence | 选择元素后触发 snapshot capture，并将元素选择作为 annotation 注入 attachment | 与现有 AI payload、预览、redaction、TaskRun evidence 语义一致；采用 |
| C. 做完整 DOM inspector / 多选批注系统 | 支持复杂 inspector、多个元素、编辑批注 | 超出当前需求，会膨胀 Browser Agent scope；暂不采用 |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `vibecoding-browser-agent`: Browser Dock primary runtime shape changes from right-side companion split wording to detached Browser Dock window + single renderer window, with default window sizing requirements.
- `browser-agent-page-understanding`: Browser Agent Page Understanding adds an explicit page element selector that produces structured annotation evidence and injects it into the active Composer.

## Impact

- Frontend: `src/features/browser-agent/**`, Composer browser context attachment command path, i18n, Browser Agent styles.
- Backend: `src-tauri/src/browser_agent/**` toolbar injection, renderer window default size, capture/annotation event bridge.
- Specs: Browser Dock runtime shape and page selector behavior.
- Tests: Browser Agent pure utilities / component tests, Rust toolbar tests, focused typecheck and OpenSpec validation.

## 验收标准

- Browser Dock renderer opens at a larger default size and no longer visually compresses example.com into a narrow/short viewport.
- Browser toolbar exposes a selector button with accessible label and localized copy.
- Selecting a visible page element injects a browser context attachment into the active Composer without manually typing into the input.
- The injected context includes page URL/title, selected element text/role/bounds evidence, privacy metadata, and remains removable/refreshable from Composer.
- Repeated selector clicks append multiple selected element evidence items to the same Composer attachment instead of overwriting earlier selections.
- `openspec validate add-browser-page-selector-and-window-sizing --strict --no-interactive` passes.
