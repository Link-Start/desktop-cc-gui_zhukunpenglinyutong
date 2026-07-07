# fix-diagnostics-idle-cpu-storm

## 背景

用户在正常进行 5-6 轮 Codex 提问后，`ccgui` 主进程 CPU 可飙升到数百百分比；并且在停止提问、客户端保持打开的 idle 状态下，CPU 仍会维持较高占用。

现场采样显示热点不在 Codex app-server 子进程，而在 Tauri `client_store_patch` 反复读写 `~/.ccgui/client/diagnostics.json`：每次 diagnostics append 都会触发整份 JSON read / parse / clone / pretty serialize / fsync / rename。

## 问题

当前 diagnostics pipeline 把若干高频或大 payload 的 debug/perf entry 持久化到了 client store：

- `thread/session:turn-diagnostic:codex-no-progress-watchdog-scheduled` 在 Codex progress evidence 更新时反复 force emit。
- `thread/list response` 会把完整 thread list response 镜像进 `diagnostics.threadSessionLog`，单条 payload 可达数十 KB。
- `perf.composer.render-budget` 在 composer idle render 期间也可能持续写入 `diagnostics.rendererLifecycleLog`。

这些条目对线上用户定位价值有限，却会在 normal / idle path 制造 persistent diagnostics store churn。

## 目标

- 正常流式会话期间，watchdog scheduled 诊断不得进入 durable diagnostics。
- idle 状态下的 composer render-budget 不得持续落盘。
- 大体积 `thread/list response` 不得镜像进 durable thread session log。
- 保留高价值诊断：watchdog fired / skipped / suspected / recovered、thread/list fallback/error、renderer lifecycle error 等。

## 非目标

- 不重写 `client_store_patch` 的底层 JSON store 机制。
- 不移除 diagnostics 面板或手动复制卡顿现场能力。
- 不调整 Codex lifecycle settlement 语义。
