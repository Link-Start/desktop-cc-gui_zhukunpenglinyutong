# Verification

## Automated

- `cargo test --manifest-path src-tauri/Cargo.toml engine::claude:: --lib`: 141 passed.
- `cargo test --manifest-path src-tauri/Cargo.toml --lib provider_binding_`: 4 passed.
- `cargo check --manifest-path src-tauri/Cargo.toml --lib`: passed.
- `cargo check --manifest-path src-tauri/Cargo.toml --bin cc_gui_daemon`: passed.
- Focused Provider/Vendor/CSS Vitest: 23 passed.
- Thread start/fork and lifecycle focused Vitest: 34 passed.
- `npm run typecheck`: passed.
- Targeted ESLint: passed.
- `npm run check:runtime-contracts`: passed.
- `npm run check:large-files`: command completed; repository-wide report 仍列出既有超限文件。
- `git diff --check`: passed.
- `openspec validate isolate-claude-provider-runtimes-and-align-vendor-ui --strict --no-interactive`: passed.

## Existing unrelated failures

- `useThreadMessaging.test.tsx` 中 10 个 OpenCode/Gemini product-policy 断言失败；本变更相关的 Claude provider binding case 通过。

## Manual acceptance

- 同一 workspace 分别用 provider A、provider B 新建 Claude 会话并并行发送。
- 两个 thread 各自继续发送，确认 provider attribution 与响应来源不串线。
- local official config 新建会话，确认未被 managed provider 写回或覆盖。
- 在 managed thread 触发 AskUserQuestion/approval，并执行 `/compact`。
- 缩窄设置窗口，检查 proxy、version、update、refresh actions 无重叠。
## 2026-07-27 Claude CLI Settings Precedence Closure

- 用户实测确认 provider selection、provider-scoped model catalog 与 session creation 外观正确，但 managed Claude turn 仍被 `~/.claude/settings.json` 的 provider environment 覆盖。
- Root cause：process env injection 不是 Claude CLI settings precedence 的最高层；managed child 缺少 command-line `--settings` override。
- 修复：每个 managed turn attempt 创建 private settings file，command args 只携带 file path；Local 不创建 override。AskUserQuestion/approval resume 复用同一 path，legacy retry 重新物化等价 override。
- Security：Unix directory/file mode 分别为 `0700` / `0600`；secret 不进入 process args 或日志；RAII guard 在 attempt 结束后删除目录。
- Routing isolation：override 对当前 provider 未提供的 auth/model/cloud routing variables 写入 empty string，阻断 user settings 中另一 provider 的残留。

增量验证：

- `cargo test --lib engine::claude::tests_command -- --nocapture`：16 passed。
- `cargo test --lib engine::claude::provider_profile::tests -- --nocapture`：6 passed。
- `cargo test --lib engine::claude::tests_stream::ask_user_question_resume -- --nocapture`：2 passed。
- `cargo check --lib --bin cc_gui_daemon`：passed（仅既有 warnings）。
- `openspec validate isolate-claude-provider-runtimes-and-align-vendor-ui --strict --no-interactive`：passed。
- `git diff --check`：passed。

未运行全量测试；按用户要求仅执行上述 affected-scope gates。
