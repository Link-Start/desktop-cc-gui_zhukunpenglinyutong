## 1. 审计与复用

- [x] 1.1 确认 Claude launch / `--settings` / runtime_key 仍在 send 路径
- [x] 1.2 确认 create → ensureThread → getThreadProviderProfileId 发送链路
- [x] 1.3 确认 Codex 独立 home 路径未破坏

## 2. Claude 独立启用（不盖盘）

- [x] 2.1 `vendor_switch_claude_provider` managed 只写 `claude.current`，移除 `apply_provider_to_claude_settings`
- [x] 2.2 注释说明 L1 current-only vs L2 launch

## 3. 公共 activate

- [x] 3.1 `activateEngineProviderProfile.ts`（switch + Claude mapping + notify）
- [x] 3.2 `vendorActiveProviderEvents.ts` + 各 use*ProviderManagement 监听刷新「使用中」

## 4. Native 新建菜单

- [x] 4.1 `selectProviderForCreate` / `creationProviderSelection`
- [x] 4.2 菜单选 = activate + L2 记忆；创建带完整 profile
- [x] 4.3 Vitest：各 engine create 元数据 + switch 调用

## 5. Native Provider 续接

- [x] 5.1 续接成功 activate 目标供应商
- [x] 5.2 目标 model/effort 写入 composer
- [x] 5.3 `refreshEngineModels` force + providerProfileId

## 6. Native 切换老会话

- [x] 6.1 `useProviderModelCatalogSync`：按 thread.providerProfileId activate + force catalog
- [x] 6.2 发送仍走会话 binding（未改 messaging 契约）

## 7. Native 底栏渠道芯片

- [x] 7.1 切 executionTarget 清空 profileOverrides
- [x] 7.2 禁止盲回 profiles[0]；用 providerProfileNameSnapshot
- [x] 7.3 Composer/Layout 传入 providerProfileName

## 8. Shared Session 渠道→模型（与 Native 路径分离）

- [x] 8.1 `ensureModels` 返回 `ModelInfo[]`
- [x] 8.2 `handleChannelSwitch` await catalog 后再写 `selectedNextTarget`；禁止旧 model id 回落
- [x] 8.3 Claude 切渠道 mapping 同步；label 优先 provider-scoped runtime
- [x] 8.4 Vitest：ModelSelect 渠道切换 / 空 catalog 不写旧 model
- [x] 8.5 人工验收：Shared 选供应商后模型列表切换正确

## 9. 文档与验收

- [x] 9.1 OpenSpec proposal/design/specs（含 shared-execution-target）/tasks/verification
- [x] 9.2 分析文档补充 Shared vs Native
- [x] 9.3 Native + Shared 人工验收通过
- [x] 9.4 `openspec validate --strict` + 相关 Vitest
