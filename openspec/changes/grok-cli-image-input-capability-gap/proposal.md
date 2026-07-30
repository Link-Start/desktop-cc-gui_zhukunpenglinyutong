# Why

mossx 对 Grok / Kimi / OpenCode 早期只走了纯文本 CLI prompt，忽略 `images`，并把
`image.input` 误标为 `unsupported`。用户看到「不支持图片」或幕布出现引擎私有注入
文案，本质是 **transport + 历史展示契约** 缺失，不是附件字段丢失。

本 change 以代码为准完成：

1. 各 CLI 可交付的图片发送 transport；
2. 能力矩阵与 `EngineFeatures.image_input` 对齐为 `supported`；
3. 历史/幕布剥离引擎包装，图片走 `images[]` + LocalImage 加载；
4. Claude / Codex 既有发图路径不被破坏；Codex sync 与 async 透传对齐。

# 目标与边界

## 目标

- **Grok**：有图 `--prompt-json` ACP image blocks；无图保留 `-p`
- **OpenCode**：`opencode run -f <path>`
- **Kimi**：headless `-p` 注入 path + ReadMediaFile 指令；marker 可 strip
- **矩阵**：六个 engine 的 `image.input = supported`（transport 语义见 design）
- **展示**：用户气泡 / 历史只显示用户原文 + 缩略图
- **Codex sync**：`params_to_codex_input` 透传 images
- **不破坏** Claude / Codex native image transport

## 非目标

- 不把 Kimi 升级为 ACP 首包 inline vision（可后续独立 change）
- 不重写 Claude/Codex 图片 wire 协议
- 不把 fail-fast 当产品目标（仅对未来真正 unsupported 的 engine 保留门禁）

# 对比结论（以代码为准）

| Engine | image.input | Transport |
|---|---|---|
| Claude | supported | 既有 stream-json content 多模态 |
| Codex | supported | `turn/start.input` image item；sync 用 `params_to_codex_input` |
| Gemini | supported | 既有 |
| Grok | supported | `--prompt-json` ACP `{type:image,mimeType,data}` |
| Kimi | supported | `-p` + path tags + ReadMediaFile（agent 读图） |
| OpenCode | supported | `run -f <abs-path>` |

# 方案（最终落地）

**真 transport + 展示契约**，不是 client-only fail-fast。

1. Backend 按 engine 实现图片载荷
2. Features / matrix 标 supported
3. History loader strip 引擎私有包装并还原 `images[]`，UI 只消费清洗后的数据
4. LocalImage + `localPath` + `~/.grok/sessions` 预览白名单保证缩略图可加载

# 验收标准（已验收）

- [x] Grok 有图可发；幕布显示原文 + 图，不显示 `<image_files>` 原文
- [x] Kimi 有图可发；幕布显示原文 + 图，不显示 ReadMediaFile 注入字
- [x] OpenCode 有图可发
- [x] Claude / Codex 贴图回归正常
- [x] 空白/纯空白 images 不误伤纯文本发送
- [x] Codex sync 透传 images

# Impact

- Backend：`grok.rs` / `kimi.rs` / `opencode.rs` / `cli_image_input.rs` / `*_history.rs` / `commands.rs` / `codex_prompt_service.rs` / features + matrix
- Frontend：`engineImageInput` / `useThreadMessaging` / Composer attach gate / MessageImage localPath
- Docs：本 change + `docs/reports/grok-cli-capability-gap-vs-claude-codex-2026-07-30.md`
