---
type: report
status: historical
---

<!-- DOC-LIFECYCLE: implemented-capability-evidence -->
> [!NOTE]
> **Lifecycle: Implemented capability evidence.** Grok reasoning-effort change 已于 2026-08-03 归档。Current contract：[Grok reasoning effort spec](../../openspec/specs/grok-reasoning-effort/spec.md)。

# Grok CLI 思考强度接入（2026-08-01）

> **文档性质**：implementation + verification evidence  
> **基线分支**：`feature/v-0714`  
> **OpenSpec change**：`openspec/changes/archive/2026-08-03-grok-cli-reasoning-effort/`  
> **关联**：`add-grok-engine` 初版非目标；本 change 单独收口 reasoning effort  
> **不是** 永久 current value：能力以 `openspec/specs/engine-capability-matrix/fixtures/matrix.json` 与 `pnpm check:engine-capability-matrix` 为准

## 一、结论

| 问题 | 结论 |
|---|---|
| Grok CLI 是否支持思考强度？ | **支持**（`--reasoning-effort` / `--effort`，TUI `/effort`） |
| mossx 是否已接入？ | **是（本 change）** |
| 是大活吗？ | **否**；公共 effort 字段与 Claude 选择器路径已在，缺的是 Grok 闸门放行 + argv |

## 二、能力矩阵

| Engine | `reasoning.effort` |
|---|---|
| Claude | supported |
| Codex | supported |
| **Grok** | **supported**（本 change） |
| Gemini / Kimi / OpenCode | unsupported |

生成物：`engineCapabilityMatrix.generated.ts` / `capability_matrix.generated.rs`  
运行时 features：`EngineFeatures::grok().reasoning_effort = true`

## 三、发送链路（code map）

```text
ReasoningSelect (grok)
  -> handleSelectComposerEffort (+ draft selection when no thread)
  -> selectedComposerSelection.effort
  -> normalizeEngineScopedEffort("grok")
  -> engine_send_message / _sync (effort)
  -> SendMessageParams.effort
  -> grok.rs build_command: --reasoning-effort <low|medium|high>
```

关键文件：

| 层 | 路径 |
|---|---|
| Adapter | `src-tauri/src/engine/grok.rs` |
| Features | `src-tauri/src/engine/mod.rs`、`bin/cc_gui_daemon/engine_bridge.rs` |
| Matrix | `openspec/specs/engine-capability-matrix/**` + generated |
| Composer UI | `src/features/composer/components/ChatInputBox/ButtonArea.tsx` |
| Effort 投影 | `src/app-shell-parts/modelSelection.ts` |
| Thread 选择 | `src/app-shell-parts/selectedComposerSession.ts` |
| Send normalize | `src/features/threads/hooks/messageRuntimeController.ts` |
| Draft 注入 | `src/app-shell-parts/useAppShellComposerModelSection.ts` |

## 四、档位策略

- **UI / FE normalize / Rust allowlist 统一**：`low` · `medium` · `high`
- **默认（null）**：不传 flag，交给 CLI 默认
- **不暴露** `xhigh` / `max` / `none`：当前 grok-4.5 菜单实测仅 low/medium/high，避免可选后 CLI 拒收

## 五、验证

### 自动化

- [x] `node scripts/check-engine-capability-matrix.mjs`
- [x] vitest：modelSelection / selectedComposerSession / messageRuntimeController / ButtonArea / useAppShellComposerModelSection
- [x] cargo test filter `reasoning_effort`（含 grok build_command 正反例）

### 人工

- [x] 外观：Grok 会话出现思考强度选择（用户确认）
- [ ] 可选：抓一次真实子进程 argv（单测已锁契约；实机 auth 因环境可能 401）

## 六、内部复审要点（收口前）

1. **禁止 silent drop**：receipt 带 effort 时 argv 必须有 flag → adapter 单测锁死  
2. **无 thread 选 effort**：必须像 Claude 一样注入 draft `activeThreadSelection`，否则 `getEffectiveSelectedEffort` 读空  
3. **三处 allowlist 对齐**：`GROK_REASONING_OPTIONS` / session Set / `GROK_REASONING_EFFORTS` in `grok.rs`  
4. **generated 必须随 fixture `--write`**，否则 CI matrix check 红

## 七、一句话

**CLI 早支持；mossx 把 Grok 的思考强度接到 composer + `--reasoning-effort`，档位保守三档，matrix 与实现一致。**
