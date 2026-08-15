# Windows Cold-Start Click Freeze Pitfall（冷启动一点就假死采坑）

> 来源事故：2026-08-14 Windows 现场。安装最新版弹出「版本记录」，前几秒点叉号整窗假死；没有弹窗时，进入页面后快速点输入框「权限选择」同样假死；等约一分钟再点则正常。
> 同族前案：2026-08-05/06 `uiScale` native zoom 卡死、2026-08-10 click-freeze postmortem、2026-08-11 Composer freeze closeout。
> 本文件是 **implementation rule**：改启动编排 / 自动弹层 / ComposerGate / first-click 副作用前必读。行为事实以代码为准。

## 事故三段论（背下来）

1. **直接原因**：Windows WebView2 compositor 的 hit-test **必须等**最新 layout。冷启主线程被 first-paint / catalog / Markdown compile / Composer 升级占满时，任意 `pointerdown` 看起来都像整窗假死。Mac WKWebView 有时还能用 stale tree，所以同一点击 Windows 更像「死了」。
2. **放大原因**：生产 `StartupGateOverlay` **默认不挂**（`src/router.tsx` 只在 test flag 为真时挂）。大量注释仍假设全屏 mask 在挡第一次点击——**假设是假的**。用户前几秒点到的是真界面。更糟：第一次 `pointerdown`/`keydown` 曾被当成「可以开始 deferred 重活」的启动器。
3. **流程原因**：用固定 `setTimeout` 当「躲开 hydrate」；用 first-click 当 idle 触发器；Light 层注释写「不要走 atomic catalog」，接线却传了永远 truthy 的 wrapper。作者预见到 *freeze mid-modal*，却只提前写 `lastSeen`，**用记笔记代替治病**。

「等大约一分钟就不卡」**不是** click-unfreeze timer。它对应 full-catalog 60s freshness / cooldown settle。禁止再发明一个 60s「解冻」闹钟。

## 为什么是 P0

- 升级几乎必现（新版本自动弹 Release Notes）。
- Windows 上是**整窗假死**，不是单个按钮无响应。
- 用户无法自救：卡着进不了设置。
- 第一次点击会让情况更糟（重活绑在 first interaction 上）。
- 入口会换（叉号 / 权限 / 模型 / 侧栏），根因不变。只修用户反馈的那一个按钮，等于等下次再炸。

## 已证实模型（不要再重新发明）

冷启脆弱窗 = 主线程忙（list hydrate / restore / Composer / Markdown / CSS cascade）
+ 早期 pointer/keydown
+ WebView2 hit-test 等最新 layout

入口只是触发器，不是根因：

| 入口 | 触发器 | 同构点 |
|---|---|---|
| 版本记录叉号 / 遮罩 / Esc | 2s auto-open 落在脆弱窗；关 overlay = 拆盾 + 卸 FullMarkdown + first-click hydrate | 已证实 |
| ModeSelect 权限选择 | 点击被 ComposerGate 当成「可升 ComposerImpl」 | 已证实（08-11 同构） |
| Light 模型位 | `ChatInputBox` 把空 wrapper 当 truthy，ReadinessBar 仍开 ModelSelect + `ensureProfiles`/`ensureModels` | 已证实泄漏 |
| 任意第一次点击 | `scheduleIdleOrFirstInteraction` 灌 deferred stores / 完整 i18n / Baidu Tongji | 公共保险丝 |

**已排除**：关弹窗再调 `setZoom`；close 同步 parse 整份 CHANGELOG；Radix focus restore（版本记录是自制 overlay）；JS 同步写盘堵死主线程。

## 硬红线（Forbidden）

1. **禁止用固定 timeout 当冷启动修复。**
   把 2s 改成 10s/60s 不算修。`setTimeout` 只能当 first-paint flush 或 convergence ceiling，不能当「躲开 hydrate」的证据。
2. **禁止用第一次 `pointerdown` / `keydown` 启动重活。**
   deferred stores、完整 i18n、analytics、updater 后台 check、Markdown 591KB compile、full-catalog、ComposerImpl 首挂，都不得绑在 first interaction 上。第一次点击只许让路，不许开扫。
3. **禁止假设 `StartupGateOverlay` 在挡用户。**
   生产默认关。所有 defer 按「用户能立刻点到真界面」设计。
4. **禁止 Light Composer 走 atomic catalog / 可点 ModelSelect。**
   `onExecutionTargetChange` 不存在时，禁止传 truthy wrapper，禁止 `useAtomicProviderTargetCatalog({ enabled: true })`，ReadinessBar 必须走 `composer-readiness-model-static`。
5. **禁止 ComposerGate 在 `startup-gate-ready` 之前升 full。**
   也禁止「点过 + 静默 1.2s / 无人 2.8s」这类旧阈值。早期点击只推迟升级。
6. **禁止无 residual 仍写空 inline scale 样式。**
   `applyUiScale` 必须 verify-before-write。identity 路径不得对 html/body 无条件 `style.xxx = ""`。
7. **禁止恢复 native zoom / 可调 uiScale。**
   产品锁 100%。见 `native-webview-api-risk-gate.md`。
8. **禁止只修用户点到的那一个按钮。**
   新出现「冷启点 X 卡死」时，先对这份入口表做一次全量扫描，再改公共层。

## 必须项（Required）

1. **自动弹层**（Release Notes、UpdateToast checking UI、其它 startup modal）必须：
   `subscribeStartupGateReady`（已 stamp 则立即）→ `scheduleWhenInteractiveQuiet`（quiet 作 defer，maxWait 只作收敛上限）→ 再打开。
   侧栏 / 设置里的**手动**打开保持立即。
2. **close / dismiss** 必须 bump generation，丢弃 in-flight open，禁止关完后再 `setEntries` / 把 overlay 状态打回来。
3. **冷启说明文案**走 `liveRenderMode="lightweight"`，或等 `scheduleFullMarkdownRuntimePrewarm` 完成后再挂 `FullMarkdownRuntime`。不要让 changelog 成为第一次编译 vendor-markdown 的触发器。
4. **ComposerGate** 必须同时满足：`startup-gate-ready` + Light 最短停留 +（无输入或输入后 quiet）。阈值见 `src/features/composer/utils/composerGateUpgrade.ts`。
5. **catalog 的 pointerdown soft-cancel 可以留**（保护点击不被 `setThreads` 撞上），但不得变成「点一下就强制重扫」。强制收敛必须 `yieldToInteractiveInput`。
6. 改动必须带 **Windows WebView2** 验收；没机器测必须写明「未测」，禁止默认通过。

## 改这些文件前先重读本文

- `src/bootstrapApp.tsx`（deferred stores / i18n / analytics 调度）
- `src/features/update/hooks/useReleaseNotes.ts` / `ReleaseNotesModal.tsx`
- `src/features/update/hooks/useUpdater.ts`
- `src/features/composer/components/Composer.tsx`（ComposerGate）
- `src/features/composer/utils/composerGateUpgrade.ts`
- `src/features/composer/components/ComposerLight.tsx`
- `src/features/composer/components/ChatInputBox/ChatInputBox.tsx`
- `src/features/composer/components/ChatInputBox/ComposerReadinessBar.tsx`
- `src/utils/applyUiScale.ts`
- `src/utils/interactiveMainThread.ts`
- `src/app-shell/sections/useWorkspaceThreadListHydration.ts`（pointer soft-cancel）
- `src/router.tsx`（StartupGateOverlay 默认是否挂）

## 验收矩阵（少一项都不算修完）

Windows WebView2（系统 100% 与 125% DPI，有机器才勾）冷启动后 **立刻**（前 5 秒）连续点：

1. 版本记录叉号 / 遮罩 / Esc（若弹出）
2. 输入框权限选择 ModeSelect
3. 模型位（Light 期间必须是静态芯片，点不开 ModelSelect）
4. 输入框本身
5. 侧栏会话 / 工作区
6. 设置齿轮
7. 搜索 / Quick Switcher
8. 标题栏按钮

期望：

- 窗口保持可点，不能整窗假死。
- 设置 / 切会话可以慢，不能谁都不理。
- 自动弹窗出现在 gate-ready + 短静默之后，不是固定 2s。
- 约 8s 后切到完整 Composer 是预期；若「一变完整又假死」，另开 ComposerImpl 首挂任务，不要再抓下一个按钮。
- 不新增 `setZoom` / 可调 uiScale。
- macOS / Linux 没测必须写「未测」。

## 反例 / 正例

### Wrong

- `setTimeout(() => openReleaseNotes(), 2_000)`
- `scheduleIdleOrFirstInteraction(() => preloadDeferredClientStores())`
- `if (hadInputSinceMount && quietFor >= 1_200) setFull(true)`
- `useAtomicProviderTargetCatalog({ enabled: true })`
- 父层没传回调仍 `onExecutionTargetChange={handleProviderTargetSelect}`
- 无 residual 仍 `el.style.zoom = ""`

### Correct

- `subscribeStartupGateReady` 后再 `scheduleWhenInteractiveQuiet(openReleaseNotes, { quietMs, minDelayMs, maxWaitMs })`
- `scheduleAfterStartupGateReady(() => preloadDeferredClientStores())`
- `shouldUpgradeComposerFromLight({ ..., startupGateReady: getStartupGateReadyReason() != null })`
- `useAtomicProviderTargetCatalog({ enabled: Boolean(onExecutionTargetChange) })`
- `onExecutionTargetChange={onExecutionTargetChange ? handleProviderTargetSelect : undefined}`
- `if (el.style.zoom) el.style.zoom = ""`

## 相关事实源

| 内容 | 路径 |
|---|---|
| 本采坑（执行规范） | 本文件 |
| 2026-08-14 事故分析 | `docs/analysis/windows-cold-start-click-freeze-release-notes-and-composer-2026-08-14.md` |
| 08-10 click-freeze postmortem | `docs/analysis/cold-start-click-freeze-postmortem-2026-08-10.md` |
| 08-11 Composer freeze closeout | `docs/analysis/cold-start-composer-freeze-closeout-2026-08-11.md` |
| Native zoom 门禁 | `dev-guidelines/guides/native-webview-api-risk-gate.md` |
| 错误登记 | `.learnings/ERRORS.md` ERR-20260814-001 ~ 004 |
