# Tasks: fix-model-picker-send-authority

> 优先级：P0 Shared 失败回滚 → P0 Native 提交写 resolver → P1 send 只读权威。  
> 禁止与 `restore-sidebar-background-scan-sqlite` 混测、混 commit。  
> 不重写 display-authority label 解析，不扩 residual 品牌表。

## 1. P0 Shared 提交即写 target

- [x] 1.1 `handleChannelSwitch`：先算出完整 target，再写 `onExecutionTargetChange`；`!keptModel` 必须回滚 `profileOverrides`。输入：`ModelSelect.tsx`。输出：无 keptModel 时底栏不停留在新渠道。验证：ModelSelect vitest。
- [x] 1.2 Shared 模型行点选必须写出完整 `selectedNextTarget` 后才关菜单。输入：`ModelSelect.tsx` / Shared `onExecutionTargetChange`。输出：不重开菜单即可 send 到新模型。验证：Composer / ModelSelect vitest。
- [x] 1.3 send 组装禁止读 `profileOverrides`。输入：`useThreadMessaging.ts`。输出：残留 override 不影响 argv / target。验证：messaging vitest。

## 2. P0 Native overlay 不得单独成为权威

- [x] 2.1 `handleNativeAtomicTargetChange` 同 profile 路径同步写 overlay + `onSelectModel` + 保证 resolver 本轮/下一 tick 同一 id/runtime。输入：`Composer.tsx`、`useAppShellComposerModelSection.ts`。输出：点选后 `resolveComposerSelection()` 已是新模型。验证：Composer + resolver vitest。
- [x] 2.2 跨 profile 清 overlay，走续接；取消事件同时清 overlay 与 override。输入：`Composer.tsx`、`ModelSelect.tsx` rollback listener。验证：续接取消 vitest。
- [x] 2.3 禁止 send 直接读 `nativeAtomicSelection`。输入：`useThreadMessaging.ts`。验证：代码搜索 + send 单测。

## 3. P1 点选 runtime 不被同 tick 修掉

- [x] 3.1 用户刚提交的 runtime（含 catalog 外 freeform）不得被同 tick residual repair 换成 catalog 默认。输入：composer model section / send 边界。验证：vitest「点选 R → modelForSend=R」。
- [x] 3.2 全局 / 其他会话 `selectedModelId` 不得覆盖本线程已提交 target。验证：Shared + Native 各一条。

## 4. 验证与边界

- [x] 4.1 闭合态 label 仍遵守 `fix-shared-model-picker-display-authority`（不回退「选择模型」假空）。验证：既有 display vitest 仍绿。
- [x] 4.2 跑触及的 vitest；`openspec validate fix-model-picker-send-authority --type change --strict --no-interactive`。
- [ ] 4.3 手测：Native 同 profile 切模型后立刻发送；Shared 切渠道后立刻发送；续接取消后发送仍走原 binding。**不 archive 直到手测勾选。**
