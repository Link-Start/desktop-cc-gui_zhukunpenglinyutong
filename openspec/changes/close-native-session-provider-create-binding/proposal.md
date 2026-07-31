## Why

Claude managed 供应商的「启用」历史上会 merge 盖写 `~/.claude/settings.json`，导致不是独立配置、无法并行。同时：

- **Native Session**：新建菜单选供应商、Provider 续接、切换老会话时，UI（使用中 / 模型映射 / 底栏渠道 / 模型列表）未对齐创建时 `providerProfileId`
- **Shared Session**（交互不同）：Picker 只改 `selectedNextTarget`；在 Claude 里切换供应商后对话框模型列表不切换，或仍显示上一渠道模型

## 目标与边界

### 目标

1. **独立供应商（Claude）**：managed 启用 **不盖写** `~/.claude/settings.json`；会话/发送 env 走 L2 + launch/`--settings`
2. **Native 新建菜单**：选供应商 = 启用启动（L1 current + 映射）+ L2 创建记忆
3. **Native Provider 续接**：同步目标供应商启动设置、模型/effort、catalog
4. **Native 切换老会话**：按创建时 provider 适配 L1/映射/catalog/底栏渠道；**发送仍用会话 binding**
5. **Shared Picker 选供应商**：在**不改外观**前提下，切渠道后模型列表切换到该供应商 catalog；写回完整 `selectedNextTarget`
6. **UI 外观冻结**：现有样式与交互形态不变

### 非目标

- 从零重写并行 runtime / 独立 `CLAUDE_CONFIG_DIR`
- 去掉设置页「启用」或改回 7/27「新会话可选」视觉
- Shared Session V2 全量重建
- Shared 选供应商时强制改配置页「使用中」（与 Native 切会话不同；Shared 只保证 Picker 模型/target）
- 无 `providerProfileId` 的极老 Native 会话自动补绑

## What Changes

### Native Session

- Backend：Claude managed switch 只写 `claude.current`
- `activateEngineProviderProfile` + 事件刷新「使用中」
- 新建菜单 / 续接 / 切会话适配
- ModelSelect 底栏芯片：清 overrides + name snapshot

### Shared Session（与 Native 路径分离）

- `ensureModels` 返回 `ModelInfo[]`
- `handleChannelSwitch` **await** 目标渠道 catalog 后再写 `ExecutionTarget`
- 禁止 catalog 为空时沿用旧渠道 `modelCatalogEntryId`
- Claude 切渠道时 `syncClaudeModelMappingForProfile`；label 优先 provider-scoped `model.model`

## Capabilities

### Modified Capabilities

- `engine-per-session-provider-binding`：Native 菜单/续接/切会话
- `claude-provider-management`：managed 启用不盖盘
- `shared-execution-target`：Shared Picker 切 Provider 后模型目录与 `selectedNextTarget` 对齐

## Impact

| 场景 | 路径 |
|------|------|
| Claude 不盖盘 | `vendors/commands.rs` |
| activate | `activateEngineProviderProfile.ts` |
| Native 菜单/续接/切会话 | `useSidebarMenus`、`useProviderModelCatalogSync` |
| Shared 渠道→模型 | `ModelSelect.handleChannelSwitch`、`useProviderTargetCatalogOwners.ensureModels` |
| Docs | 本 change + `docs/analysis/native-session-provider-select-vs-disk-overwrite-2026-07-31.md` |

## 技术方案对比（Shared 渠道切换）

| 方案 | 说明 | 取舍 |
|------|------|------|
| A. 切渠道立即用旧 model id 写 target | 快 | **否** — 模型列表/target 串渠道 |
| B. await ensureModels 再用新 catalog 写 target | 与 Shared selectedNextTarget 语义一致 | **是** |
| C. 复用 Native 切会话 activate 全套 L1 | 混用场景 | **否** — Shared 不新建会话、不要求改「使用中」 |

## 验收标准

### Native（已通过）

- 菜单启用 + 创建绑定 + 不盖盘；续接；切老会话；底栏渠道；发送 L2

### Shared（已通过）

- Shared 会话 Claude 底栏切供应商 → **模型列表变为该供应商模型**
- 仅更新 `selectedNextTarget`；不新建会话、不走 Native 续接
- 外观/交互形态不变
