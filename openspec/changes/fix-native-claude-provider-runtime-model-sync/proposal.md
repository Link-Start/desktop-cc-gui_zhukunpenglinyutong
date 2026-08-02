# Proposal: fix-native-claude-provider-runtime-model-sync

## Why

Native Claude Code 在 **DeepSeek 等第三方 managed 渠道**下，UI 模型选择器四个 Claude 档位全部显示 `deepseek-v4-pro`，但 CLI 实际请求可能仍发送 **Kimi 残留短名 `k3`**，触发：

```text
API Error: 400 The supported API model names are deepseek-v4-pro or deepseek-v4-flash, but you passed k3.
```

根因是 **展示层 / 选中层 / 发送 runtime / 进程 env** 多真相源：

1. Catalog 四档 id（`claude-fable-5` 等）映射改写 display/runtime，副标题仍是 Fable/Opus/Sonnet/Haiku。
2. 前端 `localStorage` model mapping 可单独把标签画成 deepseek，而 send 仍用脏 `.model` 或 catalog id。
3. `nativeSessionTarget` 在无 atomic 覆盖时用 `selectedModelId`（常为档位 id）冒充 runtime。
4. Claude spawn **只写入** provider_env，**不清除**父进程残留的 `ANTHROPIC_*` / `ANTHROPIC_DEFAULT_*`（可泄漏 `k3`）。
5. 切渠道 / 刷 catalog 后 **不 repair** 旧 selection，Kimi 时代残留 runtime 可继续上送。

与 Shared 身份/续接问题 **不是同一 bug**（姊妹：`fix-shared-session-target-race-and-merge`），但同属 UI ≠ runtime 家族。

## 目标与边界

### 目标

1. **Send 时重解析 runtime**：Claude managed 发送前，按当前 `providerProfileId` catalog 将选中档位 id 解析为最新 `model.model`；找不到则用 profile `ANTHROPIC_MODEL`；禁止用陈旧 atomic selection / 裸档位 id 当 API model（除非已是合法 runtime）。
2. **进程 env 隔离**：spawn 前对 `CLAUDE_PROVIDER_ROUTING_ENV_KEYS` 全部 `env_remove`，再写入 provider_env。
3. **Fail-closed 校验**：runtime 必须落在该 profile catalog model 集合 ∪ profile env model 槽；DeepSeek 等已知白名单可加强；非法则 toast 拦截，不让 CLI 吐 400。
4. **切渠道 / 刷 catalog repair selection**：若当前 selection runtime 不属于新 profile（如仍为 `k3`/`kimi-*`），强制改到默认 runtime 并写回 thread composer selection。
5. **展示与发送单源**：`getModelLabel` 与 `modelForSend` 共用同一 resolver；localStorage mapping 不得单独「美化」标签而 send 读另一份脏 `.model`。
6. **nativeSessionTarget**：`model` 必须来自 catalog lookup 的 runtime，禁止 `?? selectedModelId` 用档位 id 冒充。

### 非目标

- Shared Session target 竞态 / merge（姊妹提案）。
- 改写 Claude 四档 catalog 产品形态（可 P2 增强副标题说明，非本 change 必做）。
- 全局盖写 `~/.claude/settings.json`（继续遵守不盖盘契约）。
- 修复 Claude Code trust dialog / `ANTHROPIC_API_KEY` 与 claude.ai login 抢占（环境噪音，另项）。

## What Changes

### Backend (Rust)

- Claude spawn：routing env keys 先 remove 再 apply provider_env
- （可选 harden）发送参数 model 与 provider catalog 一致性校验日志 / fail closed 钩子

### Frontend

- Send 路径：Claude managed runtime 重解析 + 非法拦截
- activate / catalog refresh 后 selection repair
- ModelSelect label 与 send 共用 resolver
- Composer `nativeSessionTarget` runtime 投影修正

## Capabilities

### New Capabilities

- `claude-provider-runtime-model-sync`：Claude managed 渠道下 display / selection / send / process env 的 runtime model 单源与 repair 契约。

### Modified Capabilities

- `claude-provider-management`：per-turn launch 必须清空父进程残留 routing env；model 注入与 catalog 一致。
- `engine-per-session-provider-binding`：发送解析的 runtime model 必须属于会话绑定 profile 的 catalog/env 槽。

## Impact

| 区域 | 路径（预期） |
|------|----------------|
| spawn env | `src-tauri/src/engine/claude.rs` |
| catalog overrides | `src-tauri/src/engine/status.rs`（必要时） |
| send model | `src/features/threads/hooks/useThreadMessaging.ts`、composer selection resolver |
| repair | `activateEngineProviderProfile.ts`、`useProviderModelCatalogSync.ts`、composer model section |
| label | `ModelSelect.tsx` |
| native target | `Composer.tsx` |
| 测试 | 前端 vitest + `cargo test` claude env / model 相关 |

## 技术方案对比

| 方案 | 说明 | 取舍 |
|------|------|------|
| A. 仅 toast 提示用户手动重选模型 | 不止血 | **否** |
| B. send 重解析 + env 清键 + repair + 单源 label | 闭环 | **是** |
| C. 取消四档映射，直接平铺供应商模型名 | 产品大变，破坏 Claude 档位语义 | **否**（本 change） |

## 验收标准

1. DeepSeek 渠道 + 勾选任一 Claude 档位：`--model` / API model **恒为** `deepseek-v4-pro` 或 `deepseek-v4-flash`（按 mapping），**永不**为 `k3`。
2. 父进程环境预设 `ANTHROPIC_MODEL=k3` 或 `ANTHROPIC_DEFAULT_FABLE_MODEL=k3`：DeepSeek 会话发送仍正确。
3. 从 Kimi 映射会话切到 DeepSeek（续接或新会话）：selection 被 repair，底栏与 send 一致。
4. 故意脏 selection=`k3`：send 前拦截或自动 repair，不出现 DeepSeek 400。
5. UI 标签与 debug `modelForSend` 一致。
6. `openspec validate` + 相关单测 / cargo test 通过。
