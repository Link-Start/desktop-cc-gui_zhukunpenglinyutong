# 同 CLI 多供应商：Native / Shared 供应商与模型切换（最终契约）

> **日期**：2026-07-31  
> **状态**：**人工验收通过**（Native + Shared）  
> **OpenSpec**：`openspec/changes/close-native-session-provider-create-binding/`  
> **用途**：最终行为契约 + 实现锚点

---

## 0. 一句话

| 场景 | 契约 |
|------|------|
| **Native** | 发送跟创建时 binding（L2）；UI 跟当前会话创建供应商适配（L1 current-only + 映射 + catalog）；Claude 启用**不盖盘** |
| **Shared** | Picker 只改 **`selectedNextTarget`**；Claude 切供应商后**模型列表必须换到该供应商 catalog**；不新建会话、不走 Native 续接 |

---

## 1. Native：L1 / L2

| 层 | 职责 | 不做什么 |
|----|------|----------|
| **L1** | 使用中、模型映射、底栏渠道 | Claude **不写** `~/.claude/settings.json` |
| **L2** | `thread.providerProfileId` 创建/发送 | 不因 L1 切换改写已有 binding |

### Native 已实现入口

| 入口 | 行为 |
|------|------|
| 新建菜单选供应商 | activate + 创建记忆 → 创建 L2 |
| 设置页启用 | current-only（不盖盘） |
| Provider 续接成功 | activate 目标 + model/effort + catalog |
| 切换老会话 | 按会话 profile activate + force catalog；发送仍 L2 |
| 底栏渠道芯片 | 清 overrides + name snapshot |

---

## 2. Shared：与 Native 不同

| | Native | Shared |
|--|--------|--------|
| 状态 | 会话 `providerProfileId` | **`selectedNextTarget`**（下一次 Send） |
| 选供应商 | 绑定会话 / 续接 | **只改 Picker 目标** |
| 模型数据 | 切会话 catalog | **`ensureModels(engine, profileId)`** |
| 根因（已修） | 盖盘、切会话不适配 | **catalog 未返回就写旧 model id** |

### Shared 已实现

| 点 | 行为 |
|----|------|
| 切渠道 | `await ensureModels` → 用**新** models 写 target |
| 空 catalog | **不**沿用旧渠道 model id |
| 标签 | 优先 provider-scoped `model.model`；Claude mapping 按渠道同步 |
| 外观 | **不变** |

### Shared 有意不做

- 切渠道时**不强制**改配置页「使用中」（next-send only；与 Native 切会话不同）

---

## 3. 关键代码

| 职责 | 路径 |
|------|------|
| Claude 不盖盘 switch | `src-tauri/src/vendors/commands.rs` |
| activate + mapping | `src/features/vendors/activateEngineProviderProfile.ts` |
| Native 菜单/续接 | `useSidebarMenus.ts` |
| Native 切会话 | `useProviderModelCatalogSync.ts` |
| **Shared 渠道→模型** | `ModelSelect.handleChannelSwitch`、`useProviderTargetCatalogOwners.ensureModels` |
| Shared target store | `shared-session/target/targetStore.ts` |
| 底栏芯片 | `ModelSelect.tsx`、`Composer.tsx` `providerProfileName` |
| 发送 L2（Native） | `getThreadProviderProfileId` → send |
| Launch isolation | Claude launch profile + `--settings` |

---

## 4. 禁止

- managed 启用盖写 `~/.claude/settings.json`
- Native 发送用全局 current 顶会话 binding
- Shared 切渠道沿用上一供应商 model id
- 把 Shared 当成 Native 续接/切会话去 activate「使用中」（除非产品另定）
- 从零重写并行 runtime

---

## 5. 残余（review）

| 项 | 严重度 | 说明 |
|----|--------|------|
| 无 profile 的极老 Native 会话 | 低 | 不强制 L1 |
| Kimi/Grok materialize | 中 | 另 change |
| Shared 不刷「使用中」 | 有意 | follow-up 若产品要同步 |
| E2E / openspec sync | 流程 | 提交后 |

---

## 6. 验收清单

### Native

- [x] 菜单启用 + 创建绑定 + 不盖盘  
- [x] 续接 / 切老会话 / 底栏渠道 / 发送 L2  

### Shared

- [x] Claude 切供应商 → 模型列表切换  
- [x] 仅 selectedNextTarget；外观不变  

---

## 7. OpenSpec

- Change：`close-native-session-provider-create-binding`
- Deltas：`engine-per-session-provider-binding`、`claude-provider-management`、**`shared-execution-target`**

---

## 8. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-31 | Native 契约与实现；人工验收 |
| 2026-07-31 | Shared 渠道→模型；人工验收 |
| 2026-07-31 | 文档/Spec 补齐 Native+Shared 对照 + review |
