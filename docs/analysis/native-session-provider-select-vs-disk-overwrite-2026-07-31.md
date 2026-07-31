# 同 CLI 多供应商：独立配置、创建/续接/切会话适配（最终契约）

> **日期**：2026-07-31  
> **状态**：**人工验收通过**；实现见 OpenSpec change  
>   `openspec/changes/close-native-session-provider-create-binding/`  
> **用途**：给后续 AI/工程师的 **最终行为契约** + 实现锚点（非草稿）

---

## 0. 一句话

**会话发送永远跟创建时绑定的供应商（L2）；UI「使用中 / 模型列表 / 底栏渠道」跟当前会话的创建供应商适配（L1 current-only + 映射 + catalog）；Claude managed 启用绝不盖写 `~/.claude/settings.json`。**

---

## 1. L1 / L2

| 层 | 是什么 | 做什么 | 不做什么 |
|----|--------|--------|----------|
| **L1** | app 内 current、「使用中」、模型映射展示 | 菜单选供应商、设置页启用、切会话、续接成功时更新 | **Claude 不写** `~/.claude/settings.json` |
| **L2** | `thread.providerProfileId` | 创建写入；发送/launch 用它 + `--settings`/Codex home | 不因 L1 切换改写已有会话 binding |

---

## 2. 已实现路径（验收通过）

| 入口 | 行为 |
|------|------|
| **新建菜单右侧选供应商** | L1 activate + 创建记忆；左侧创建带完整 profile → L2 |
| **设置页启用** | 同 L1 current-only（Claude 不盖盘） |
| **Provider 续接成功** | activate 目标；model/effort；force catalog |
| **切换老会话** | 按该会话 `providerProfileId` activate + mapping + force catalog；发送仍 L2 |
| **底栏渠道芯片** | 跟会话供应商名；清 overrides；禁止回落列表首项 |

### 关键代码

| 职责 | 路径 |
|------|------|
| Claude 不盖盘 switch | `src-tauri/src/vendors/commands.rs` |
| activate + Claude mapping | `src/features/vendors/activateEngineProviderProfile.ts` |
| 使用中刷新事件 | `src/features/vendors/vendorActiveProviderEvents.ts` |
| 菜单/续接 | `src/features/app/hooks/useSidebarMenus.ts` |
| 切会话 | `src/app-shell-parts/useProviderModelCatalogSync.ts` |
| 底栏芯片 | `ModelSelect.tsx`、`Composer.tsx` `providerProfileName` |
| 发送 L2 | `getThreadProviderProfileId` → `engine_send_message` |
| Launch isolation | `engine/claude/provider_profile.rs`、`--settings` override |

---

## 3. 明确禁止

- managed 启用时 `apply_provider_to_claude_settings` 盖盘  
- 发送用全局 current 顶替会话 binding  
- 切会话时底栏/模型仍显示上一会话供应商  
- 从零重写并行 runtime  

---

## 4. 残余欠缺（review）

| 项 | 严重度 | 建议 |
|----|--------|------|
| 无 `providerProfileId` 的极老会话 | 低 | 不强制适配；可选后续补绑工具 |
| Kimi/Grok switch 仍可能 materialize 本机配置 | 中 | 另开 change 对齐「启用不写用户盘」 |
| 无全链路 E2E | 中 | Playwright：菜单创建 / 续接 / 双会话切换 |
| OpenSpec 未 sync 进主 specs | 流程 | 提交后 `openspec sync` + archive |
| 快速连点会话多次 switch | 低 | 可节流；当前可接受 |

---

## 5. 验收清单（已通过）

- [x] 菜单选 managed → 使用中对齐；创建绑定正确；settings.json 不盖  
- [x] 双 Claude 会话不同供应商可分别用  
- [x] 续接后目标供应商与模型正确  
- [x] 切 m3/k3 老会话：使用中、模型、**底栏渠道**跟随会话  
- [x] 发送跟创建时供应商  
- [x] UI 无大改版  

---

## 6. OpenSpec

- Change：`close-native-session-provider-create-binding`  
- Specs delta：`engine-per-session-provider-binding`、`claude-provider-management`  
- 验证：`openspec validate close-native-session-provider-create-binding --strict`

---

## 7. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-31 | 问题分析与实现指导初稿 |
| 2026-07-31 | 实现：不盖盘、菜单/续接/切会话/芯片；人工验收通过 |
| 2026-07-31 | **终稿**：提案与本文同步为最终契约 + 残余 review |
