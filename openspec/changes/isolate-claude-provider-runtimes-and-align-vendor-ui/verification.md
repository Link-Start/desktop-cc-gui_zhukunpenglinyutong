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
