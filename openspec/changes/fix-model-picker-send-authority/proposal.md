# Proposal: fix-model-picker-send-authority

> OpenSpec change id: `fix-model-picker-send-authority`  
> 现场：ccgui 0.9.1 Windows 测试版2，「切模型只改底栏，发出去还是旧模型」  
> 正交：`fix-shared-model-picker-display-authority`（只修闭合态展示）；`fix-native-parallel-provider-model-isolation`（residual 启发式）  
> 本 change **不** 碰侧栏扫盘 / SQLite（另 change：`restore-sidebar-background-scan-sqlite`）

---

## Why

底栏 Atomic picker 看起来切了模型，下一轮 send 仍走旧 `--model` / 旧 provider。根因是 **0.8.9 起就存在的双权威**：画面一层，发送一层。0.9.1 测试版2 给 Native 加了 `nativeAtomicSelection` overlay、Shared 渠道切换先写 `profileOverrides`，勾选更跟手，但 send 仍读 L2 `providerProfileId` + `resolveComposerSelection` / Shared `selectedNextTarget`。overlay 或 override 没写进 send 账本时，就是「假切换」。

这不是 catalog 文案问题（那是 display-authority change），也不是跨供应商 residual 误修（那是 isolation change）。用户点选必须落到 send 读的那份 store。

## What Changes

- 明确 **Picker commit = Send authority**。Native 与 Shared 点选关闭菜单后，下一轮 send 读到的模型 / profile MUST 等于 picker 刚提交的身份。
- Native：`nativeAtomicSelection` 只允许做瞬时勾选反馈；同 profile 切模型 MUST 同步写入 composer selection resolver 与 L2 会话 model；跨 profile MUST 走既有续接，禁止只改 overlay。
- Shared：渠道 / 模型点选 MUST 写入完整 `selectedNextTarget`。`profileOverrides` 不得在 `!keptModel` 时提前 return 留下「只改 UI」。
- send 边界禁止用全局 `selectedModelId` / 上一会话 catalog 覆盖本轮已提交 target。
- 补齐 Native + Shared 回归：点选后未重开菜单即发送，CLI argv / Shared target 跟勾选一致。

**非 BREAKING**。Turn Badge 仍只信历史快照。

## 目标与边界

- **目标**：用户在底栏看到的「下一轮模型」与真正发出去的模型同一份账本。
- **边界**：只打通 picker 写入 → send 读取。不重做 Atomic 双栏 IA，不改 display-only 文案合同，不扩 residual 品牌表。

## 非目标

- 不改 `fix-shared-model-picker-display-authority` 的闭合态 label 解析序（可依赖，不重写）。
- 不扩 `claudeManagedRuntimeModel` residual 启发式（留给 isolation change）。
- 不改 Turn Badge / history 归因，不用 Badge 反写 picker。
- 不改 Claude daemon 落盘 `settings.json` 策略。
- 不修侧栏会话丢失。
- 不提交 git commit（实现后交用户审批）。

## Capabilities

### New Capabilities

- `composer-model-send-authority`: picker 提交与 send 读取必须同一权威；Native overlay / Shared override 不得单独成为「已切换」语义。

### Modified Capabilities

- `shared-execution-target`: Shared 渠道 / 模型点选失败时不得留下 UI-only override；下一轮 send 仍只信完整 `selectedNextTarget`。

## Impact

- Frontend:
  - `ModelSelect.tsx`（`profileOverrides` 与 `onExecutionTargetChange` 提交顺序）
  - `Composer.tsx`（`nativeAtomicSelection` / `handleNativeAtomicTargetChange`）
  - `useAppShellComposerModelSection.ts` + `composerSelectionResolver.ts`（resolver 必须吃到 picker 提交）
  - `useThreadMessaging.ts`（send 读 Shared target / Native resolver，禁止回落全局旧值）
- Tests: ModelSelect / Composer / send 边界 vitest；Native 与 Shared 分文件，不混侧栏测试。
- Backend: 默认不改 Rust。仅当 send 已正确而 CLI argv 仍吃 daemon 旧 model 时，另开最小防御，不进本 change 必做。
- Docs: 本 change。

## 技术方案对比

| 选项 | 描述 | 取舍 |
|---|---|---|
| A. 只修 trigger 文案 | 继续走 display-authority | 用户已经看到「切了」；发出去还是错 |
| B. send 时再从 overlay 读一份 | 发送边界猜 UI state | 双读源永久化；切会话 / 续接取消更乱 |
| **C. 提交即写 send 账本（推荐）** | overlay/override 只是反馈；权威只有 resolver / `selectedNextTarget` | 与 Shared V2 合同一致；Native 对齐同一句 |

采用 **C**。

## 验收标准

1. Shared：切渠道或切模型后立刻发送（不重开菜单），`selectedNextTarget` 与 `--` 实际执行模型一致；`profileOverrides` 单独变化不得算切换成功。
2. Native 同 profile 切模型：勾选、resolver、`onSelectModel` 持久化、下一轮 `modelForSend` 同一 id / runtime。
3. Native 跨 managed profile：必须走续接；取消后续接 rollback 清 overlay，send 仍用原 L2 binding。
4. catalog 尚未收录该 id 时，用户明确点选的 runtime 名仍能发出，不得 silently 回落 catalog 默认。
5. 全局 `selectedModelId` 属于其他会话 / 其他 CLI 时，不得覆盖本线程已提交 target。
6. 相关 vitest 绿。不与侧栏扫盘 change 打同一个测试包。
