## 1. Backend Provider Catalog Contract

- [x] 1.1 [P0, depends: none] 扩展 `ModelInfo` 与 `get_engine_models` optional payload；输入 `engineType/providerProfileId/forceRefresh`，输出保留 provider origin 的 model rows；用 Rust DTO/command tests 验证。
- [x] 1.2 [P0, depends: 1.1] 复用 Claude/Codex/Kimi provider config resolver生成 provider-owned models，并与 public generated catalog按 runtime model identity去重；用三引擎 unit tests覆盖 provider优先、public追加、missing provider fail closed。
- [x] 1.3 [P0, depends: 1.2] 同步 Desktop remote forwarding 与 daemon dispatch/state；用 runtime contract gate及daemon focused tests验证 payload parity。

## 2. Frontend Scoped Catalog

- [x] 2.1 [P0, depends: 1.1] 扩展 Tauri service与 `useEngineController` scope；输入 active `providerProfileId`，输出 provider-scoped visible catalog；用 service/hook tests验证 cache key、force refresh和stale response guard。
- [x] 2.2 [P0, depends: 2.1] 将 active thread provider binding接入模型刷新，并把 scope传至 Composer catalog composition；用 hook/component tests验证跨 provider thread切换与last-good error behavior。
- [x] 2.3 [P0, depends: 2.2] 合并 provider models、public custom models与generated models，过滤其他 Codex provider origin并整体去重；用 model options tests验证provider label优先及公共模型保留。

## 3. Consistent Provider Copy

- [x] 3.1 [P1, depends: none] 统一 Claude/Codex/Kimi local/managed badge i18n key并删除unused专用文案；用 sidebar menu tests验证中文/英文语义一致。

## 4. Verification

- [x] 4.1 [P0, depends: 1.3,2.3,3.1] 运行 focused Vitest、Rust tests、`npm run typecheck`、`npm run lint`、`npm run check:runtime-contracts`。
- [x] 4.2 [P0, depends: 4.1] 运行 `openspec validate fix-provider-scoped-model-catalog-selection --strict --no-interactive` 与 cross-layer consistency检查，记录剩余manual QA。

## 5. Provider-Scoped Session Model And Runtime Recovery

- [x] 5.1 [P0, depends: 1.2] 新增 Codex provider-scoped fallback model resolver；managed create/send 读取当前 profile `configToml.model`，缺失时省略，disk 保留 workspace fallback；用 Rust tests 验证并覆盖名为 `Kimi` 的 Codex profile。
- [x] 5.2 [P0, depends: 5.1] 将 pipe disconnect 纳入 shared create-session bounded retry；重建同一 provider runtime，持续失败转换为稳定 recovery error；同步 Desktop/daemon tests。
- [x] 5.3 [P0, depends: 5.2] frontend 兼容 raw pipe error，只显示 recoverable toast、不调用 native alert；用 `useWorkspaceActions` tests 覆盖 managed/disk provider。
- [x] 5.4 [P0, depends: 5.1,5.2,5.3] 更新 Trellis executable contracts，运行 focused Rust/Vitest、typecheck、lint、runtime contracts、OpenSpec strict validate 与 cross-layer verification。

## 6. Manual-Acceptance Regression Closure

- [x] 6.1 [P0, depends: 2.1,2.2] provider scope 切换开始时立即发布该 scope 的 last-good catalog；无缓存时清空旧 scope，禁止请求期间继续展示 disk/global 或其他 provider models。
- [x] 6.2 [P0, depends: 6.1] 补“选择 managed Claude provider → 创建 pending thread → provider catalog 收敛”的 regression tests，断言旧 `gpt-*` model 不可见、provider default model 可选。
- [x] 6.3 [P0, depends: 6.1,6.2] 运行 focused Vitest、typecheck、lint、runtime contracts、strict OpenSpec validation 与 cross-layer review。

## 7. Provider-Scoped Reasoning Capability Preservation

- [x] 7.1 [P0, depends: 2.2] provider-scoped Codex model 按 normalized runtime identity 从权威 Codex catalog 补缺 `supportedReasoningEfforts/defaultReasoningEffort`；provider-owned metadata 必须保持优先，未知模型不得伪造 capability。
- [x] 7.2 [P0, depends: 7.1] 补 Codex managed provider reasoning 回归测试，并验证 Claude Code provider-bound thread 继续使用既有完整 reasoning options。
- [x] 7.3 [P0, depends: 7.1,7.2] 运行 focused Vitest、typecheck、lint、runtime contracts 与 strict OpenSpec validation。

## 8. Provider-Scoped User Model Selection

- [x] 8.1 [P0, depends: 2.2] active provider-bound Codex thread 的非空用户模型名不得经过 current/global catalog 白名单校验；catalog 暂时缺行时仍必须保留选择，不得回写默认模型。
- [x] 8.2 [P0, depends: 8.1] 补 MiniMax 与其他 arbitrary custom model name 保持选择、blank value fallback、catalog 暂时为空且不触发 repair persistence 的 regression tests，同时保留 global Codex fallback behavior。
- [x] 8.3 [P0, depends: 8.1,8.2] 运行 focused Vitest、typecheck、lint、runtime contracts 与 strict OpenSpec validation。

## 9. Claude Provider-Scoped User Model Selection

- [x] 9.1 [P0, depends: 8.1] 将相同的 non-empty thread model truth contract 扩展到 provider-bound Claude Code thread；catalog loading/absence 不得触发 default repair。
- [x] 9.2 [P0, depends: 9.1] 补 arbitrary Claude provider model 在 catalog unavailable 时保持 model/effort 且不触发 repair persistence 的 regression test。
- [x] 9.3 [P0, depends: 9.1,9.2] 运行 focused Vitest、typecheck、lint、runtime contracts 与 strict OpenSpec validation，并完成 diff review。

## 10. Composer Startup Convergence

- [x] 10.1 [P0, depends: 8.1,9.1] active thread 的 model/effort repair 写入 cache/store 时必须同步 active selection state，并对语义相同值保持 reference identity，阻断 AppShell 启动期重复 repair。
- [x] 10.2 [P0, depends: 10.1] 补 active provider thread repair 与重复等值写入 regression tests，断言首次 repair 后立即收敛且不会产生额外 render。
- [x] 10.3 [P0, depends: 10.1,10.2] 运行 focused Vitest、typecheck、lint、production build、runtime contracts 与 strict OpenSpec validation。
