# Proposal: fix-dsh-followup-ccgui-provider-leak

> OpenSpec change id: `fix-dsh-followup-ccgui-provider-leak`  
> 现场：DSH 多轮跑通后，续聊报 `model-unavailable: no adapter registered for provider "ccgui"`  
> 正交：`fix-native-followup-engine-collision`（锁 thread，不锁 model）；`fix-model-picker-send-authority`  
> 本 change **不** 改 engine registry / Shared / provider binding / context compiler / ACK

---

## Why

`fix-native-followup-engine-collision` 让 DSH 续聊 stay-on-thread，不再因 last-segment 误开 Grok CLI。但 send 权威仍读当前 `activeEngine` 的 composer resolver。

Grok / Kimi / OpenCode managed catalog id 是 `ccgui/<model>`。`activeEngine` 一旦漂到这三者（长回合中 `refreshEngines` 回写 persisted 引擎、grouped picker 点到 CLI catalog、catalog 空窗回落默认），resolver.id 变成 `ccgui/...`。`resolveDshModelForSend` 见 `/` 就原样放行，Rust 每次 send 都 `session.selectModel`，`split_model_selection` 按第一个 `/` 切开 → `provider=ccgui`。DSH host 没有这个 adapter。

用户体感是「跑着跑着断了，继续就报错」。上一轮其实跑完了，下一轮 `selectModel` 立刻失败。

## What Changes

- `resolveDshModelForSend` fail-closed：拒绝 mossx 保留 provider `ccgui`；无合法 `{provider}/{model}` 则返回 `null`。
- DSH 续聊 model 不可信时省略 `selectModel`，沿用该 session 已选模型。
- `composerEnginePrefs.dsh.modelId` 只给 `dsh-pending-*` 首发回退；已有 `dsh:` session 不得用全局 pref 改 `selectModel`。
- `handleSelectModel` skip 轴是 thread ownership：`threadEngine === "dsh" && targetEngine !== "dsh"`，不得把 `ccgui/...` 写入当前 DSH thread 账本或 resolver。
- Rust `send_user_turn` 在 `session.selectModel` 前拒收 `ccgui`，错误留在 mossx。

**非 BREAKING**。合法 DSH catalog id（`ggggg/grok-4.6`、`deepseek-official/...`）行为不变。显式切引擎组仍 spawn。

## 目标与边界

- **目标**：DSH 续聊不得把 mossx managed namespace `ccgui` 送给 `session.selectModel`。
- **边界**：只改 DSH send 账本、picker 写 thread、后端拒收。不改 mux 重连、不改 DSH host、不改 Shared。

## 非目标

- 不硬编码 DSH provider 白名单（用户自定义 `ggggg` / `vision-http` 必须继续可用）。
- 不修 mux 掉线 UI（本现场证据是 follow-up `selectModel`，不是中途死流）。
- 不回写基石 ADR（未命中更新触发器）。
- 单独提交本 change，不夹带无关 working-tree。

## Capabilities

### New Capabilities

- `dsh-followup-model-ledger`: DSH send 的 provider 不得为 mossx 保留名；stay-on-thread 时 model 跟 DSH catalog / dsh pref，不跟漂移后的 `activeEngine`。

### Modified Capabilities

- （无）既有 capability REQUIREMENTS 不改语义。

## Impact

- Frontend: `threadMessagingHelpers.ts`、`useThreadMessaging.ts`、`useAppShellComposerModelSection.ts`
- Backend: `src-tauri/src/engine/dsh/{session,mod}.rs`
- Tests: helpers / model section / rust `split_provider_model` 邻域
- Docs: 本 change
