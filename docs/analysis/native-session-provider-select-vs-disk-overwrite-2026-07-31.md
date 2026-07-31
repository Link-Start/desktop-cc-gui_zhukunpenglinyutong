# 同 CLI 多供应商：Native / Shared 供应商与模型切换（最终契约）

> **对照源码日期**：2026-08-01（契约与实现复核；保留原文件名）  
> **状态**：**人工验收通过**（Native + Shared）  
> **OpenSpec**：`openspec/changes/close-native-session-provider-create-binding/`（未 archive；以 change 内 delta 为准）  
> **用途**：最终行为契约 + 实现锚点  
> **姊妹文**：幕布渲染核见 `conversation-canvas-structure-2026-07-31.md`（本文不描述 Messages 树）

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

### Claude 不盖盘（实现要点）

- `vendor_switch_claude_provider` / managed 启用路径：**只标记 active**，不调用 `apply_provider_to_claude_settings` 写盘。  
- `apply_provider_to_claude_settings` 标为 **dead_code**，仅保留给显式 export/materialize 工具。  
- 会话启动用 provider profile + turn-scoped `--settings` 注入 env，与磁盘 settings 隔离。  
- 前端 L1：`activateEngineProviderProfile` → `switchClaudeProvider` + `syncClaudeModelMappingForProfile`。

---

## 2. Shared：与 Native 不同

| | Native | Shared |
|--|--------|--------|
| 状态 | 会话 `providerProfileId` | **`selectedNextTarget`**（下一次 Send） |
| 选供应商 | 绑定会话 / 续接 | **只改 Picker 目标** |
| 模型数据 | 切会话 catalog | **`ensureModels` / `onOpenProviderProfile` 返回后**再写 target |
| 配置页「使用中」 | 随会话/菜单 activate | **不强制**（next-send only） |
| 根因（已修） | 盖盘、切会话不适配 | **catalog 未返回就写旧 model id** |

### Shared 已实现

| 点 | 行为 |
|----|------|
| 切渠道 | `ModelSelect.handleChannelSwitch`：`await onOpenProviderProfile` → 用**新** models 写 target |
| 空 catalog | **不**沿用旧渠道 model id（无 keptModel 则 return） |
| Claude 映射 | 渠道切换后 `syncClaudeModelMappingForProfile`，避免仍显示上一渠道模型名 |
| 标签 | 优先 provider-scoped `model.model`；Claude mapping 按渠道同步 |
| 外观 | **不变**（不新建会话、不走 Native 续接 UI） |

### Shared 有意不做

- 切渠道时**不强制**改配置页「使用中」（next-send only；与 Native 切会话不同）  
- 不把 Shared 当成 Native 续接/切会话去 activate「使用中」（除非产品另定）

---

## 3. 关键代码

| 职责 | 路径 |
|------|------|
| Claude 不盖盘 switch | `src-tauri/src/vendors/commands.rs`（managed 启用不写盘；`apply_provider_to_claude_settings` 非 switch 路径） |
| activate + mapping | `src/features/vendors/activateEngineProviderProfile.ts` |
| Native 菜单/续接 | `useSidebarMenus`（侧栏创建/续接路径） |
| Native 切会话 | `src/app-shell-parts/useProviderModelCatalogSync.ts` |
| **Shared 渠道→模型** | `ModelSelect.handleChannelSwitch`、`useProviderTargetCatalogOwners.ensureModels` / `onOpenProviderProfile` |
| Shared target store | `shared-session/target/targetStore.ts` |
| 底栏芯片 | `ModelSelect.tsx`、`Composer` / ChatInputBox `providerProfileName` |
| 发送 L2（Native） | `getThreadProviderProfileId` → send / start_thread |
| Launch isolation | Claude launch profile + `--settings` |

### 相关 commit（验收锚点）

| commit | 说明 |
|--------|------|
| `e2ac4a1a6` | Native：收口供应商与模型切换（独立配置不盖盘） |
| `fb6083584` | Shared：Claude 切换供应商后模型列表刷新 |

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
| Shared catalog 失败仅不写 target | 低 | 用户可重试 |
| E2E / openspec sync·archive | 流程 | change 仍在 active；主 specs 未强制 sync |

与 `openspec/changes/close-native-session-provider-create-binding/verification.md` 对齐。

---

## 6. 验收清单

### Native

- [x] 菜单启用 + 创建绑定 + 不盖盘  
- [x] 续接 / 切老会话 / 底栏渠道 / 发送 L2  

### Shared

- [x] Claude 切供应商 → 模型列表切换  
- [x] 仅 selectedNextTarget；外观不变  
- [x] catalog 为空时不沿用旧 model id  

---

## 7. OpenSpec

- Change：`close-native-session-provider-create-binding`
- Deltas：`engine-per-session-provider-binding`、`claude-provider-management`、**`shared-execution-target`**
- Verification：`openspec/changes/close-native-session-provider-create-binding/verification.md`

---

## 8. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-31 | Native 契约与实现；人工验收 |
| 2026-07-31 | Shared 渠道→模型；人工验收 |
| 2026-07-31 | 文档/Spec 补齐 Native+Shared 对照 + review |
| 2026-08-01 | 对照当前源码复核：补 Claude 不盖盘实现要点、`handleChannelSwitch`/`syncClaudeModelMapping` 细节、commit 锚点；状态仍为验收通过 |
