## Context

- 上游：`docs/analysis/native-session-provider-select-vs-disk-overwrite-2026-07-31.md`
- 复用：Claude `provider_profile` launch env、`ClaudeProviderSettingsOverride` + `--settings`、Codex 独立 home、thread `providerProfileId` 发送
- 历史：7/26–27 isolation；7/30 UI 加回「启用」并盖盘；本 change 去掉盖盘并补全创建/续接/切会话适配

## Goals / Non-Goals

见 proposal。实现原则：**复用 isolation，接线不重写栈；L1 不盖盘；L2 管发送。**

## Decisions

### D1. L1 vs L2

| 层 | 职责 | 实现 |
|----|------|------|
| L1 | 配置页「使用中」、模型映射展示、底栏渠道芯片 | `switch*Provider` current-only + `syncClaudeModelMappingForProfile` |
| L2 | 会话创建绑定、发送路由 | `thread.providerProfileId` + launch/`--settings` |

### D2. Claude managed 启用不盖盘

`vendor_switch_claude_provider` managed：**仅** `claude.current = id`，**禁止** `apply_provider_to_claude_settings`。

### D3. 三条入口共用 activate

| 入口 | 行为 |
|------|------|
| 新建菜单选供应商 | `selectProviderForCreate` → activate + 创建记忆 |
| Provider 续接成功 | activate 目标 + model/effort + `refreshEngineModels` |
| 切换 active 会话 | `useProviderModelCatalogSync` → activate 会话 profile + force catalog |

公共模块：`activateEngineProviderProfile.ts` + `vendorActiveProviderEvents.ts`。

### D4. 底栏渠道芯片

- 切会话清 `profileOverrides`
- 匹配失败用 `providerProfileNameSnapshot`，禁止盲回 `profiles[0]`
- Composer 传入会话 `providerProfileName`

## Risks / Residual

| 风险 | 状态 |
|------|------|
| 无 `providerProfileId` 的极老会话 | 不强制 L1；发送走 default/local |
| Kimi/Grok switch 仍可能 materialize 各自配置文件 | 本轮未改（Claude 盖盘是主痛点） |
| 并发快速连点会话可能多次 switch | 可接受；catalog key 去重 |
| 全链路 E2E 未自动化 | 人工验收已覆盖主路径 |

## Rollback

- 恢复 `apply_provider_to_claude_settings` 调用会回到盖盘行为（不推荐）
- 前端可单独回退 `useProviderModelCatalogSync` activate 与 ModelSelect 芯片逻辑
