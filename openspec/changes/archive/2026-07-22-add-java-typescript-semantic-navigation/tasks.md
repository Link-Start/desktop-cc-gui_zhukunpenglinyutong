## 1. Generic LSP Runtime（P0）

- [x] 1.1 [依赖: 无] 将 Rust-only runtime 泛化为 provider descriptor + `(provider, workspace)` session；输入为 explicit query，输出保持 bounded `SemanticLocation`；用 focused Rust tests 验证 framing、reuse、timeout、exit 与 workspace containment。
- [x] 1.2 [依赖: 1.1] 增加 environment override、PATH 与 Windows `.cmd/.bat` argument-safe launch spec；输出可执行 provider process；用 platform-focused unit tests 验证 macOS/Linux/Windows command shape。
- [x] 1.3 [依赖: 1.1] 增加 session cap 与 opportunistic idle eviction；输出无 polling 的 bounded lifecycle；用 fake/isolated runtime test 验证 live reuse 与 idle eviction。

## 2. Java And TypeScript Providers（P0）

- [x] 2.1 [依赖: 1.1, 1.2] 将 Java definition/references/implementation 路由到 user-installed JDT LS，失败时输出 stable fallback reason code；focused Rust tests 覆盖 provider selection、launch args、reason mapping 与 unavailable fallback，live semantic success 由 product-owner manual QA 验证。
- [x] 2.2 [依赖: 1.1, 1.2] 将 TS/JS definition/references/implementation 路由到 `typescript-language-server --stdio`，失败时输出 stable fallback reason code；focused Rust tests 覆盖 provider selection、launch args、reason mapping 与 unavailable fallback，未声明 fake/live provider integration automation。
- [x] 2.3 [依赖: 2.1, 2.2] 统一 command response metadata：`mode/provider/language/fallbackReasonCode/result`；用 backend contract tests 验证 semantic 与 heuristic shape 前向兼容。

## 3. Navigation Feedback UX（P1）

- [x] 3.1 [依赖: 2.3] 在 frontend service boundary normalize typed navigation response，并让 cache 保存完整 metadata；focused utility/service tests 覆盖 malformed payload 与 cached fallback mode。
- [x] 3.2 [依赖: 3.1] 在 `useFileNavigation` 增加 local query status 与 retry action，保持 stale response guard；hook/component tests 覆盖 loading、single jump、fallback、timeout 与 retry。
- [x] 3.3 [依赖: 3.2] 在 result panel/footer 显示 action、count、semantic/fast-search mode 与 localized retrieval copy；focused UI tests 覆盖 warning/error/empty/close/keyboard-click path。
- [x] 3.4 [依赖: 3.3] 同步所有现有 locale keys 与 compact theme-token styles；targeted lint/typecheck 验证无硬编码 copy 和类型漂移。

## 4. Performance And Compatibility Gates（P0）

- [x] 4.1 [依赖: 3.2] 锁定 explicit-query-only contract；modifier hover test 断言零 backend query，typing-latency test 断言输入链路未增加 navigation work。
- [x] 4.2 [依赖: 2.3, 3.4] 运行 focused Rust/Vitest、typecheck、targeted lint、runtime contract 和单 change strict OpenSpec validation；Java product-owner manual QA 已完成，TS live semantic 与三系统真机 smoke 未作为 automated evidence，不运行全量测试。
- [x] 4.3 [依赖: 4.2] 执行 `openspec-verify-change`，同步 main specs 并归档 change；验证 tasks/spec/design 与实现一致。
