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

## 4. 新建菜单

- [x] 4.1 `selectProviderForCreate` / `creationProviderSelection`
- [x] 4.2 菜单选 = activate + L2 记忆；创建带完整 profile
- [x] 4.3 Vitest：各 engine create 元数据 + switch 调用

## 5. Provider 续接

- [x] 5.1 续接成功 activate 目标供应商
- [x] 5.2 目标 model/effort 写入 composer
- [x] 5.3 `refreshEngineModels` force + providerProfileId

## 6. 切换老会话

- [x] 6.1 `useProviderModelCatalogSync`：按 thread.providerProfileId activate + force catalog
- [x] 6.2 发送仍走会话 binding（未改 messaging 契约）

## 7. 底栏渠道芯片

- [x] 7.1 切 executionTarget 清空 profileOverrides
- [x] 7.2 禁止盲回 profiles[0]；用 providerProfileNameSnapshot
- [x] 7.3 Composer/Layout 传入 providerProfileName

## 8. 文档与验收

- [x] 8.1 OpenSpec proposal/design/specs/tasks/verification 与实现对齐
- [x] 8.2 分析文档更新为最终契约
- [x] 8.3 人工验收通过（用户确认）
- [x] 8.4 `openspec validate --strict` + 相关 Vitest
