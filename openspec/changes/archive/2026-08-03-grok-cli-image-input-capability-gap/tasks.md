## 1. Grok real image transport (P0)

- [x] 1.1 `grok.rs`：有图 `--prompt-file` ACP image blocks（staging JSON）；无图保留 `-p`
- [x] 1.2 prompt 原文保真 / workspace-relative path / data URL / mime / soft-cap（2MiB 图；payload 经 `--prompt-file`）/ 显式加载失败
- [x] 1.3 `EngineFeatures::grok().image_input = true` + matrix regenerate
- [x] 1.4 `grok_history`：解析 `<image_files>` + `<user_query>` → text + images[]
- [x] 1.5 预览白名单最小化为 `~/.grok/sessions` / `$GROK_HOME/sessions`

## 2. OpenCode / Kimi transport (P0)

- [x] 2.1 OpenCode：`run -f` + staging resolve
- [x] 2.2 Kimi：path 注入 + ReadMediaFile 指令 + marker
- [x] 2.3 `cli_image_input.rs` 共享 resolve / Kimi build+split
- [x] 2.4 features + matrix：kimi/opencode `image_input = true`

## 3. Canvas display contract (P0)

- [x] 3.1 Kimi history loader strip 注入，images[] 还原
- [x] 3.2 Grok history loader strip image_files 包装
- [x] 3.3 MessageImage `localPath` + LocalImage fallback + workspaceId
- [x] 3.4 live bubble 用 visibleUserText + finalImages
- [x] 3.5 presentation 保留普通用户输入中的 engine-like marker/tag

## 4. Capability / Codex (P0/P1)

- [x] 4.1 `require_image_support` 按 features（当前全放行）
- [x] 4.2 client matrix gate 与 features 同源
- [x] 4.3 Claude/Codex 发图路径不改 transport
- [x] 4.4 Codex sync `params_to_codex_input` 透传 images

## 5. Tests (P0)

- [x] 5.1 rust：grok prompt-json / cli_image_input / history strip / image gate
- [x] 5.2 frontend：engineImageInput / messaging 不误拦 / marker 原文保真 / localPath
- [x] 5.3 人工验收：Grok/Kimi/OpenCode 发图 + 幕布缩略图；Claude/Codex 回归
- [x] 5.4 daemon bridge 注册 `cli_image_input`，Rust 全目标编译

## 6. Docs (P0)

- [x] 6.1 report 以代码为准重写
- [x] 6.2 OpenSpec proposal / design / tasks / delta spec 校准
- [x] 6.3 `openspec/changes/README.md` 状态更新
