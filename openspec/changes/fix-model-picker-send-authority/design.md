# Design: fix-model-picker-send-authority

## Context

发送已经分家：

| 模式 | send 权威 | 现状画面 |
|---|---|---|
| Shared | per-thread `selectedNextTarget` | `ModelSelect` 先 `setProfileOverrides`，`!keptModel` 可提前 return，target 不写 |
| Native | `resolveComposerSelection()`（`useAppShellComposerModelSection` 写入的 ref）+ 线程 L2 `providerProfileId` | `nativeAtomicSelection` overlay 让勾选即时亮，再 `onSelectModel`；resolver 仍可能吃 residual / 全局 catalog |

0.8.9 就是双权威。测试版2 让 overlay / override 更跟手，假切换体感更重。

`fix-shared-model-picker-display-authority` 只规定闭合态 **怎么画**。`fix-native-parallel-provider-model-isolation` 只修跨供应商 residual。本设计规定 **点选写谁**。

## Goals / Non-Goals

**Goals:**

1. 用户提交 picker 后，下一轮 send 读到的模型身份 = 刚提交的身份。
2. overlay / override 只做反馈，不算「已切换」。
3. Native 跨 profile 仍走续接；取消必须清 overlay。
4. 可用 vitest 钉死 Shared 与 Native，不混侧栏测试。

**Non-Goals:**

- 重写 Atomic 双栏 IA。
- 改 Badge / history。
- 扩 residual 品牌表。
- 改 Claude daemon `settings.json`。
- 改侧栏 Index。

## Decisions

### D1. 单一提交函数，先写权威再关菜单

**选定**：Atomic 点选（模型行 / 渠道行）的成功路径必须：

1. 算出完整 `ExecutionTarget`（engine + profile + catalogEntryId + runtime model）
2. **先** 调 `onExecutionTargetChange`（Shared → `selectedNextTarget`；Native → `handleNativeAtomicTargetChange`）
3. 权威回调成功后再清或收敛 override
4. 关菜单

失败（catalog 空、续接取消、非法 target）MUST：

- 不把 override / overlay 留成「看起来已选」
- Shared 保持旧 `selectedNextTarget`
- Native 保持旧 resolver + L2

`handleChannelSwitch` 里 `if (!keptModel) return` 必须先回滚 `profileOverrides`，或改为「没 target 就不写 override」。

### D2. Native overlay 寿命短于一次 send

**选定**：`nativeAtomicSelection` 可以在 `onSelectModel` 异步落地前照亮勾选，但 `handleNativeAtomicTargetChange` 同 profile 路径 MUST 同步：

- `setNativeAtomicSelection`
- `onSelectModel(catalogEntryId)`
- 保证 `useAppShellComposerModelSection` 本轮 / 下一 tick 把同一 id 与 runtime 写入 `composerSelectionResolverRef`

禁止：只 set overlay、resolver 仍是上一模型。禁止：effect 里自动 `handleSelectModel` 修 Claude residual（已有 #185 禁令），改由 **点选当下** 写入 resolver。

跨 profile：清 overlay，走 `handleNativeProviderTargetChange`。取消续接已有 `PROVIDER_CONTINUATION_UI_ROLLBACK_EVENT`，必须同时清 overlay 与 override。

### D3. send 只读权威，不读 overlay

**选定**：

- Shared send：只信完整 `selectedNextTarget`。禁止用 `profileOverrides` 或全局 `selectedModelId` 临时拼。
- Native send：只信 `resolveComposerSelection()` + 该线程 L2 profile。禁止从 `nativeAtomicSelection` 再读一份。

若出现「画面有 overlay、resolver 还没跟上」，这是 D2 的 bug，不得在 send 里补第二读源。

### D4. 与既有 change 的边界

| change | 本 change 碰不碰 |
|---|---|
| `fix-shared-model-picker-display-authority` | 不改 label 解析序；提交后 display 自然跟 target |
| `fix-native-parallel-provider-model-isolation` | 不扩 residual；点选的 runtime 即使 catalog 外也要能发出（freeform） |
| `restore-sidebar-background-scan-sqlite` | 零文件重叠 |

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| 等 catalog 再写 target 会让勾选变慢 | 点选行已有 model 身份就立刻写 target；ensure catalog 只 enrichment |
| 续接取消后 override 残留 | D1 失败回滚 + 既有 rollback 事件 |
| resolver 与 persist 双写造成 #185 | 不在 effect 里自动 select；只在用户提交时写 |
| Native 自定义名被 isolation residual 修掉 | 本 change 测试钉「用户刚点的 runtime 不得被同 tick repair 清掉」；冲突时以刚提交为准 |

## Migration Plan

1. Shared `handleChannelSwitch` 失败回滚（最小止血）。
2. Native `handleNativeAtomicTargetChange` 与 resolver 同步。
3. send 边界断言：Shared 无完整 target 则 fail-closed；Native 用 resolver。
4. 无协议 / DDL。回滚按文件独立 revert。

## Open Questions

无。Badge 不反写、热路径不扫盘、不混侧栏测试已拍板。
