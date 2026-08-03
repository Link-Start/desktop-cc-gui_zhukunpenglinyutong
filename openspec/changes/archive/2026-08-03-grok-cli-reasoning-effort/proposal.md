# Why

`add-grok-engine` 初版将 Grok `reasoning.effort` 标为 unsupported，并明确 **不做 reasoning effort UI**。  
后续 Grok CLI（≥0.2.x）已原生支持：

- headless / TUI：`--reasoning-effort` / `--effort <LEVEL>`
- 交互：`/effort <level>`

mossx 侧公共发送链路（`SendMessageParams.effort`、composer selection、dispatch receipt）早已存在，但 Grok 四层闸门全挡：

1. capability matrix / `EngineFeatures` 声明 `unsupported`
2. composer 只给 Claude/Codex 渲染 `ReasoningSelect`
3. session normalize / send normalize 对 grok **强制 `effort = null`**
4. `grok.rs` `build_command` **不写** `--reasoning-effort`

用户外观可测「有没有选择器」；内部若只改 matrix 会出现 **声明支持、argv 不带** 的 silent drop。

# 目标与边界

## 目标

- Grok Native Session composer 暴露思考强度选择（默认 + `low` / `medium` / `high`）
- 用户选择写入 thread / draft composer selection，发送路径保留
- headless 启动 argv 在合法档位下追加 `--reasoning-effort <level>`
- `engine-capability-matrix`：`grok.reasoning.effort = supported`，fixture / Rust features / generated TS+RS 一致
- 不破坏 Claude / Codex 既有 effort 语义

## 非目标

- 不接 Grok 模型菜单动态档位探测（当前固定 allowlist，对齐 grok-4.5 实测 `low|medium|high`）
- 不扩展 Gemini / Kimi / OpenCode 的 reasoning effort
- 不改 shared session（Grok 仍为 native one-shot）
- 不把「自动模式 / permission mode」与思考强度混为一谈

# 方案对比与取舍

| 方案 | 说明 | 结论 |
|---|---|---|
| A. 只改 matrix | 声明与 UI/argv 分裂 | 拒绝 |
| B.  mirror Claude：固定 allowlist + thread/draft selection | 复用既有 Claude effort 语义 | **采用** |
| C. 跟 Codex 一样靠 model metadata | Grok catalog 当前无 `supportedReasoningEfforts` | 拒绝（会空选项） |

# What Changes

- Matrix / features / generated artifacts：Grok `reasoning.effort` → supported
- `grok.rs`：白名单 + `--reasoning-effort`
- FE：`GROK_REASONING_OPTIONS`、`getEffectiveReasoning*`、`ButtonArea`、session/send normalize
- `useAppShellComposerModelSection`：无 thread 时 Grok 选 effort 与 Claude 一样注入 draft selection

# Capabilities

### New Capabilities

- `grok-reasoning-effort`：Grok 思考强度选择 → 发送 → CLI flag 契约

### Modified Capabilities

- `engine-capability-matrix`：`grok.reasoning.effort` 从 unsupported 改为 supported

# Impact

- Backend：`src-tauri/src/engine/{mod,grok,capability_matrix}.rs`、daemon `engine_bridge.rs`
- Frontend：composer ButtonArea、modelSelection、selectedComposerSession、messageRuntimeController
- Spec / docs：本 change + `docs/reports/grok-cli-reasoning-effort-2026-08-01.md`
- Dependencies：无新增

# 验收标准

- [x] Grok 会话输入区出现思考强度选择（外观：用户已测）
- [x] 合法 effort 进入 `SendMessageParams` 且 argv 含 `--reasoning-effort`
- [x] 非法 / 空 effort 不写 flag（不炸 CLI）
- [x] `pnpm check:engine-capability-matrix` / 相关 unit tests 通过
- [x] Claude / Codex effort 路径无回归（单测覆盖）
