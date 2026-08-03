# Design: Grok CLI reasoning effort

## 1. 问题分层

| 层 | 症状 | 修复点 |
|---|---|---|
| 声明 | matrix / features 为 unsupported | fixture + `EngineFeatures::grok` + generate |
| UI | ButtonArea 仅 claude/codex | 加 grok + 固定 options |
| 投影 | `getEffectiveReasoningSupported/Options` 忽略 grok | mirror Claude 固定档 |
| 持久化 | thread selection 清零 grok effort | `normalizeComposerSessionSelectionForThread` |
| 发送 | `normalizeEngineScopedEffort` 清零 | allowlist 放行 |
| 进程 | `build_command` 不读 effort | 拼 `--reasoning-effort` |

## 2. 档位契约

- **Composer / normalize / adapter 统一 allowlist**：`low` | `medium` | `high`
- 依据：当前默认模型 `grok-4.5` 对未知档返回 `use one of: high, medium, low`
- Grok CLI 文档还有 `none/minimal/xhigh/max` 与 per-model menu id；本期 **不暴露**，避免 UI 可选但 CLI 拒收
- 后续若做动态菜单，应改为从 runtime model metadata 注入，并同步白名单

## 3. 数据流

```text
ReasoningSelect (provider=grok)
  -> handleSelectComposerEffort
       activeThreadSelection = draft when no thread (claude|grok)
  -> selectedComposerSelection { modelId, effort }
  -> sendUserMessage / shared path
  -> normalizeEngineScopedEffort("grok", effort)
  -> engine_send_message(..., effort)
  -> SendMessageParams.effort
  -> GrokSession::build_command
       if allowlist: --reasoning-effort <level>
  -> grok headless child
```

Async 与 sync Grok 路径均构造 `SendMessageParams { effort, ... }`，共用 `build_command`。

## 4. UI 语义（对齐 Claude）

- `showDefaultOption=true`：可选「默认」→ `effort=null` → **不**传 flag，由 CLI/模型默认决定
- 有 thread：以 thread selection 的 effort 为准
- 无 thread：允许 draft selection 携带 effort（否则选择会被 `getEffectiveSelectedEffort` 读空）

## 5. 风险与防护

| 风险 | 防护 |
|---|---|
| silent drop（receipt 有、argv 无） | adapter 单测强制检查 flag 窗口 |
| 非法档位炸 CLI | FE + Rust 双重 allowlist |
| matrix 与 generated 漂移 | `check-engine-capability-matrix` |
| 无 thread 选了又丢 | `useAppShellComposerModelSection` draft injection |

## 6. 非目标再确认

- 不修改 permission mode（自动模式）
- 不改 Grok 图片 / history tool 投影
