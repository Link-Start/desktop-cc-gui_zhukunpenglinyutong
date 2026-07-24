## Why

2026-07-24 cleanup wave 已删除多条 legacy bridge / responsive / notice 分支，但 review 发现仍有不可达状态、无 producer 的等待链，以及两个会造成 stale result 或 backup collision 的 correctness 缺口。现在需要用最小 correction pass 收口，避免“删除了一半”的残余继续制造延迟、重复任务和数据保护风险。

## 目标与边界

- 删除 composer 中无 producer 的 JCEF slash/prompt callback、waiter、retry state；local fallback 必须立即返回。
- semantic review cache 必须随 diff 内容和语言变化失效；不可取消请求不得因 client-only timeout 并发启动 fallback engine。
- corrupted settings/workspaces backup 文件名必须唯一，连续 recovery 不得覆盖已有备份。
- 删除 runtime notice dock 已不可达的 indicator/CSS 分支。
- 仅做 focused tests、typecheck、focused lint/Rust tests，不跑全量测试。

## 非目标

- 不恢复 JCEF bridge。
- 不新增 semantic review cancellation backend API。
- 不重构全量 desktop-only responsive 参数链。
- 不改变 settings navigation 或新增产品入口。

## What Changes

- Slash command fallback 直接返回 local command，不再等待 30 秒。
- Prompt fallback 直接返回 empty/create items，不再注册 legacy global callback。
- Semantic review cache key 增加 normalized diff fingerprint 与 language。
- 删除不可取消 request 上的 frontend `Promise.race` timeout，避免 fallback engine 与原 engine 并发执行。
- Corrupted storage backup 名称增加 UUID，保证同秒内唯一。
- 删除 notice dock 的 `has-notice` / `streaming` dead styles 与重复 effect write。

## 方案对比与取舍

1. **继续保留 legacy state，补 fake producer 或缩短 timeout**：改动表面较小，但继续维护不存在的 bridge contract，仍会产生无效状态与 race。
2. **删除无 producer 链路，复用现有 local/provider props**：代码更少，行为与当前 Tauri 架构一致；选用此方案。
3. **为 semantic request 新增 cancellable backend command**：长期更完整，但会扩大 IPC contract；本次只删除 client-only timeout，保留 backend 自身 settlement。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `composer-file-reference-completion-stability`: 无 runtime producer 时 slash completion 必须立即返回 local fallback。
- `git-panel-diff-view`: AI review cache 必须绑定实际 diff/language，且 fallback 不得并发遗留 request。
- `app-settings-corruption-recovery`: 同秒连续 quarantine 必须保留每一份 backup。
- `workspaces-corruption-recovery`: 同秒连续 quarantine 必须保留每一份 backup。

## 验收标准

- Slash/prompt provider 不再声明或读取 `updateSlashCommands`、`updatePrompts`、pending global payload。
- Slash provider focused test 证明 local result 不依赖 timer/callback。
- Semantic hook focused test覆盖 diff 与 language 变化触发新 request。
- Rust focused test覆盖连续两次 quarantine 产生两个不同 backup。
- `npm run typecheck`、focused ESLint/Vitest、focused cargo tests、`git diff --check` 通过。

## Impact

受影响范围：composer completion providers、session activity semantic review hook/util、Tauri JSON storage quarantine、runtime notice dock component/styles，以及对应 focused tests/specs。无新增依赖、无 public IPC signature 变化。
