# remove-dictation-feature

## Why

Dictation（听写）功能已进入半废弃状态，继续留在代码库只剩成本：

- **Composer UI 早已死亡**：`Composer.tsx:651-663` 将 `dictationEnabled/dictationState/dictationLevel/onToggleDictation/...` 全部 `_` 前缀闲置，`DictationWaveform` 无 import 者，`.composer-dictation-*` CSS 无 JSX 使用；唯一活逻辑仅剩 transcript 插入 effect（`Composer.tsx:2826-2862`）。
- **设置页无入口**：sidebar 已无 dictation 导航，`DictationSection` 仅能被无人调用的 `openSettings("dictation")` 触达，事实死 UI。
- **性能负债**：`src/features/dictation/hooks/useDictation.ts:26,46` 在音频 level 事件里 `setLevel`，经 `useDictationController` 挂在 AppShell 根 composition（`useAppShellRootComposition.ts:131-142`），录音期高频 setState 直达根，命中 `AGENTS.md` 渲染红线①形态。
- **结构负债**：独占一个 app-shell domain（`dictationSurfaceContext`，11 keys）+ `useDictationController` + 8 个 Tauri 命令 + `whisper-rs`/`cpal`/`objc2-av-foundation` 三个重 C 依赖（显著二进制体积与构建时间）。

用户已拍板：功能整体移除，不保留入口。

## What Changes

- **前端全链移除**：Composer transcript effect 与 props 通道、layoutNodes 透传、settings UI（`DictationSection` 等）、根装配 12 keys、`dictationSurfaceContext` 整域（OWNED_KEYS / builder / assembly / ownership gate / runtime-contract 白名单同步出账）、services/types/i18n/CSS。
- **Rust 后端移除**：`src-tauri/src/dictation/` 模块、8 个命令、state 字段、4 个 settings 字段、Entitlements/Info.plist 麦克风声明、`Cargo.toml` 三依赖（`cpal` / `whisper-rs` / `objc2-av-foundation`；`sha2` 共用保留）。
- **spec 同步**：`client-startup-orchestration` 中 dictation model status 的两处条款移除。

## 目标与边界

- **目标**：代码库零 dictation 残留；根 composition 少 12 keys + 1 个高频 setState 源；`check:app-shell:governance` 全绿。
- **边界**：只做删除与门禁链校准，不做任何替代输入方案；不动 composer 其他功能。

## 非目标

- **不清理存量数据**：老用户磁盘上的 whisper 模型文件（`app_data_dir()/models/ggml-*.bin`，75MB–3GB）保留不动，不加一次性清理逻辑（用户明确决策）。
- **不做 settings migration**：旧 settings.json 残留的 `dictationEnabled/dictationModelId/dictationPreferredLanguage/dictationHoldKey` 4 个 key 由 serde/TS 宽容反序列化静默忽略（两侧均未 `deny_unknown_fields`，PR 内实测验证）。
- 不动 `formatDownloadSize`（被 EmbedModelSection 共用）。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `client-startup-orchestration`：移除 dictation model status 在 first-paint 条款与 opportunistic prewarm 清单中的两处引用（功能本身被移除）。

## Impact

| 层 | 影响面 |
|----|--------|
| app-shell | `useAppShellRootComposition.ts`、`appShellDomainContexts.ts`（dictationSurface 整域）、`buildAppShellDomainContextSlices.ts`、`useAppShellDomainAssembly.ts`、`appShellDomainOwnershipGate.ts`、`renderAppShell.tsx`、`useAppShellLayoutNodesSection.tsx`、相关测试与门禁脚本 |
| features | `features/dictation/`（整目录）、`features/app/hooks/useDictationController.ts`、composer / settings / layout 透传 |
| services/types | `services/tauri/dictation.ts`、`services/events.ts` 两个 hub、`types/misc.ts`、`types/settings.ts` |
| i18n | 10 locale `settings.ts` ~37 条/locale、`runtimeNotice.ts`、`en/lockScreen.ts` |
| Backend | `src-tauri/src/dictation/`、`command_registry.rs`、`state.rs`、`types.rs`、`diagnostics_bundle.rs`、`Cargo.toml`、Entitlements/Info.plist |
| Specs | `client-startup-orchestration` delta |
| Docs | `docs/plans/app-shell-ownership-matrix.md`（domain 计数刷新）、`docs/plans/2026-08-11-app-shell-cohesion-optimization.md`（Log） |

## 技术方案对比

| 选项 | 描述 | 取舍 |
|------|------|------|
| A. 整体移除 | 前后端 + domain 整域 + 依赖一次删净 | **采纳**；UI 已死，保留只剩成本 |
| B. 保留代码、仅关入口 | feature flag 关闭 | 死代码 + 依赖仍在编，性能负债不消；**否决** |
| C. 移除前端、保留后端命令 | 减少前端改动面 | Rust 重依赖仍拖累构建；**否决** |

## 风险

- 语言名 i18n key（`languageEnglish` 等）可能被他处复用 → 删前全仓 grep 逐个核对。
- domain 整域移除的门禁链长（OWNED_KEYS / freeze 表 / runtime-contract 白名单 / 5+ 测试文件）→ 单 PR 内一次改齐，跑 `npm run check:app-shell:governance` 验收。
- Windows 构建走 `stub.rs`，整模块删除无平台差异风险，但 `command_registry.rs` 统一注册不得留半截。
