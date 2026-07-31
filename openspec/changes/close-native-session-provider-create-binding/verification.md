# Verification — close-native-session-provider-create-binding

**状态**：功能人工验收 **通过**（用户确认，2026-07-31 / 会话内）  
**提交**：按用户要求实现期 **未 commit**；文档/提案本轮更新后仍待用户决定是否提交

---

## 交付能力矩阵（最终）

| # | 能力 | 实现要点 | 验收 |
|---|------|----------|------|
| 1 | Claude managed 启用不盖盘 | switch 只写 `claude.current` | ✅ |
| 2 | 新建菜单选供应商 = 启用 + 创建绑定 | activate + creationProviderSelection | ✅ |
| 3 | 创建/首发 L2 binding | thread.providerProfileId → send | ✅ |
| 4 | 同 CLI 多供应商并行意图 | 各会话独立 binding；不靠盖盘 | ✅ |
| 5 | Provider 续接后启动设置 | activate 目标 + model + catalog | ✅ |
| 6 | 切老会话适配创建供应商 | useProviderModelCatalogSync activate + force catalog | ✅ |
| 7 | 底栏渠道显示当前会话供应商 | 清 overrides + name snapshot | ✅ |
| 8 | UI 外观不重做 | 无启用按钮/菜单视觉改版 | ✅ |

---

## 自动化

| 命令 | 结果 |
|------|------|
| `openspec validate close-native-session-provider-create-binding --strict` | PASS |
| `pnpm vitest run useSidebarMenus.test.tsx useProviderModelCatalogSync.test.tsx ModelSelect.test.tsx sessionLifecycleController.test.ts` | 预期 PASS（实现期已跑过子集） |

---

## Review：是否还有欠缺

### 已覆盖主路径

- 菜单创建、续接、切会话、不盖盘、芯片与模型映射、L2 发送

### 已知残余 / 后续可选

| 项 | 严重度 | 说明 |
|----|--------|------|
| **无 providerProfileId 的极老 Claude 会话** | 低 | 不强制 L1；只能跟全局 current / local |
| **Kimi/Grok switch 仍可能 materialize 各自配置文件** | 中（非本轮） | 与 Claude settings.json 盖盘不同；若要对齐「全面不盖盘」需另 change |
| **底栏芯片在 catalog 未加载时 models 短暂为空** | 低 | 显示名正确，loading 态；catalog force 刷新后补齐 |
| **全链路 E2E 未自动化** | 中 | 依赖人工；可加 Playwright 后续 |
| **续接 + 极快连点会话** 可能并发多次 switch | 低 | catalog key 去重；可接受 |
| **Composer 全局 selectedModelId 与 thread 选择竞态** | 低 | 已 persist 到 thread；极端切换可再观察 |
| **OpenSpec 尚未 sync/archive 到主 specs** | 流程 | 验收提交后执行 sync + archive |
| **分析文档曾有「菜单禁止 switch」旧表述** | 文档 | 本轮改为 current-only switch 契约 |

### 建议不纳入本 change

- Shared Session 多 provider UI
- set-current-only 与 materialize 的 Kimi/Grok 统一治理
- 为无 binding 老会话做启发式推断 provider

---

## 代码锚点（便于二次 review）

| 职责 | 文件 |
|------|------|
| Claude 不盖盘 switch | `src-tauri/src/vendors/commands.rs` `vendor_switch_claude_provider` |
| activate + mapping | `src/features/vendors/activateEngineProviderProfile.ts` |
| 菜单/续接 | `src/features/app/hooks/useSidebarMenus.ts` |
| 切会话 | `src/app-shell-parts/useProviderModelCatalogSync.ts` |
| 底栏渠道 | `ModelSelect.tsx` profileOverrides + snapshot；`Composer.tsx` providerProfileName |
| 发送 L2 | `useThreadMessaging` + `getThreadProviderProfileId` |

---

## 结论

**主需求已闭环并通过人工验收。**  
残余项均为边界/其他引擎/流程债，不阻塞本 change 合并；合并前建议再跑一遍完整相关 Vitest，合并后 `openspec sync` / archive。
