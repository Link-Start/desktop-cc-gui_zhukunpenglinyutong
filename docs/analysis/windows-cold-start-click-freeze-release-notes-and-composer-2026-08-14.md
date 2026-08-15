---
type: analysis
status: active
---

# Windows 冷启动点击假死（版本记录 + 权限选择 + first-click）2026-08-14

> 执行规范（禁令 / 验收）以
> `dev-guidelines/guides/windows-cold-start-click-freeze-pitfall.md` 为准。
> 本文只记录因果、证据和「为什么会再次做成 P0」。

## 现场

Windows 用户安装最新版后：

1. 自动弹出「版本记录 / Release Notes」。前几秒点叉号 / 遮罩 / Esc，整窗假死。
2. 等大约一分钟再关，不卡。
3. **没有**这个弹窗时，进入页面后快速点输入框「权限选择」（ModeSelect），同样假死。

这不是两个无关 bug。入口不同，冷启脆弱窗相同。

## 根因模型

已证实（与 08-10 / 08-11 同构，不是新的 native zoom 事故）：

```
冷启脆弱窗
  = 主线程忙（first-paint list / restore / Composer / Markdown / CSS cascade）
  + 早期 pointer/keydown
  + WebView2 hit-test 必须等最新 layout
```

「等大约一分钟就不卡」对应 `FULL_CATALOG_FRESH_TTL_MS` / `FULL_CATALOG_AUTO_RETRY_COOLDOWN_MS` = 60s settle，**不是** click-unfreeze timer。

生产 `StartupGateOverlay` 默认不挂。用户前几秒点到的是真界面。

## 触发器（入口表）

| 入口 | 当时的错误接线 | 状态 |
|---|---|---|
| 版本记录 2s auto-open + 立刻关 | 固定 timeout 落在 first-paint / Composer 窗；关 overlay = 拆盾 + 卸双份 FullMarkdown + first-click hydrate；close 不取消 in-flight open | 已修 |
| ModeSelect | ComposerGate 把「点过 + 1.2s quiet / 无人 2.8s」当成可挂 ComposerImpl | 已修 |
| Light 模型位 | ChatInputBox 传永远 truthy 的 `handleProviderTargetSelect`，ReadinessBar 仍开 ModelSelect + atomic catalog | 已修 |
| 任意第一次点击 | `scheduleIdleOrFirstInteraction` 灌 deferred stores / 完整 i18n / Baidu Tongji | 已修 |
| applyUiScale identity 路径 | 无 residual 仍写 10 个空 inline，Blink 再 cascade | 已修 |
| updater mount 即 check | 冷启并行 checking toast + IPC | 已修 |

## 为什么会做成 P0

1. 升级几乎必现。
2. Windows 整窗假死，用户无法自救。
3. 第一次点击会让情况更糟。
4. 前人只把 `releaseNotesLastSeenVersion` 提前写了（CHANGELOG「freeze mid-modal」），治复发弹窗、不治假死。
5. 只修用户点到的那一个按钮，下一个入口继续炸。

## 已排除

- 关弹窗再调 `setZoom` / native zoom（产品已锁 100%）。
- close 同步 parse 整份 CHANGELOG（runtime 走 generated JSON）。
- Radix focus restore（版本记录是自制 overlay）。
- JS 同步写盘堵死主线程（lastSeen 是 debounce patch）。

## 修复落点

- `src/features/update/hooks/useReleaseNotes.ts` — gate-ready + quiet auto-open；close bump generation
- `src/features/update/components/ReleaseNotesModal.tsx` — lightweight Markdown
- `src/styles/release-notes.css` — 去掉 backdrop-filter
- `src/features/composer/utils/composerGateUpgrade.ts` — Light 最短停留 + 必须 gate-ready
- `src/bootstrapApp.tsx` — `scheduleAfterStartupGateReady`，first-click 不再开扫
- `src/utils/applyUiScale.ts` — verify-before-write
- `src/features/update/hooks/useUpdater.ts` — auto-check 等 gate-ready
- `src/features/composer/components/ChatInputBox/ChatInputBox.tsx` — Light 不启用 atomic catalog / 不泄漏 ModelSelect

## 证据分级

- **已证实（代码 + 历史文档）**：脆弱窗模型；overlay 默认关；2s auto-open；ComposerGate 旧阈值；first-click 调度；模型位泄漏。
- **已证实（本仓历史）**：WebView2 hit-test 等 layout；冷启挂 ComposerImpl 假死。
- **未验证**：Windows 真机「新包前 5 秒连点入口表」——发版前必须补。

## 相关

- 执行规范：`dev-guidelines/guides/windows-cold-start-click-freeze-pitfall.md`
- 08-10 postmortem：`docs/analysis/cold-start-click-freeze-postmortem-2026-08-10.md`
- 08-11 Composer closeout：`docs/analysis/cold-start-composer-freeze-closeout-2026-08-11.md`
- 错误登记：`.learnings/ERRORS.md` ERR-20260814-001 ~ 004
