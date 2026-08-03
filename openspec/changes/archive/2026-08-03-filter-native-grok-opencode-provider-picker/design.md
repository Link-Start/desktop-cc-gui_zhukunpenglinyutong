## Context

`ChatInputBox` 通过 `PROVIDER_PROFILE_ENGINES` 决定 Native Session 是否进入
Provider-scoped picker。该 allowlist 只有 Claude/Codex/Kimi，导致 Grok/OpenCode
落入 legacy grouped selector。随后 `useNativeProviderTargetCatalog` 自身的 supported
engine union 也只覆盖三种 CLI。

## Goals / Non-Goals

**Goals:**

- 让五个已具备 Provider Profile catalog 的 CLI 共享同一 Native picker 判定。
- Native catalog owner 始终只投影当前 CLI group。
- 用参数化测试锁定 Grok/OpenCode scope，并保留 Atomic 五 CLI contract。

**Non-Goals:**

- 不改变 Shared/Home Atomic picker。
- 不改变 local sentinel normalization、Provider continuation 或 send runtime。
- 不增加组件层 engine-specific render 分支。

## Decisions

### 1. 统一 Native Provider capability type guard

抽取一份覆盖五 CLI 的 typed capability list 与 `isProviderProfileEngine` guard，
`ChatInputBox` 入口和 catalog owner 共用。这样 filtering 在 data owner 层完成，同时
避免两份 allowlist 漂移。

替代方案是在 `ModelSelect` 中按 `currentProvider` 过滤 `targetGroups`。这会掩盖上游
catalog contract 错误，并使其他消费者仍收到跨 CLI groups，因此拒绝。

### 2. 保持 fail-closed fallback

当 `currentProvider` 不属于五 CLI（例如 Gemini）时，Native catalog owner 不启用；
legacy selector 继续处理该 engine。catalog owner 内部保留 defensive fallback，但正常
Native 入口只会传入五 CLI。

### 3. 测试 owner 与入口判定

- Hook test 参数化覆盖 Grok/OpenCode 只返回当前 group 与当前 Models。
- ChatInputBox focused test 覆盖两种 engine 会进入 Native Provider picker，不再回退
  legacy `modelGroups`。

## Risks / Trade-offs

- [Risk] 新增 CLI 时忘记进入 Native picker。→ 单一 type guard 同时控制入口与 owner，
  参数化测试形成 capability 哨兵。
- [Risk] Shared/Home picker 被误过滤。→ 不修改 Atomic owner 分支，并保留现有五 CLI
  create-session test。

## Migration Plan

无数据迁移。发布后新打开的 Grok/OpenCode Native selector 直接使用 scoped catalog。
回滚时恢复两处 allowlist 与新增测试即可，不影响已存 Session。

## Open Questions

无。
