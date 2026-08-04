---
type: guide
status: active
---

<!-- DOC-LIFECYCLE: active-troubleshooting -->
> [!NOTE]
> **Lifecycle: Active troubleshooting runbook.** Historical case log 必须区分 fixed-in-code、manually verified 与 unverified；记录中的待提交/待验证占位不构成 current backlog。

# React #185 Maximum Update Depth Playbook

> **文档性质**：可追加 living playbook（依据文档），不是一次性事故报告。
> **用途**：冷启动 / 渲染过程中再次出现 React `#185`（`Maximum update depth exceeded`）时，按本文件诊断、归类、修复与归档。
> **事实边界**：行为以当前代码 + OpenSpec main specs 为准；本文件记录诊断协议与历史 case，不自动证明 `HEAD` 已全部收敛。

---

## 1. 错误是什么

| 字段 | 含义 |
|------|------|
| Production message | `Minified React error #185` |
| 完整语义 | `Maximum update depth exceeded` |
| 触发条件 | 同一更新链内嵌套 `setState` 超过 React 限制（常见 ~50 次） |
| 用户表现 | 全局 `ErrorBoundary` 替换 AppShell；`errorClass: react-maximum-update-depth` |
| 报告入口 | `src/components/errorBoundaryReport.ts` / `ErrorBoundary.tsx` |

解码：

- 完整说明：<https://react.dev/errors/185>
- 本仓库报告分类：`classifyErrorBoundaryError` → `react-maximum-update-depth`

---

## 2. 诊断协议（以后必走）

### 2.1 收集证据（content-safe）

1. ErrorBoundary 完整报告（含 `generatedAt` / `appVersion` / componentStack / stack）
2. 是否冷启动 / 切换 workspace / 流式结算 / 打开 Settings
3. reload 是否恢复
4. 若有 production bundle 哈希（如 `App-BhVHLEiP.js`），与本地 `dist/assets` 对齐
5. **禁止**把 prompt / message / 文件内容写入 case 记录

### 2.2 反查 minified stack

1. 用 `function XXX(` 在对应 chunk 中定位 mangled 组件名
2. 用栈帧 `file:line:col` 截取附近代码，优先找 `useLayoutEffect` / `useEffect` + `setState`
3. componentStack 最内层通常是真正在循环写 state 的组件；外层多为 AppShell / router

### 2.3 复现门禁

优先写 **可执行 regression**（Vitest + jsdom / StrictMode），而不是只靠手动冷启动：

- 语义等价 state 反复 commit 不得出现 `#185`
- 真实 observable 变化仍须发布
- 有界 tick 后 state 收敛

### 2.4 修复优先级（强制）

| 优先级 | 做法 | 何时用 |
|--------|------|--------|
| **P0 根因** | 合并双写、统一纯函数语义、幂等 commit | 默认 |
| P1 结构 | 派生值改 `useMemo`，不落 React state | derived projection |
| ❌ 禁止 | 提高 React update limit、ErrorBoundary 吞错自动 reload 当修 | 掩盖根因 |
| ❌ 禁止 | 清理用户 local store 当“修复” | 不可复现、不可回归 |

---

## 3. 反模式目录（追加时只加条目，不改编号语义）

| ID | 反模式 | 典型症状 | 正确收敛 |
|----|--------|----------|----------|
| AP-01 | **双 effect 对打** | A 写 `null`，B 写 `default`，layout/effect 互踩 | 单源 pure plan + 单一 apply |
| AP-02 | **语义不等价却每次 setState** | 值相同仍 `setState(newRef)` | functional update：`prev === next ? prev : next` |
| AP-03 | **derived 存 state 并订阅上游引用** | 上游等价换引用 → effect 刷新 → 父 rerender | state 只存 source；projection `useMemo` |
| AP-04 | **repair effect 订阅自身写入结果** | reload 写 cache，cache 再触发 reload | 读 ref / 外部 store，写走 equality gate |
| AP-05 | **async refresh 把 selection 放进 deps** | selection 变 → refresh 重建 → 再写 selection | snapshot ref 读最新值 |
| AP-06 | **第三方 ref / presence 版本抖动** | Radix ScrollArea / Tooltip 在 React 19 下 ref loop | 稳定 ref identity 或换实现 |
| AP-07 | **useSyncExternalStore + 不稳定 selector / 非稳定 getSnapshot** | 内联 selector 进 useMemo deps，或 getSnapshot 每次 new 对象 | selector/isEqual 经 ref；getSnapshot 语义相等回缓存引用；对象切片强制 shallowEqual |

---

## 4. 修复设计原则（写代码前勾选）

- [ ] **Single planner**：model/effort（或其它成对 state）用纯函数一次算出
- [ ] **Single applier**：layout 与 async 路径共用同一 apply
- [ ] **Idempotent commit**：normalize 后相等不写
- [ ] **No competing backfill**：禁止“主收敛 + 旁路补洞”两套语义
- [ ] **Stable business locks**：用户显式选择不被 preferred 漂移覆盖（除非产品明确要求）
- [ ] **Regression first**：先红后绿，或至少与修复同 PR 落地可执行测试
- [ ] **Scope**：不顺手大重构无关 AppShell；diff 可审查

---

## 5. Case Log（只追加，不改写旧 case 结论）

> 新 case 模板见 §6。编号 `C-YYYYMMDD-NN`。

### C-20260801-01 — useModels effort 双写死循环（冷启动）

| 字段 | 内容 |
|------|------|
| **状态** | fixed（结构加固） |
| **Fix commit** | `4c5e97c8e` — `fix(models): 结构性修复冷启动 React #185 effort 双写死循环` |
| **现象** | 冷启动全局 Application Error；`errorClass: react-maximum-update-depth`；`appVersion` 可能为 `unknown` |
| **Bundle / 栈** | `App-BhVHLEiP.js`；componentStack `GWt`=AppShell；栈帧落在 `useModels` 的 selection `useLayoutEffect` |
| **Owner** | `src/features/models/hooks/useModels.ts` |
| **触发条件** | `supportedReasoningEfforts === []` 且 `defaultReasoningEffort` 非空，且 `preferredEffort === null`（例如 settings `lastComposerReasoningEffort: null`；`lastComposerModelId` 可为跨引擎残留如 `k3`） |
| **根因（AP-01）** | ① selection `useLayoutEffect` 经 `resolveEffort` 在 empty-supported 时只回 `preferredEffort`（常为 `null`）并写入；② 独立 backfill `useEffect` 在 effort 为空时写 `model.defaultReasoningEffort` → 对打至 #185 |
| **止血** | empty-supported 时 `preferred ?? modelDefault`（语义对齐） |
| **结构加固** | 见下表 |
| **回归** | `src/features/models/hooks/useModels.test.tsx`（#185 场景 + pure plan 稳定性 + 用户锁定 effort） |
| **关联历史** | 仓库曾多次修冷启动 #185（Tooltip / ScrollArea / Quick Switcher / Agent selection / Composer cache）；**本 case 是独立 owner，不是 Quick Switcher 复发** |
| **索引** | [`docs/analysis/README.md`](./README.md) |

**结构加固要点（C-20260801-01）**

| 机制 | 实现 |
|------|------|
| Pure effort 解析 | `resolveModelEffort()` — 唯一 effort 语义 |
| Pure selection 规划 | `planComposerModelSelection()` — layout / refresh 共用 |
| 幂等 commit | `commitSelectedModelId` / `commitSelectedEffort` |
| 单同步收敛入口 | 一个 `useLayoutEffect` apply plan |
| 删除互踩 writer | 移除 effort backfill effect、空白串 normalize effect（normalize 并入 commit） |
| Async 解耦 | `selectionSnapshotRef`，`refreshModels` 不再订阅 selection state deps |
| 业务锁 | 用户显式 effort 或「用户锁 model 且已有 effort」时 preferCurrent，避免 preferred 漂移 |

**Code review 摘要（C-20260801-01 加固后）**

| 项 | 结论 |
|----|------|
| 根因是否切断 | 是：双 writer 合并为 plan→apply；empty-supported 与 default 同语义 |
| 业务是否易漂 | 中低风险：刻意保留用户锁 model/effort 行为；需靠测试钉死 |
| 残余风险 R1 | ~~layout 仍把 selected* 列入 deps~~ → **已关闭（B1）**：selection 经 `selectionSnapshotRef` 读取 |
| 残余风险 R2 | runtime-only 模型若 empty supported 且 **无** default，effort 仍可为 null（正确）；UI 需能接受 |
| 残余风险 R3 | `mergeCodexSelectableModels` 对 catalog 外模型不会 hydrate STANDARD efforts；与 #185 无关，但是 effort 元数据质量债 |
| 建议后续 | 见 §7 backlog；新 #185 勿直接改 limit，先按 §2 归因 |

### C-20260801-02 — freeform 会话选择 + layout self-deps / 测量翻转加固

| 字段 | 内容 |
|------|------|
| **状态** | fixed（结构加固） |
| **现象** | 多份 `#185` 报告：dev 栈 `useModels` / AppShell；prod `App-ey-y8N2U` 下 Composer 与 Messages 树 |
| **Bundle / 栈** | `App-ey-y8N2U.js`；dev `useModels.ts` layout；Messages 侧 collapsible / scroll 树 |
| **Owner** | `useModels.ts`；`useSelectedComposerSession.ts`；`useAppShellComposerModelSection.ts`；`CollapsibleUserTextBlock.tsx` |
| **触发条件** | 冷启动 / 会话选择修复 / 用户气泡折叠测量；catalog 外 freeform modelId 与 invalid effort 并存 |
| **根因** | ① layout 将 `selected*` 列入 deps 形成 commit 自反馈（R1）；② reload/select 路径偶发无 equality 的 setState；③ freeform 业务保留 catalog 外 model 后，旧「整选择回退 catalog」测试与语义冲突；④ Collapsible 用外层 scrollHeight 测量可能与 maxHeight class 互踩 |
| **修复** | B1：layout 仅依赖 catalog/preferred，selection 读 snapshot ref；会话 selection 全路径幂等 commit；thread repair 只写 effective 投影且 freeform **不静默丢 model**；Collapsible 测内层内容高度 + boolean equality |
| **回归** | `useModels.test.tsx`；`app-shell.startup.test.tsx`（freeform + effort 修复且无 #185）；`useSelectedComposerSession.test.tsx`；`modelSelection.test.ts` |
| **业务不变量** | Atomic picker / 自定义模型名 freeform **不得**被 repair 静默回退到 catalog default |

### C-20260801-03 — Composer 栈残余：file-ref / merge 引用环 + plan 收敛卫生

| 字段 | 内容 |
|------|------|
| **状态** | fixed（结构加固；**非** production 栈 1:1 红绿复现结案） |
| **现象** | prod `errorClass: react-maximum-update-depth`；`appVersion: unknown`；全局 ErrorBoundary |
| **Bundle / 栈** | `App-Bn4fZysL.js`；componentStack `s4t`=Composer、`c4t`=ActiveCanvasComposer、`u$t`/`_Wt`=AppShell 布局 |
| **Owner** | **主：`mergeInlineFileReferences` / `mergeUniqueNames` + Composer file-ref effect**；辅：`planComposerModelSelection` null 收敛、creation engine publish 门闩 |
| **触发条件** | 主会话画布 Composer 热路径；内联文件 token settle 后父树高频 rerender，或 extract 仍吐出已选 id 时 effect 换数组引用自反馈 |
| **根因（AP-02 主 / 加固辅）** | **主因（可测）**：file-ref effect deps 含 `selectedInlineFileReferences`，旧逻辑无新增仍 `return [...prev]` / `mergeUniqueNames` 换引用 → effect 再入。**辅（defense-in-depth）**：已收敛 plan 仍返回对象（commit 本已幂等，单独通常不致 #185）；Home creation engine 等价回写 |
| **修复** | 抽出 `mergeInlineFileReferences` 无新增保引用；`mergeUniqueNames` 同；plan 已收敛 → `null`；creation engine ref 门闩；status panel expand 函数式等价值（收益低） |
| **回归** | `composerFileReferences.test.ts`（含 30 次 extract→merge 同引用）；`inlineSelections.test.ts`；`Composer.file-reference-token.test.tsx`（token settle + 20 次 rerender 无 #185；engine 不重复 publish）；`useModels.test.tsx`（plan 二次 null） |
| **关联历史** | C-20260801-01/02 之后仍在含修复的 `App-Bn4fZysL` 上复现 → Composer 侧 AP-02 残余，**不是** effort 双写回退 |
| **Review 要点** | 勿把 plan null 说成已证实的唯一根因；production 栈仍缺 1:1 复现 fixture，靠 AP-02 路径回归 + 手测 |

### C-20260802-02 — useModels freeform 清选 + catalog 引用抖动叠环

| 字段 | 内容 |
|------|------|
| **状态** | fixed（结构加固） |
| **现象** | `errorClass: react-maximum-update-depth`；componentStack `AppShell`；dev 栈帧落在 `useModels.ts` |
| **Bundle / 栈** | dev `localhost:1420`；`useModels` layout/apply 链 |
| **Owner** | `src/features/models/hooks/useModels.ts`；辅 `usePersistComposerSettings.ts` |
| **触发条件** | catalog 外 freeform / id-vs-model 双通道；preferred 与 selection 经 persist 回写；`mergeCodexSelectableModels` 换数组引用触发 layout |
| **根因（AP-01/AP-02）** | ① 非 catalog selected 被 plan 一律 `clearUserSelectedModel`，与 freeform 业务不变量冲突并可与 preferred 回写互踩；② 收敛判断仅 `=== selectedModelId`，id/model 字段语义相等仍反复 commit；③ catalog merge 无结构指纹导致 layout deps 虚抖 |
| **修复** | freeform 用户锁保留 synthetic model；双通道 selectedMatchesNext；`modelOptionsFingerprint` 稳 models/rawModels；`lastAppliedSelectionKeyRef` 幂等 apply；persist null/"" 归一 |
| **回归** | `useModels.test.tsx`：freeform 不回退、preferred thrash、id/model 双通道、max-depth 冒烟 |
| **Review 要点** | 与 C-20260801-01/02 同 owner；本 case 补 freeform + 引用稳定，不恢复 effort 双 writer |

### C-20260802-01 — CollapsibleReveal useLayoutEffect 无条件 setState 同步闭环

| 字段 | 内容 |
|------|------|
| **状态** | fixed |
| **Fix commit** | 待提交 |
| **现象** | Settings 页 Session Curtain 打开时全局 ErrorBoundary；`errorClass: react-maximum-update-depth`；两次报告间隔约 30s |
| **Bundle / 栈** | componentStack `PHt`=ConversationRowErrorBoundary → `FHt`=ErrorBoundary；栈帧落在 CollapsibleReveal → ConversationRow → TimelineRowRenderer |
| **Owner** | `src/components/common/CollapsibleReveal.tsx` |
| **触发条件** | Settings 页 `onSessionsMutated` → `threadsByWorkspace` 更新 → Conversation View 重渲染 → CollapsibleReveal `useLayoutEffect` 无条件 `setState` → 与父组件渲染循环形成 `parent render → layout effect → child state → parent render` 同步闭环 |
| **根因（AP-02）** | `CollapsibleReveal` 的 `useLayoutEffect` 在 deps 未变时仍无条件调用 `setShouldRender(true)` / `setIsOpen(true/false)` / `setPlayEnter()`。`useLayoutEffect` 是同步 flush，state 更新在同一 commit 内完成，与上层组件的渲染循环形成闭环后迅速达到 React 上限 |
| **修复** | 添加 `prevOpenRef` / `prevKeepMountedRef` 守卫，只在值真正变化时调用 setState；`setPlayEnter` 改用 functional update `prev === next ? prev : next` 保证引用稳定性 |
| **回归** | `CollapsibleReveal.test.tsx` 4 个测试通过；未新增 regression（修复前已有 1 个无关测试失败在 `Messages.explore.test.tsx`） |
| **防御模式** | 与 C-20260801-03 Composer 修复完全同构：`prevRef` 守卫跳过等价 state update + functional update 保持引用稳定 |
| **Review 要点** | 本次修复与 `637cb3561`（Composer #185）采用相同防御模式；应警惕任何在 `useLayoutEffect` 中无条件 setState 的组件 |

### C-20260803-01 — 冷启 useModels layout apply 环（App-BCnXFvD4）

| 字段 | 内容 |
|------|------|
| **状态** | fixed（结构加固；待用户手测冷启） |
| **现象** | 冷启全局 Application Error；reload 恢复；`errorClass: react-maximum-update-depth`；`appVersion: unknown` |
| **Bundle / 栈** | `App-BCnXFvD4.js`；componentStack `dWt`=AppShell；栈帧落在 `useModels` `applySelectionPlan` + selection `useLayoutEffect` |
| **Owner** | `src/features/models/hooks/useModels.ts` |
| **触发条件** | 冷启；settings/preferred 与 catalog 收敛窗；父层 `onDebug` 回调 identity 不稳定时可放大 |
| **根因（AP-04 / layout deps）** | ① `refreshModels` / `applySelectionPlan` 曾把不稳定 `onDebug` 放进 callback deps → layout 每帧重跑；② model+effort 双 setState + 同 tick refresh/layout 双 apply；③ preferred `""`/null 虚抖；④ 缺 epoch 熔断时 plan 非 null 叠满 #185 |
| **修复** | `onDebugRef` 解耦；原子 selection state；乐观 snapshot；preferred 归一；config/catalogReady 幂等 set；epoch 熔断（12）；plan 已对齐即 null |
| **回归** | `useModels.test.tsx`：unstable onDebug 冷启、blank preferred thrash、plan null；`app-shell.startup.test.tsx` 既有 #185 场景 |
| **关联** | 同日 `a4166c03e` 拆除 Claude residual repair；本 case 是 useModels 侧残余腿 |
| **Review 要点** | 禁止把父层非稳定回调放进 layout 链 deps；冷启手测：脏 `lastComposerModelId` + 无 active thread |

### C-20260804-01 — 持续性 #185：canvas store / selection storm / session reload 残余

| 字段 | 内容 |
|------|------|
| **状态** | fixed（结构加固 + 对抗式 review 二次收口；待用户手测冷启 / 切换 workspace） |
| **现象** | 生产全局 ErrorBoundary；`errorClass: react-maximum-update-depth`；`appVersion: unknown`；**持续性复发**（非单次冷启） |
| **Bundle / 栈** | `App-hx3PTjEz.js`；componentStack 浅树：`k8t`→`I8t`→`section`→`OBt`→…→`bootstrapApp-CR90pqFG`；栈帧落在 App chunk layout/setState 链（无 1:1 sourcemap；按协议按 AP 模式收敛） |
| **Owner** | 主：`activeCanvasStore.ts` / `useActiveCanvasSelector`；辅：`useModels.ts` storm 熔断、`useSelectedComposerSession.ts`、`GlobalRuntimeNoticeDock.tsx`；报告：`errorBoundaryReport.ts` |
| **触发条件** | 冷启或运行中父树高频 rerender；canvas snapshot 壳引用抖动；inline selector identity 不稳；preferred/persist 对打重置 epoch；session reload 依赖非稳定 `resolveEngineDefault` |
| **根因（AP-02 / AP-04 / AP-05 / AP-07）** | ① `useActiveCanvasSelector` 把 `selector`/`isEqual` 放进 `useMemo` deps → 内联 selector 每帧重建 getSnapshot（AP-07）；② `setSnapshot` 仅 `Object.is` 整对象，layout 每帧新壳即 notify；③ useModels epoch 熔断在 preferred 对打时被重置；④ session reload 订阅非稳定 engineDefault；⑤ 报告未读 `__APP_VERSION__` |
| **修复** | 见下「对抗式 review 结论」 |
| **回归** | `activeCanvasStore.test.tsx`：壳抖动不 notify；unstable selector 30× rerender 无环；object slice + heartbeat 抖动保持 selected 引用；既有 useModels / app-shell.startup |
| **关联历史** | C-20260801-01…03、C-20260802-01/02、C-20260803-01 之后仍复发 → 本 case 补 store/selector/storm 层 |
| **Review 要点** | 见下 |

**对抗式 review 结论（C-20260804-01，二次收口）**

| 检视项 | 结论 |
|--------|------|
| 是否掩盖根因 | 否：主修是 getSnapshot 引用稳定 + setSnapshot 壳门闩（P0）；storm 熔断是防御网，不替代 plan null 收敛 |
| useActiveCanvasSelector 形态 | **二次修正**：禁止 render 期写 ref；改为 getSnapshot 内 cache（对齐 `use-sync-external-store/with-selector` 语义）——同 store 指针直接回缓存；跨 snapshot 时 isEqual 命中则保留 selected 引用 |
| setSnapshot shallow | 顶层字段 Object.is；仅换壳不 notify。**刻意**：heartbeat 等字段变化仍 notify，由 selector isEqual 决定是否重渲染 |
| storm 熔断副作用 | 1s 内 >24 次 apply 后停止写入，selection 可能短暂停在中间态；优于 #185 白屏；debug label `model selection apply circuit breaker` |
| 生产栈 1:1 | 仍缺 `App-hx3PTjEz` sourcemap；靠 AP-07 可测路径 + 历史 owner 矩阵收敛，**不**声称栈帧符号 1:1 还原 |
| 残余风险 | 对象切片若漏传 shallowEqual 仍可能环（调用约定）；storm 熔断后需用户重选 model 的概率极低 |
| 不变量 | freeform catalog 外 modelId 不静默回退；Messages 不因 heartbeat  alone 整树重渲 |

**代码入口（C-20260804-01）**

| 路径 | 角色 |
|------|------|
| `src/features/layout/hooks/activeCanvasStore.ts` | setSnapshot shallow + selector getSnapshot cache |
| `src/features/layout/hooks/activeCanvasStore.test.tsx` | 壳 / selector / slice 引用回归 |
| `src/features/models/hooks/useModels.ts` | 跨 epoch storm 熔断 |
| `src/app-shell-parts/useSelectedComposerSession.ts` | engineDefault ref |
| `src/features/notifications/components/GlobalRuntimeNoticeDock.tsx` | placement 幂等 |
| `src/components/errorBoundaryReport.ts` | `__APP_VERSION__` |
| 本文 §5 C-20260804-01 | 诊断与 review 留痕 |

---

## 6. 新 Case 追加模板

复制到 §5 末尾：

```markdown
### C-YYYYMMDD-NN — <一句话标题>

| 字段 | 内容 |
|------|------|
| **状态** | open / fixed / wontfix |
| **现象** | |
| **Bundle / 栈** | |
| **Owner** | path + 符号 |
| **触发条件** | |
| **根因（AP-xx）** | |
| **修复** | 止血 / 结构（分列） |
| **回归** | 测试路径 |
| **Review 要点** | 残余风险 / 不变量 |
```

---

## 7. 后续加固 Backlog（可勾选推进）

- [x] **B1** layout 收敛仅依赖 catalog/preferred；selection 经 ref 读取（C-20260801-02）
- [x] **B2** thread repair / freeform：只收敛 effective 投影；catalog 外 modelId 保留（C-20260801-02）
- [ ] **B3** runtime 空 reasoning metadata 的 hydrate 策略产品化（catalog 内 merge vs catalog 外 STANDARD fallback）
- [x] **B4** ErrorBoundary 报告稳定注入 `appVersion`（`getAppVersionForReport` 读 `__APP_VERSION__`；C-20260804-01）
- [ ] **B5** 将本 playbook 链接到 `openspec/specs/client-renderer-stability-under-pressure` 的诊断入口（仅文档指针，不扩 scope）
- [x] **B6** 冷启动 fixture：freeform + invalid effort（`app-shell.startup.test.tsx`）
- [x] **B7** activeCanvasStore shallow setSnapshot + selector ref 化（C-20260804-01）
- [x] **B8** useModels 跨 epoch storm 熔断（C-20260804-01）
---

## 8. 历史相关入口（索引，非完整列表）

OpenSpec / 代码中已出现的 #185 类修复（便于对照，**不等于本 playbook 已覆盖**）：

- Tooltip startup：`tooltip-icon-button-startup-stability`
- Sidebar ScrollArea React19：`sidebar-scroll-area-react19-stability`
- Quick Switcher / cold-start collection：`fix-cold-start-update-depth-loop`、`fix-messages-core-update-depth-loop`
- Agent catalog：`agent-startup-selection-stability`
- Composer selection：`codex-composer-startup-selection-stability`
- 分类与报告：`src/components/errorBoundaryReport.ts`
- useModels：`src/features/models/hooks/useModels.ts` + `useModels.test.tsx`
- canvas store / selector：`src/features/layout/hooks/activeCanvasStore.ts` + `activeCanvasStore.test.tsx`（C-20260804-01 / AP-07）
- session reload：`src/app-shell-parts/useSelectedComposerSession.ts`
- NoticeDock placement：`src/features/notifications/components/GlobalRuntimeNoticeDock.tsx`

### 8.1 开发自检（改 selection / canvas / layout setState 时勾选）

- [ ] 任何 `useLayoutEffect` 内 setState：值未变是否跳过（functional update 或 prevRef）？
- [ ] `useSyncExternalStore` 的 getSnapshot 在 store 未变时是否 **引用稳定**？
- [ ] 对象切片 selector 是否传了 `shallowEqual`（或自定义 isEqual）？
- [ ] 非稳定父回调是否只经 ref 读取、未进 layout/reload deps？
- [ ] 成对 state（model/effort 等）是否 single plan + single apply + 幂等 commit？
- [ ] 是否补了可执行 regression（Vitest），而不是只靠冷启手测？

---

## 9. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-08-01 | 初版：协议 + AP 目录 + C-20260801-01（useModels）+ backlog |
| 2026-08-01 | 校准：C-20260801-01 补 fix commit `4c5e97c8e`；挂 analysis 索引 |
| 2026-08-01 | C-20260801-02：B1 layout self-deps 关闭；freeform repair 语义钉死；Collapsible 测量加固 |
| 2026-08-02 | C-20260801-03：`App-Bn4fZysL` Composer 栈残余——plan null 收敛 + Composer 引用稳定 setState |
| 2026-08-02 | C-20260802-01：CollapsibleReveal `useLayoutEffect` 无条件 setState——prevRef 守卫 + functional update 引用稳定 |
| 2026-08-03 | C-20260803-01：`App-BCnXFvD4` 冷启 useModels layout apply——onDebugRef、原子 selection、epoch 熔断 |
| 2026-08-04 | C-20260804-01：`App-hx3PTjEz` 持续性 #185——canvas store/selector、storm、session reload、appVersion |
| 2026-08-04 | 对抗式 review 二次收口：AP-07；getSnapshot 内 cache（禁 render 期写 ref）；§8.1 自检清单 |
