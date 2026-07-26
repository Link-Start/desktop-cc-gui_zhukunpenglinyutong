## 1. Claude runtime ownership（P0）

- [x] 1.1 基于现有 `providerProfileId` 输入新增 Claude provider-aware runtime key 与 manager compatibility wrappers；输出可按 workspace 枚举、按 runtime 获取/移除的 API；验证 manager unit tests。
- [x] 1.2 将 desktop 与 daemon Claude send path 改为使用 provider-aware runtime owner；输出 request/binding/default 优先级不变的 runtime lookup；验证现有 payload 与 provider binding tests。
- [x] 1.3 将 workspace interrupt/remove/shutdown/settings-reload/diagnostics 迁移到多 runtime 枚举，将 turn interrupt 迁移到精确 owner；验证 cleanup failure 与并行 child tests。

## 2. Claude launch context completeness（P0，依赖 1）

- [x] 2.1 将 resolved provider env 保存为 turn-scoped immutable launch context，并在所有 completion/error/interrupt 路径清理；验证 secret 不进入日志或 diagnostic payload。
- [x] 2.2 让 legacy flag retry、auto-compact、AskUserQuestion resume 与 approval resume 继承原 turn provider env；验证 provider A/B/local secondary spawn matrix。
- [x] 2.3 将 AskUser MCP 从 workspace-only lookup升级为 opaque runtime locator lookup，并保留 local compatibility；验证 managed/local MCP routing。

## 3. Provider management UI（P1）

- [x] 3.1 将 Claude managed provider row状态改为 localized“新会话可选” badge，移除 `onSwitch` UI contract；验证 component test不调用 global switch。
- [x] 3.2 保留 local official config编辑与兼容展示，确认 reorder/edit/delete 与现有 CC Switch diff不冲突；验证 VendorSettings focused tests。

## 4. CLI header responsive layout（P1）

- [x] 4.1 调整 feature-scoped brand/action/version/button CSS，支持正常流换行且不裁剪；验证 desktop/narrow selector contract。
- [x] 4.2 补充 lifecycle header component/style tests，覆盖 latest、outdated、update、refresh与窄宽度组合。
- [x] 4.3 隔离 Claude login shell proxy banner 与 canonical version line；验证真实 banner fixture 不进入 `localVersion`。
- [x] 4.4 区分 latest unknown 与 confirmed latest；恢复 desktop 单行右对齐并验证 lifecycle 三态。

## 5. Cross-layer verification（P0，依赖 1-4）

- [x] 5.1 运行 focused Rust tests：Claude manager/runtime/provider env/MCP/resume/cleanup。
- [x] 5.2 运行 focused Vitest：ProviderList、VendorSettingsPanel、CLI lifecycle header/style。
- [x] 5.3 运行 `npm run typecheck`、`npm run check:runtime-contracts`、`npm run check:large-files`、Rust compile gate与 `git diff --check`。
- [x] 5.4 运行 `openspec validate isolate-claude-provider-runtimes-and-align-vendor-ui --strict --no-interactive`，记录尚需人工验证的真实双 provider会话与窄窗口视觉检查。

## 6. Manual-Acceptance Regression Closure（P0）

- [x] 6.1 修正 Claude managed provider add/edit description：明确配置独立存储于 desktop-cc-gui、不会写入 `~/.claude/settings.json`，并用于绑定该 provider 的会话。
- [x] 6.2 复核同 workspace 下 local/provider A/provider B 的 runtime key、turn launch context、secondary spawn 与 cleanup tests，补足缺失的并行隔离断言。
- [x] 6.3 运行 provider UI、Claude runtime、typecheck、lint、runtime contracts、strict OpenSpec validation 与 cross-layer review。

## 7. Legacy Provider Env Scalar Compatibility（P0）

- [x] 7.1 在 shared Claude provider resolver 中兼容 JSON string/number/boolean scalar，统一转换为 process env string；`null`、object、array 保持 contextual fail-closed。
- [x] 7.2 补 DeepSeek `max_history/max_tokens` numeric env、boolean scalar 与 invalid composite regression tests，验证 catalog/launch 共用 normalized env。
- [x] 7.3 运行 Claude focused Rust tests、Desktop/daemon compile、model catalog/runtime contracts、typecheck、strict OpenSpec validation 与 cross-layer review。
