# Verification — close-native-session-provider-create-binding

**状态**：

- **Native Session** 供应商/模型适配：人工验收 **通过**（已 commit `e2ac4a1a6`）
- **Shared Session** Claude 选供应商后模型列表切换：人工验收 **通过**（用户确认）

---

## 交付能力矩阵

### Native Session

| # | 能力 | 验收 |
|---|------|------|
| 1 | Claude managed 启用不盖盘 | ✅ |
| 2 | 新建菜单选供应商 = 启用 + 创建 L2 绑定 | ✅ |
| 3 | 创建/首发 L2 binding | ✅ |
| 4 | 同 CLI 多供应商并行意图 | ✅ |
| 5 | Provider 续接后启动设置 | ✅ |
| 6 | 切老会话适配创建供应商 | ✅ |
| 7 | 底栏渠道显示当前会话供应商 | ✅ |
| 8 | UI 外观不重做 | ✅ |

### Shared Session（路径不同）

| # | 能力 | 验收 |
|---|------|------|
| S1 | Claude 切供应商 → 模型列表换到该供应商 catalog | ✅ |
| S2 | 只改 `selectedNextTarget`，不新建会话/不走 Native 续接 | ✅ |
| S3 | catalog 为空时不沿用旧渠道 model id | ✅（测 + 实现） |
| S4 | 外观/交互形态不变 | ✅ |

---

## Native vs Shared 对照（review）

| | Native | Shared |
|--|--------|--------|
| 状态 | `thread.providerProfileId` | `selectedNextTarget` |
| 切供应商 | 会话级 / 续接 | Picker 渠道 only |
| 模型刷新 | 切会话 force catalog + mapping | **await ensureModels** 再写 target |
| 配置页使用中 | 随会话/菜单 activate | **不强制**（next-send only） |

---

## 自动化

| 项 | 结果 |
|----|------|
| `openspec validate close-native-session-provider-create-binding --strict` | 应 PASS |
| ModelSelect + useProviderTargetCatalogOwners | 实现期 66+ 相关用例 PASS |
| useSidebarMenus / useProviderModelCatalogSync | PASS |

---

## Review：残余欠缺

| 项 | 严重度 | 说明 |
|----|--------|------|
| 无 providerProfileId 的极老 Native 会话 | 低 | 不强制 L1 |
| Kimi/Grok switch materialize | 中 | 另 change |
| Shared 不刷新配置页「使用中」 | 有意 | 与 next-send 语义一致；若产品要同步可 follow-up |
| Shared catalog 失败仅不写 target | 低 | 用户可重试 |
| E2E 未自动化 | 中 | 人工已覆盖 |
| 主 specs 未 sync/archive | 流程 | 提交后处理 |
| `allow-provider-continuation-cancel-while-running` 工作区另改 | 无关 | 勿与本能力混 commit |

---

## 代码锚点

| 职责 | 文件 |
|------|------|
| Claude 不盖盘 | `vendors/commands.rs` |
| activate + mapping | `activateEngineProviderProfile.ts` |
| Native 菜单/续接/切会话 | `useSidebarMenus` / `useProviderModelCatalogSync` |
| **Shared 渠道→模型** | `ModelSelect.handleChannelSwitch`、`ensureModels` 返回 catalog |
| Shared target store | `shared-session/target/targetStore.ts` |

---

## 结论

**Native + Shared 主路径均已人工验收通过。**  
文档与 OpenSpec 已写明两套交互差异；残余为边界/流程债，不阻塞收口。
