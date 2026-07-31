# Design（以代码为准）

## 1. 能力定位

### 1.1 矩阵与 Features

- 全部引擎：`EngineFeatures::<engine>().image_input = true`
- fixture / generated matrix：`image.input = supported`
- 门禁：`require_image_support(EngineType, images)` 读 features；当前全 supported 时恒 Ok
  （保留给未来 unsupported engine）

### 1.2 Transport 形态（差异在协议，不在能不能贴）

| Engine | 有图命令形态 | 备注 |
|---|---|---|
| Grok | `--prompt-file` ACP blocks | prompt 原文保真；单图 ≤2MiB；JSON 写 staging 文件，不占 argv |
| OpenCode | `run -f path` | data URL 先 staging |
| Kimi | `-p` + path injection | agent ReadMediaFile；非首包 inline |
| Claude/Codex/Gemini | 既有 | 本 change 不改 wire |

### 1.3 共享解析

`cli_image_input.rs`：

- `collect_non_empty_image_paths` / `resolve_existing_image_files`
- data URL → `{workspace}/.mossx/image-staging/attach-<uuid>.<ext>`
- Kimi：`build_kimi_prompt_with_images` + `split_kimi_prompt_for_display`
- marker：`<!-- mossx:kimi-image-attachments -->`

Grok ACP blocks 组装仍在 `grok.rs`（base64 → staging `--prompt-file`）；历史拆包在 `grok_history.rs`。

## 2. 数据流

```text
Composer images[]
  -> sanitizeImageAttachmentPaths
  -> engineSupportsImageInput (matrix；当前全 true)
  -> engine_send_message(images)
       Grok     : build_grok_prompt_json / -p
       OpenCode : --file ...
       Kimi     : build_kimi_prompt_with_images
  -> UI: visibleUserText + images[]
  -> History:
       Grok: <image_files> + <user_query> -> text + images[]
       Kimi: strip marker -> text + images[]
  -> MessageImageGrid: convertFileSrc + LocalImage(localPath, workspaceId)
```

### 2.1 展示契约

- 用户气泡禁止显示 CLI 私有注入 / 引擎包装
- Grok 历史：`parse_grok_user_prompt_for_display`
- Kimi 历史：`split_kimi_prompt_for_display`
- frontend presentation 不对任意用户文本做 marker/tag heuristic strip，避免误删用户原文
- 缩略图：`resolveMessageImageLocalPath` + `LocalImage` 回退
  - 预览白名单含 workspace 与 `~/.grok/sessions` / `$GROK_HOME/sessions`

### 2.2 Codex sync

```text
engine_send_message_sync(codex)
  -> run_codex_prompt_sync(..., images)
  -> params_to_codex_input
  -> turn/start.input
```

## 3. 风险与边界

| 风险 | 缓解 |
|---|---|
| Grok ARG_MAX | multimodal 走 `--prompt-file`，argv 只传路径 |
| Kimi 依赖 ReadMediaFile | 文档标明 agent 读图语义 |
| 中文路径 asset 失败 | LocalImage + data URL 回退 |
| staging 污染 | 路径在 `.mossx/image-staging/`；建议 gitignore |
| 远程 preview | `read_local_image_data_url` remote 不支持 |

## 4. 测试

- Rust：`build_grok_prompt_json*`、`cli_image_input*`、`require_image_support` 全引擎 Ok、
  Grok/Kimi history strip + images 还原
- FE：engineImageInput 全 supported、useThreadMessaging 不误拦、
  用户原文 marker 保真、messageRow localPath
- Rust 全目标：daemon bridge 注册 `cli_image_input`，共享 Kimi/OpenCode 源码可编译

## 5. 关键路径

见 report §三「关键文件」；OpenSpec delta：`specs/engine-image-input-boundary/spec.md`。
