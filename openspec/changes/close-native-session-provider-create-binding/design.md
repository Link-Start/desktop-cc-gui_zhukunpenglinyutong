## Context

- 上游分析：`docs/analysis/native-session-provider-select-vs-disk-overwrite-2026-07-31.md`
- Native：thread `providerProfileId` + launch/`--settings`
- Shared：`selectedNextTarget` / `activeTurnTarget` 分离（`shared-execution-target`）

## Native vs Shared（必须拆开）

| | Native Session | Shared Session |
|--|----------------|----------------|
| 选供应商语义 | 会话 L2 binding / 续接建会话 | **仅** `selectedNextTarget`（下一次 Send） |
| 模型列表数据 | 切会话 force catalog + mapping | **Atomic** `ensureModels(engine, profileId)` per profile |
| 写 target 时机 | 创建/续接/切会话 | Picker 渠道/模型变更 |
| 失败模式 | 盖盘、芯片旧值、切会话不适配 | **catalog 未返回就写旧 model id** |

## Decisions

### D1. L1 vs L2（Native）

- L1：使用中 + 映射展示（current-only，Claude 不盖盘）
- L2：发送 binding

### D2. Claude managed 启用不盖盘

`vendor_switch_claude_provider` 仅 `claude.current`。

### D3. Native 三入口 activate

菜单 / 续接成功 / 切会话 → `activateEngineProviderProfileAndNotify`。

### D4. Shared 渠道切换（本轮补充）

1. `ensureModels` **返回** `ModelInfo[]`
2. `handleChannelSwitch` **await** 返回值后再选模型
3. **禁止** `profile.models` 为空时回落 `executionTarget.modelCatalogEntryId`（旧渠道）
4. Claude：`syncClaudeModelMappingForProfile` + label 优先 `model.model`（provider-scoped）
5. **不**要求 Shared 切渠道时改配置页「使用中」（与 Native 切会话不同）

### D5. 底栏芯片（Native 为主，Shared 同源组件）

- 清 `profileOverrides`；name snapshot；禁止盲回 `profiles[0]`

## Risks / Residual

| 项 | 说明 |
|----|------|
| Shared catalog 拉取失败 | 不写 target；用户可重试切渠道 |
| Shared 不刷新设置页「使用中」 | 有意：next-send only |
| Kimi/Grok materialize | 另 change |
| E2E | 人工已验；可后补 Playwright |

## Rollback

- Shared：回退 `handleChannelSwitch` await + `ensureModels` 返回值即可
- Native：回退 activate / switch 盖盘路径按文件粒度还原
