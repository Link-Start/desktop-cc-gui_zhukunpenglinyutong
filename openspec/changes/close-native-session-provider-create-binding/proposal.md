## Why

Claude managed 供应商的「启用」历史上会 merge 盖写 `~/.claude/settings.json`，导致不是独立配置、无法并行。同时：新建菜单选供应商、Provider 续接、以及**切换老会话**时，UI（使用中 / 模型映射 / 底栏渠道芯片 / 模型列表）未稳定对齐该会话**创建时**的 `providerProfileId`，出现 DeepSeek 旧值、续接后模型仍是 deepseek 等问题。

## 目标与边界

### 目标

1. **独立供应商（Claude）**：managed 启用/切换 **不盖写** `~/.claude/settings.json`；会话 env 走 L2 binding + launch/`--settings`（复用 7/26–27 isolation）。
2. **新建菜单**：选供应商 = 启用启动（L1 current + 模型映射 + 使用中 UI）+ L2 创建记忆。
3. **Provider 续接成功**：同步目标供应商启动设置、模型/effort、catalog。
4. **切换老会话**：按该会话创建时 provider 自动适配 L1/映射/catalog/底栏渠道名；**发送仍用会话 binding**。
5. **UI 外观冻结**：设置页启用/使用中形态与菜单结构不重做视觉。

### 非目标

- 从零重写并行 runtime / 独立 `CLAUDE_CONFIG_DIR`
- 去掉设置页「启用」按钮或改回 7/27「新会话可选」文案形态
- Shared Session V2 大改
- 无 `providerProfileId` 的极老会话自动补绑（仅不强制 L1 switch）
- 本轮不自动 archive / 不强制 commit（人工验收后另提）

## What Changes

- Backend：`vendor_switch_claude_provider` managed 路径 **移除** `apply_provider_to_claude_settings`（仅 `claude.current`）
- Frontend 公共：`activateEngineProviderProfile` + 事件刷新「使用中」
- 新建菜单：`selectProviderForCreate` / `creationProviderSelection`
- 续接成功：activate 目标 + composer model + `refreshEngineModels`
- 切会话：`useProviderModelCatalogSync` 按 thread.providerProfileId activate + force catalog
- ModelSelect：清 `profileOverrides`；禁止盲回 `profiles[0]`；会话 `providerProfileName` 驱动底栏芯片
- OpenSpec delta + 分析文档同步

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `engine-per-session-provider-binding`：菜单启用启动、续接激活、切会话适配 UI、L2 发送不变
- `claude-provider-management`：managed 启用 **不得** 盖写本地 disk settings

## Impact

| 层 | 路径 |
|----|------|
| Backend | `src-tauri/src/vendors/commands.rs` |
| 公共 | `src/features/vendors/activateEngineProviderProfile.ts`、`vendorActiveProviderEvents.ts` |
| 菜单/续接 | `useSidebarMenus.ts`、`Sidebar.tsx`、layout nodes |
| 切会话 | `useProviderModelCatalogSync.ts`、`app-shell.tsx` domain context |
| 模型 UI | `ModelSelect.tsx`、`Composer.tsx`、`useLayoutNodes.tsx` |
| Docs | `docs/analysis/native-session-provider-select-vs-disk-overwrite-2026-07-31.md`、本 change |

## 技术方案对比（取舍）

| 方案 | 说明 | 取舍 |
|------|------|------|
| A. 启用继续盖写 settings.json | 与旧 CC Switch 习惯一致 | **否** — 非独立供应商 |
| B. current-only L1 + L2 binding + 复用 isolation | 使用中可同步；发送按会话；不盖盘 | **是**（本轮） |
| C. 仅 L2、不同步使用中 | 并行最纯 | **否** — 产品要求菜单/切会话看到「使用中」与渠道芯片 |

## 验收标准（人工已通过）

- 菜单选 managed → 配置页「使用中」对齐；创建会话 L2 绑定正确；**不盖盘**
- 同 workspace 多 Claude managed 会话可分别绑定发送
- Provider 续接后：目标使用中、模型/渠道正确
- 切换 m3/k3 老会话：底栏渠道与模型列表跟随会话创建供应商；发送仍用创建 binding
- UI 无设置页/菜单视觉改版
- 相关 Vitest + `openspec validate --strict` 通过
