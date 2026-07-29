## 1. Backend terminal contract（P0，无前置依赖）

- [x] 1.1 在 `AttemptAccumulator::Terminal` 完成 failed terminal normalization：输入为所有 Runtime terminal evidence；输出为保留真实 code、缺失时使用 `runtime_failure_unclassified` 的 `RuntimeFinalSnapshot`；验证 Codex 与 EngineEvent focused Rust tests。
- [x] 1.2 增加 canonical regression assertion：输入为缺 code 的 failed snapshot；输出为可通过 strict validator/commit 的 `conversation.turnCommitted`，且 cancel intent/真实 Provider code 不回归；验证 targeted Rust test。

## 2. Shared recovery presentation ownership（P0，依赖 1）

- [x] 2.1 在 Messages orchestration 派生并传递 `nativeRuntimeRecoveryEnabled`：输入为 thread identity；输出为 Shared thread 不选择 Native reconnect card、Native thread 保持原行为；验证 focused Messages Vitest。
- [x] 2.2 收口 Shared diagnostic row：输入为匹配 Native reconnect classifier 的 Shared assistant diagnostic；输出为不显示 Native recovery card/action，Shared 状态条仍为唯一恢复入口；验证 Shared/Native 对照测试。

## 3. Degraded-context structured i18n（P1，可与 2 独立）

- [x] 3.1 把 Manifest structured omission 写入 `SharedSendDegradedInfo`：输入为 preview/actual package manifest；输出为 UI 不再依赖拼接英文 omission string；验证 send orchestrator/store focused tests。
- [x] 3.2 重构 `SharedSendStatusBar`：输入为 structured mode/omission/disposition/compression；输出为本地化摘要、可展开详情、保留“继续发送 / 取消”gate；验证 component interaction tests。
- [x] 3.3 补齐所有 `sharedSend` locale keys 与 placeholders，重点清除简体/繁体中文已知英文协议词；验证 locale parity test。

## 4. 增量质量门禁（P0，依赖 1-3）

- [x] 4.1 运行 focused Rust tests、Shared/Messages/i18n Vitest、targeted ESLint 与 `npm run typecheck`；输入为本 change touched files，输出为全部通过且不启动 App、不跑全量测试。
- [x] 4.2 运行 `openspec validate fix-shared-terminal-recovery-i18n --strict --no-interactive`，审计 `git diff --check` 与 cross-layer caller；输出为 artifacts/实现一致且无未处理回归。

## 5. Same-Binding continuation（P0）

- [x] 5.1 将 `destination-owned` 收口为 benign de-duplication：Manifest 保留审计事实，但 prepare status/UI gate 只统计 actionable omissions。
- [x] 5.2 zero-delta package 生成空 `promptPrefix`，dispatch 不等待 Claude replay echo，使用 `no-context-transfer-required` acceptance evidence。
- [x] 5.3 调整 awaiting 文案与 structured detail，确保同目标续聊无迁移卡片、真正 lossy 内容仍显式确认。

## 6. Native Runtime ownership（P0）

- [x] 6.1 在 coordinator trust boundary 规范化 Claude raw/prefixed session identity，并兼容历史 raw Binding；增加双 Provider isolation + terminal focused tests。
- [x] 6.2 Codex 新 Binding 在 `thread/start` 前建立 provider-scoped provisioning hold；exact bind 后只投影 Shared owner，非目标事件原样释放；增加首发可见性回归测试。
- [x] 6.3 `list_shared_sessions` 从 V2 `shared_binding_state` 合并 Hidden Native identity，刷新/重启后继续排除普通 Session；增加 event-store + thread catalog focused tests。

## 7. Stale Binding recovery（P0，依赖 6）

- [x] 7.1 将 Native session-not-found 归类为 `binding-recovery-required`：failed terminal 幂等落账、Binding 标记 recovery、held ingress 清理。
- [x] 7.2 前端把 typed Binding recovery 转为 early return，不追加 raw error row；恢复状态条继续提供显式 Probe/Rebuild。

## 8. 追加增量门禁（P0，依赖 5-7）

- [x] 8.1 运行 compiler/coordinator/shared_session_v2 focused Rust tests，以及 Shared send/status/i18n focused Vitest。
- [x] 8.2 运行 touched-file ESLint、TypeScript typecheck、Rust fmt/check、OpenSpec strict validation、cross-layer audit 与 `git diff --check`；不启动 App、不跑全量测试。
