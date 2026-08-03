## 1. Frontend dismiss affordance

- [x] 1.1 `ProviderContinuationDialog`：移除 cancel 按钮 `disabled={isRunning}`
- [x] 1.2 `onOpenChange`：允许在 `running` 时调用 `onCancel`
- [x] 1.3 Dialog test：`running` 阶段取消可点并触发 `onCancel`

## 2. Hook cancel + late-success guard

- [x] 2.1 `closeProviderContinuationDialog`：允许 `running` 关闭；记入 canceled set；清理 operationKey；running 不 discard prepared（仅 preparing/confirm/prepare-retry discard）
- [x] 2.2 `confirmProviderContinuation`：create 返回后若 operation 已 canceled，跳过 select/activate/dialog write
- [x] 2.3 hook test：running 中 close 后 late ready success 不调用 `onSelectThread`
- [x] 2.4 hook test：running 中 close 后 late error 不重新打开 dialog

## 3. Verification

- [x] 3.1 跑 focused Vitest：`ProviderContinuationDialog.test.tsx`、`useSidebarMenus.test.tsx`（continuation 相关）
- [x] 3.2 `openspec validate allow-provider-continuation-cancel-while-running --strict`
