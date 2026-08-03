---
type: analysis
status: historical
---

<!-- DOC-LIFECYCLE: resolved-incident -->
> [!IMPORTANT]
> **Lifecycle: Resolved incident, closed 2026-08-03.** Identity T1-T3、target optimistic persistence T4 与 stale hydrate/merge protection T5 均已实施并进入 main specs。本文后续的“待实施”措辞只保留历史推演语境，不代表当前状态。
>
> Canonical evidence：[identity fix](../../openspec/changes/archive/2026-08-03-fix-shared-session-identity-id-first/) · [target race/merge fix](../../openspec/changes/archive/2026-08-03-fix-shared-session-target-race-and-merge/) · [shared target optimistic spec](../../openspec/specs/shared-session-target-optimistic/spec.md)。

# Shared Session 模型供应商选择器：回退 Native 形态调研与修复提案

> **对照源码日期**：2026-08-02 · 产品以当前 HEAD 为准（调研时约 `0.7.15` 一带）
> **状态**：**已关闭**；T1–T3 与 T4/T5 已分别实现并归档，证据见文首 canonical links
> **用途**：记录 Shared CLI 场景下「模型/渠道选择器行为退化为 Native 续接」的现象、调用链、根因、修复提案与任务拆分
> **索引**：[`README.md`](./README.md)
> **姊妹文（契约正本）**：[`native-session-provider-select-vs-disk-overwrite-2026-07-31.md`](./native-session-provider-select-vs-disk-overwrite-2026-07-31.md)
> **相关 OpenSpec**：`fix-shared-session-identity-id-first`（本修）；`close-native-session-provider-create-binding`（既有 `shared-execution-target` 契约正本）

---

## 0. 一句话

Shared Session 里使用与首页同款 Atomic 双栏模型选择器切 **Claude/Codex managed 渠道**时，系统可能错误走 **Native Provider 续接**路径，弹出「续接没有完成」；契约要求 Shared **只改 `selectedNextTarget`，不新建会话、不走 Native 续接**。根因是 Shared 身份判定只信可丢的 `threadKind` 投影、不信稳定的 `shared:` id 前缀；且该弱信号同时喂给 picker、**发送路径**与删除清理，爆炸半径大于 picker 本身。

---

## 1. 现象与复现线索

### 1.1 用户报告

1. 创建 **Shared CLI** session。
2. 在会话对话框的 **模型供应商选择器** 中操作（含「切换渠道」）。
3. 不知哪一步后，对应功能 **回退成 Native 形态**。
4. 可见 **「续接没有完成」** dialog：来源 `Codex CLI · 本地配置` → 目标 `Claude Code · kimi-k3 …`，会话展示名常为 **Shared Session**。

### 1.2 截图语义对照

| 截图 | UI | 语义 |
|------|-----|------|
| 模型选择器右栏 +「本地配置」 | Atomic 双栏 + 渠道 chip | Shared / Native **外观已统一**，不能靠长相区分身份 |
| 「切换渠道」列表（本地配置 / kimi-k3 / Minimax / …） | Channel picker | Shared 契约：只改 next-send target |
| 「续接没有完成」+ Shared Session 标题 | Native Provider Continuation 失败 UI | **不该**在 Shared 会话上出现 |

### 1.3 与既有契约的冲突

姊妹文 §2 Shared 契约：

| 项 | 契约 | 本次现象 |
|----|------|----------|
| 选供应商/渠道 | 只改 `selectedNextTarget` | 疑似触发 Native 续接 |
| 外观 | 不变、不新建会话 | 弹出续接 dialog |
| 禁止 | 把 Shared 当成 Native 续接/切会话 | 被打破 |

---

## 2. 预期行为 vs 错误行为

### 2.1 预期（Shared）

```text
用户点选 CLI / 渠道 / 模型
  → ModelSelect 构造 ExecutionTarget
  → Composer.handleSharedTargetChange
  → persistSharedSessionSelectedTarget
     (set_shared_session_selected_engine)
  → hydrateSharedTargetState(selectedNextTarget)
  → 会话 id / threadKind / 侧栏条目保持 Shared
  → 下一次 Send 用新 target
```

**不做**：

- 不打开 Provider Continuation dialog
- 不 `createNativeProviderContinuation` / prepare 续接包
- 不把 `shared:` id 当 native session id 做来源续接

### 2.2 错误（观察到的 Native 回退）

```text
用户点选 Claude managed 渠道（如 kimi-k3）
  → onExecutionTargetChange 落到 handleNativeAtomicTargetChange
  → 跨 managed profile → handleNativeProviderTargetChange
  → requestProviderContinuationDialog
  → prepareProviderContinuationDialog
  → 续接 prepare/execute 失败
  → 「续接没有完成。来源会话保持不变，可以安全重试。」
```

---

## 3. 调用链（源码锚点，已对 HEAD 复核）

### 3.1 Picker → Target 变更

| 步骤 | 路径 | 职责 |
|------|------|------|
| UI | `src/features/composer/components/ChatInputBox/selectors/ModelSelect.tsx` | 双栏 CLI + 渠道 Dialog；`handleChannelSwitch` / `handleTargetModelSelect` |
| Catalog | `.../hooks/useProviderTargetCatalogOwners.ts` | `ensureModels` / profile list；mode: `shared` \| `create-session` |
| Adapter | `ChatInputBoxAdapter.tsx` | `providerTargetPickerMode`；`executionTarget` 透传 |
| Composer 分叉 | `Composer.tsx:2720-2726` | Shared → `handleSharedTargetChange`；Native → `handleNativeAtomicTargetChange` |
| Shared 持久化 | `shared-session/services/sharedSessions.ts` | `persistSharedSessionSelectedTarget` |
| Shared store | `shared-session/target/targetStore.ts` | `selectedNextTarget` / `activeTurnTarget` |
| Native 续接请求 | `threads/services/providerContinuationRequests.ts` | `requestProviderContinuationDialog`（生产调用点仅 `Composer.tsx:948`） |
| 续接 UI | `features/app/hooks/useSidebarMenus.ts` | `prepareProviderContinuationDialog` / 失败文案 |

### 3.2 Composer 分叉（核心）

```text
onExecutionTargetChange =
  isSharedSession && !sharedTargetPickerLocked
    ? handleSharedTargetChange
    : createSessionTargetPicker
      ? handleCreationTargetChange
      : handleNativeAtomicTargetChange
```

文件：`src/features/composer/components/Composer.tsx:2720-2726`。

### 3.3 Native 跨渠道 → 续接

`handleNativeAtomicTargetChange`（`Composer.tsx:970-1031`）：

- **同** engine + profile：`nativeAtomicSelection` + `onSelectModel`
- **跨** Claude/Codex **managed** profile：`handleNativeProviderTargetChange` → 续接 dialog
- 本地 disk（`providerProfileId` 为空）不走续接

`handleNativeProviderTargetChange`（`Composer.tsx:936-965`）内有**软闸**：

```ts
if (
  isSharedSession ||           // ← 只信 prop，prop 可错
  !activeWorkspaceId ||
  !activeThreadId ||
  (target.engine !== "claude" && target.engine !== "codex") ||
  !target.providerProfileId?.trim()
) {
  return;
}
```

即：**仅当 `isSharedSession === false` 时才会真正发出续接请求**。

### 3.4 续接侧的三道闸（真实顺序，review 修正）

续接请求从发出到弹窗，实际经过**三道**闸，全部失守才会出现图 3：

| 闸 | 位置 | 判定 | 失守条件 |
|----|------|------|----------|
| 1. Composer handler 闸 | `Composer.tsx:939-946` | `isSharedSession` prop | summary `threadKind` 丢失 → prop=false |
| 2. summary 存在性闸 | `useSidebarMenus.ts:700-716` | `getThreadSummary(ws, shared:…)` 是否找到 | summary 整行被 merge 丢掉 → 弹「来源会话已不可用」error notice（**非**图 3） |
| 3. prepare kind 闸 | `useSidebarMenus.ts:585-591` | `thread.threadKind === "shared"` 才拒绝 | summary 在但 `threadKind !== "shared"` → **放行续接** |

因此图 3 能完整弹出，精确定位的现场是：

1. `activeThreadId = shared:…`（id 没变），**且**
2. `activeThreadSummary` **存在**（否则闸 2 拦成 error notice），**且**
3. 该 summary 的 `threadKind !== "shared"`（`undefined` 或被覆盖成 `"native"`）。

会话展示名仍可能是默认标题 **「Shared Session」**（`toSharedThreadSummary` / create summary 的 name 默认值），**名字不是 kind**。

---

## 4. 根因分析

### 4.1 主因：Shared 身份判定过脆（metadata-only）

多处只信 `threadKind === "shared"`，**不**用稳定 id 前缀 `shared:` 兜底：

| 位置 | 判定 | 失败时默认 |
|------|------|------------|
| `useLayoutNodes.tsx:1305` | `activeThreadSummary?.threadKind === "shared"` | `false` → Native picker 行为 |
| `app-shell.tsx:1184`（composer controller） | 同上（**同一表达式的第二处复制**） | 同上 |
| `useThreads.getThreadKind`（`useThreads.ts:699-704`） | summary.threadKind === "shared" ? shared : **native** | **native** |
| `prepareProviderContinuationDialog`（闸 3） | `thread.threadKind === "shared"` 才拒绝 | 缺 kind → **允许续接** |

对比：删除 / history / resume / messages 使用 **id 前缀**：

| 位置 | 判定 |
|------|------|
| `useThreadActions.sessionActions` 删除 | `threadKind === "shared"` **或** `threadId.startsWith("shared:")` |
| `historyLoaderFactory` | `targetThreadId.startsWith("shared:")` → SharedHistoryLoader |
| `useThreadActionsResumeThread` | `shared:` 前缀 |
| `MessagesCore` / `messagesInput` | `shared:` 前缀 |
| `sidebarInternals.ts:98` `isSharedSessionThreadId` | `threadId.trim().startsWith("shared:")`（**已存在的 helper**，Sidebar.tsx:790 在用） |

**设计原罪**：同一产品对象（Shared Session）在「发送/历史/删除」与「模型选择器」上使用**两套身份真相**；且 id-first helper 已经存在，picker 链路却没用它。

```text
id 前缀 shared:     → 稳定、create 即确定
threadKind 字段     → 列表 merge 投影，可丢/可默认 native
```

### 4.2 爆炸半径：弱信号同时喂给 picker / send / delete（review 补充）

`threadKind` 投影不止喂 picker，以下链路共用同一弱信号：

| 链路 | 位置 | 身份丢失后果 |
|------|------|--------------|
| Picker handler 分叉 | `Composer.tsx:2720-2726` | 走 Native 续接（图 3） |
| **发送路径** | `useThreadMessagingThreadResolution.ts:154-157` `resolveThreadKind` 直接代理 `getThreadKind`（默认 native）；`useThreadMessaging.ts:446 / :2275 / :2419` 等多处 | **发送也按 native runtime 走**，不止外观退化 |
| **删除清理** | `useThreads.ts:2499` `getThreadKind === "shared"` 才 `clearSharedSessionBindingsForSharedThread` | 删 shared 会话时**绑定不清理**（脏数据） |
| StatusPanel | `StatusPanel.tsx:585` `includeHistory: isSharedSession` | 历史拉取口径错 |
| MessagesCore / SharedSendStatusBar / `imageAttachEngine` / send gating（`Composer.tsx:868`） | 同吃 `isSharedSession` prop | 全面退化 |

**杠杆结论**：`getThreadKind` 是全局最高杠杆修复点——picker（经 prop 链）、send、delete 三处共用；修好它 + 两个计算源，下游全部自动归位。反之只在 Composer 内打补丁，send/delete 仍然坏。

### 4.3 诱因：线程列表与 summary 生命周期（丢失路径候选，未实证）

`threadKind` 具体**怎么丢的**尚未抓到实证现场，候选路径至少三条：

| 候选 | 位置 | 机制 |
|------|------|------|
| C-a. runtime 事件归一化 | `useThreads.ts:2892-2894` | `onThreadStarted` 归一化时 `threadKind` 非 `"native"/"shared"` → 写成 `undefined` |
| C-b. native 扫描 merge | `useThreadsReducer.ts:2451` | `threadKind = thread.threadKind \|\| existing.threadKind`；incoming 行若**显式**带 `"native"` 会覆盖 existing shared（truthy 覆盖） |
| C-c. shared 列表空/失败 | `useThreadActions.ts:1131-1143` | `if (sharedSessions.length > 0)` 整段不 merge；仅靠 `setThreads` 对 active thread 的 preserve 兜底，时机外即丢 |

**策略含义**：P0 硬闸（id-first）使以上三条全部无害化，**不阻塞开工**；P2 merge 保护必须先实证是哪条路径，否则可能补错位置。

### 4.4 外观回退感：`selectedNextTarget` 为空时回落全局 Native 选择

Shared 的 Atomic 选中态权威是 store：

```text
selectedAtomicTarget = isSharedSession ? selectedSharedTarget : nativeSessionTarget | creationTarget
```

当 `selectedSharedTarget === null`：

- `selectedEngine` / `selectedModelId` / `providerProfileId` 回落到 **app-shell 全局 / thread summary**（Native 语义字段，`Composer.tsx:2699-2701`）。
- 用户体感：还在 Shared 会话，底栏却像 Native 当前引擎。

触发清空的已实现路径：

| 路径 | 行为 |
|------|------|
| `sharedHistoryLoader.ts:60-69` | persisted `selectedTarget` 无法 `isResolvedExecutionTarget` → `hydrateSharedTargetState(..., null)` **故意清空** |
| 测试锁死 | `sharedHistoryLoader.test.ts`：「clears stale target state when persisted target is incomplete」 |

另：`handleSharedTargetChange` **无乐观更新**，仅 persist 成功后 hydrate；IPC 慢/失败期间 UI 仍可能显示旧态或 null 回落。

### 4.5 竞态：persist in-flight × history reload（review 补充）

```text
用户点选 → persistSharedSessionSelectedTarget in-flight
       ↘ 同时 sharedHistoryLoader 重载（切会话回来 / 列表刷新触发）
         → 用旧 persisted target（或 null）hydrateSharedTargetState
         → 覆盖刚点的选择
```

当前无乐观更新时表现为「点了没反应/被弹回」；若实施 P1 乐观更新，该竞态会变成**乐观值被 stale hydrate 覆盖**，更显性。修复提案必须定义写序规则（见 §7 T4）。

### 4.6 UI 统一放大了「回退」感知

`Composer` 注释已写明：全场景统一 Atomic 双栏，不再维护 conversation native 单栏分叉。

```text
providerTargetPickerMode =
  isSharedSession ? "shared" : "create-session"
```

Shared 与 Native **长得一样**；分叉只在 handler 与 catalog mode。身份一旦判错，用户只能靠续接 dialog 等副作用察觉。

### 4.7 次要：`sharedTargetPickerLocked` 不提供额外保护（review 修正）

初版调研认为 locked 时落 native handler 是 no-op、「一般不直接出续接」。**修正**：native handler 内 no-op 的前提是 `isSharedSession === true` early return（`Composer.tsx:976`）；而变体 A 的前提恰恰是 `isSharedSession === false`。因此 **identity 丢失 + locked 时，locked shared 同样能触发续接**，locked 不构成防线。

### 4.8 非根因（排除）

| 假设 | 为何不是主因 |
|------|----------------|
| ModelSelect 自己发续接 | 否；只调 `onExecutionTargetChange` |
| Shared persist 误调续接 API | 否；persist 只 `set_shared_session_selected_engine` |
| 仅 Claude mapping 同步 | `syncClaudeModelMappingForProfile` 只改映射展示，不打开续接 dialog |

---

## 5. 证据矩阵

| 证据 | 支撑 |
|------|------|
| 生产续接只从 `Composer.handleNativeProviderTargetChange` 发出 | `rg requestProviderContinuationDialog` → 仅 `Composer.tsx:948` |
| Shared 契约禁止续接 | analysis 姊妹文 §2 / §4 |
| Shared 创建写 threadKind + hydrate target | `useThreadActions.sessionActions.ts` |
| Shared 列表投影 | `sharedSessionSummaries.toSharedThreadSummary` |
| getThreadKind 默认 native | `useThreads.ts:699-704` |
| send path 代理 getThreadKind | `useThreadMessagingThreadResolution.ts:154-157` |
| delete 清理单保险 | `useThreads.ts:2499` |
| History 按 id 认 shared，Picker 按 kind | historyLoaderFactory vs useLayoutNodes:1305 |
| 续接三道闸真实顺序 | `Composer.tsx:939` / `useSidebarMenus.ts:700` / `:585` |
| 续接失败默认文案 | `useSidebarMenus.providerContinuationRecoveryMessage` →「续接没有完成…」 |
| summary 缺失时的另一形态 | `useSidebarMenus.ts:704-716` →「来源会话已不可用」notice |
| incomplete target 清空 store | `sharedHistoryLoader.ts:60-69` + 单测 |
| merge 覆盖规则 | `useThreadsReducer.ts:2451` |
| 已有 id-first helper 未复用 | `sidebarInternals.ts:98`（Sidebar.tsx:790 在用） |

---

## 6. 复现与运行时验证清单

### 6.1 推荐复现步骤

1. 新建 Shared Session（侧栏 Shared CLI，初始 Codex 本地配置）。
2. 打开模型选择器 → Claude Code → **切换渠道** → 选 managed（kimi-k3 / Minimax 等）。
3. 观察是否出现「续接没有完成」；侧栏会话是否仍为同一 `shared:…`。
4. 可选压力：创建后立即触发 thread list 刷新 / 快速切会话再切回 / 断网后重开会话。

### 6.2 出问题时在运行时核对

| # | 检查项 | 期望（健康 Shared） | 故障信号 |
|---|--------|---------------------|----------|
| 1 | `activeThreadId` | 以 `shared:` 开头 | 仍 shared 但行为已 native |
| 2 | `activeThreadSummary?.threadKind` | `"shared"` | `undefined` / `"native"`（→ 图 3 路径） |
| 3 | `activeThreadSummary` 本身 | 存在 | **整行缺失** → 弹「来源会话已不可用」notice 而非续接 dialog（变体 A2） |
| 4 | `isSharedSession`（layout/composer prop） | `true` | `false` |
| 5 | `getSharedTargetState(ws, id).selectedNextTarget` | 完整 ResolvedExecutionTarget | `null`（UI 回落全局） |
| 6 | 是否调用 `requestProviderContinuationDialog` | **否** | **是** |
| 7 | 是否调用 `set_shared_session_selected_engine` | 点选后 **是** | 否或被续接盖过 |
| 8 | `getThreadKind(ws, id)` | `"shared"` | `"native"`（send/delete 同步退化的信号） |

### 6.3 与「仅显示回落」变体区分

| 变体 | isSharedSession | summary | selectedNextTarget | 可观察形态 |
|------|-----------------|---------|--------------------|------------|
| A1. 身份丢失 → Native 续接 | false | 在，kind≠shared | 任意 | **续接 dialog**（图 3） |
| A2. summary 整行丢失 | false | **null** | 任意 | 「来源会话已不可用」error notice |
| B. 身份仍在但 target 被清空 | true | 在 | null | 无 dialog；外观像全局 Native |
| C. 身份仍在、persist 慢/失败/竞态 | true | 在 | 旧值或 null | 无 dialog；勾选不即时/被弹回（§4.5） |

本调研主攻 **变体 A1**（与图 3 一致）；A2/B/C 为同域变体，P0 修复对 A1/A2 同时生效。

---

## 7. 历史修复提案（已实施）

> 总原则：**id-first, kind-second**。`shared:` 前缀是身份 hard gate；`threadKind` 只是投影。所有 picker / send / delete / 续接 guard 收敛到同一 helper。
> 止血闭环 = T1+T2+T3（一个 commit）；T4/T5 分开提交，避免行为变更与策略变更混在一个 PR。

### T1（P0）— 统一身份 helper，收敛 id 判定

**不做新轮子**：复用已存在的 `isSharedSessionThreadId`（`sidebarInternals.ts:98`），上提到中立层。

| 项 | 内容 |
|----|------|
| 改动 | 1. 把 `isSharedSessionThreadId` 移到 `src/features/shared-session/utils/`（如 `sharedSessionIdentity.ts`），原位置 re-export 保兼容或直接改 callsite；2. 新增 `resolveIsSharedSession(threadId, summary)`：`isSharedSessionThreadId(threadId) \|\| summary?.threadKind === "shared"` |
| 文件 | `sidebarInternals.ts`、`shared-session/utils/`（新）、`Sidebar.tsx:790`（改 import） |
| 测试 | helper 单测矩阵：`shared:x`/`claude:x`/null/undefined × kind shared/native/undefined |

### T2（P0）— 身份计算收敛 + 全链路 id-first

| # | 位置 | 改动 |
|---|------|------|
| 2a | `useLayoutNodes.tsx:1305` + `app-shell.tsx:1184` | **收敛为单一来源**（如 composer controller 或共享 hook 计算一次往下传），并用 `resolveIsSharedSession(activeThreadId, activeThreadSummary)`；禁止第三处复制 |
| 2b | `useThreads.getThreadKind:699-704` | id-first：`shared:` → 恒 `"shared"`；否则按 summary，仍缺再默认 native。**连带修好 send 路径（resolveThreadKind 全部 callsite）与 delete 清理（useThreads.ts:2499）** |
| 2c | `Composer.tsx:939-946` `handleNativeProviderTargetChange` | 加 id 硬闸：`isSharedSessionThreadId(activeThreadId) → return`，不依赖 prop 时效 |
| 2d | `Composer.tsx:2720-2726` 分叉 | `resolveIsSharedSession(...) && !locked → handleSharedTargetChange`；禁止 `shared:` id 落到 native 续接分支；locked 时明确 no-op |
| 2e | `useSidebarMenus.ts:585-591` `prepareProviderContinuationDialog` | 闸 3 加 id：`thread.id.startsWith("shared:") → return` |

### T3（P0）— 回归测试

| 用例 | 断言 |
|------|------|
| `shared:…` + `threadKind` 缺失 | 切 Claude managed **不**调用 `requestProviderContinuationDialog` |
| 同上 | 调用 `set_shared_session_selected_engine` / hydrate selectedNextTarget |
| prepare 续接，source id `shared:…`（kind 任意） | **静默拒绝** |
| summary 整行缺失 + 续接请求 | 走「来源会话已不可用」notice，**不**弹续接 dialog |
| `getThreadKind(ws, "shared:x")`（summary 缺/kind 缺） | 恒 `"shared"` |
| send 路径：identity 丢失时 `resolveThreadKind("shared:x")` | 恒 `"shared"`（send 不走 native runtime） |
| delete：`shared:` + kind 丢失 | 仍执行 `clearSharedSessionBindingsForSharedThread` |
| locked Shared + identity 丢失 | 点选 no-op，**不**续接（覆盖 §4.7 修正） |

### T4（P1）— Shared 点选乐观更新 + hydrate 写序（解 §4.5 竞态）

1. `handleSharedTargetChange`：先 `hydrateSharedTargetState` 写 UI（乐观），再 `persistSharedSessionSelectedTarget`；失败 toast + 回滚到 persist 前值。
2. 写序规则：`sharedHistoryLoader` 的 hydrate 只在**无 in-flight persist**、或响应数据**不旧于** store 当前值时生效（可用 per-thread persist 代次计数 / last-write-wins 时间戳，取实现最简单者）。
3. 测试：in-flight persist × history reload 竞态，乐观值不被 stale hydrate 覆盖。

### T5（P2）— 列表 merge 保护（先实证，后动手）

1. **前置**：按 §4.3 三条候选（C-a runtime 归一化 / C-b merge 覆盖 / C-c list 空失败不 merge）打点或构造单测，确认 threadKind 实际丢失路径；禁止未实证直接补。
2. `shared:` id 的条目：merge 时**永不**被无 kind / 裸 `native` 行覆盖；`listSharedSessions` 失败时保留 existing shared 条目，勿仅靠 active preserve。
3. 测试：三条候选路径各自的 merge 用例。

### T6 — 文档回写

1. 本文状态改「已修复 + commit 锚点」。
2. 姊妹文 §5 残余表追加「Shared 身份 id-first」条目。
3. 若走 OpenSpec：新建 change 或在 `close-native-session-provider-create-binding` 补 residual delta。

### 7.1 commit 拆分与回滚

| commit | 内容 | 回滚 |
|--------|------|------|
| C1 | T1+T2+T3（helper 收敛 + 硬闸 + 测试） | revert 即恢复现状；对 native 续接零行为变更（硬闸只挡 `shared:` id） |
| C2 | T4（乐观更新 + 写序） | revert；回退到「成功才 hydrate」现状 |
| C3 | T5（merge 保护） | revert；不影响 T1/T2 已修好的身份判定 |

### 7.2 风险面

| 风险 | 评估 |
|------|------|
| native 续接受影响 | 低：硬闸只拦 `shared:` 前缀 id，native id（`claude:`/`codex:`）行为不变；闸 2/3 对 native 路径不动 |
| helper 上提破坏 import | 低：保留 re-export 或一次性改全 callsite（`Sidebar.tsx:790` 唯一生产调用） |
| `getThreadKind` 改 id-first 影响其他 caller | 中：caller 共 4 处（`useThreads.ts:2499/2542/3025` + messaging 代理），全部对 `shared:` id 期望 `"shared"`，方向一致；跑 `useThreads`/`useThreadMessaging` 相关测试兜底 |
| 乐观更新引入回滚闪动 | 低：仅 persist 失败时回滚一次；有 toast 解释 |

---

## 8. 影响面

| 区域 | 影响 |
|------|------|
| Shared 创建后立刻切渠道 | 高：最易撞上 list 未稳 + kind 抖动 |
| Shared 老会话重开 | 中：history hydrate null → 外观回落 |
| **Shared 发送路径** | 高：身份丢失时 send 走 native runtime（§4.2） |
| **Shared 删除** | 中：kind 丢失时绑定不清理（`useThreads.ts:2499`） |
| **StatusPanel / MessagesCore / SharedSendStatusBar** | 中：同吃 `isSharedSession` prop，源头修复后自动归位 |
| Native 会话 Atomic 双栏 | 低：续接逻辑应保持；硬闸仅挡 shared id |
| 首页 create-session picker | 低：`createSessionTargetPicker` 路径独立 |

---

## 9. 与既有文档 / OpenSpec 关系

| 文档 | 关系 |
|------|------|
| `native-session-provider-select-vs-disk-overwrite-2026-07-31.md` | **契约正本**；本调研记录 **契约被打破的路径**，不替代正本 |
| `close-native-session-provider-create-binding` | 当时 27/27 验收；本问题属 **身份判定与列表抖动下的残余/回归**，宜新 change 或原 change 补 delta |
| `conversation-canvas-structure` | 不涉及幕布树；仅 Composer 旁路径 |

建议后续：

1. 用户确认本提案 → 实施 T1→T3（C1 commit）。
2. 修完后在姊妹文 §5 残余表追加「Shared 身份 id-first」条目并改状态。
3. 本文件状态改为「已修复 + commit 锚点」。

---

## 10. 决策摘要

| 问题 | 答案 |
|------|------|
| 是不是 UI 组件写错了？ | 次要；`ModelSelect` 契约正确，**身份判定 + Composer 分叉**错 |
| 为什么叫 Shared Session 还会续接？ | 标题是 name；kind 投影丢失后三道闸全失守（§3.4） |
| 只修 picker 够吗？ | 不够；send / delete 共用 `getThreadKind` 弱信号（§4.2），必须收敛源头 |
| 最小止血？ | T1+T2+T3：id-first 身份 + `shared:` 禁续接硬闸 + send/delete 连带修复 |
| 完整修复？ | + T4 乐观更新/写序 + T5 merge 保护（先实证） |

---

## 11. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-08-02 | 初版调研：现象、调用链、根因、验证清单、修复建议；未改业务代码 |
| 2026-08-02 | 一轮 code review 回填：三道闸真实顺序（§3.4）、send/delete 爆炸半径（§4.2）、丢失路径候选未实证（§4.3）、persist×reload 竞态（§4.5）、locked 不提供保护（§4.7）、变体 A2（§6.3）；修复建议升级为完整任务卡 T1–T6（§7），helper 改为复用 `isSharedSessionThreadId`；状态 → 提案就绪，待实施 |
| 2026-08-02 | T1–T3 落地：`sharedSessionIdentity` + layout/app-shell/Composer/sidebar/getThreadKind id-first 硬闸；回归单测覆盖 projection 丢失 / prepare 拒绝 / send-delete / locked no-op；状态 → 已修复（T4/T5 仍开放） |

---

## 附录 A — 关键符号速查

```text
isSharedSession
isSharedSessionThreadId          (shared-session/utils/sharedSessionIdentity.ts；sidebarInternals re-export)
resolveIsSharedSession           (sharedSessionIdentity.ts)
selectedNextTarget / hydrateSharedTargetState / selectNextTarget
handleSharedTargetChange
handleNativeAtomicTargetChange
handleNativeProviderTargetChange
requestProviderContinuationDialog
prepareProviderContinuationDialog
persistSharedSessionSelectedTarget
set_shared_session_selected_engine
getThreadKind / resolveThreadKind
providerTargetPickerMode: "shared" | "create-session"
threadKind: "native" | "shared"
thread id prefix: shared:
```

## 附录 B — 文件清单（调研 + review 阅读）

```text
src/features/composer/components/Composer.tsx
src/features/composer/components/ChatInputBox/selectors/ModelSelect.tsx
src/features/composer/components/ChatInputBox/hooks/useProviderTargetCatalogOwners.ts
src/features/shared-session/target/targetStore.ts
src/features/shared-session/services/sharedSessions.ts
src/features/shared-session/runtime/sharedSessionSummaries.ts
src/features/threads/hooks/useThreadActions.ts
src/features/threads/hooks/useThreadActions.sessionActions.ts
src/features/threads/hooks/useThreads.ts
src/features/threads/hooks/useThreadsReducer.ts
src/features/threads/hooks/useThreadMessaging.ts
src/features/threads/hooks/useThreadMessagingThreadResolution.ts
src/features/threads/loaders/sharedHistoryLoader.ts
src/features/threads/hooks/useThreadActions.historyLoaderFactory.ts
src/features/threads/services/providerContinuationRequests.ts
src/features/app/hooks/useSidebarMenus.ts
src/features/app/components/sidebarInternals.ts
src/features/layout/hooks/useLayoutNodes.tsx
src/features/status-panel/components/StatusPanel.tsx
src/app-shell.tsx
docs/analysis/native-session-provider-select-vs-disk-overwrite-2026-07-31.md
```
