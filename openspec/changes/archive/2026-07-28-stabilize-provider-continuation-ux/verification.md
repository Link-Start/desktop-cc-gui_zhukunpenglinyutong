# Verification：stabilize-provider-continuation-ux

## 摘要

| 维度 | 状态 |
|---|---|
| 完整性 | 12/12 tasks；4/4 delta requirements 有实现与测试证据 |
| 正确性 | Native bootstrap、Continuation UX、Shared identity、reload projection 全覆盖 |
| 一致性 | 遵循低侵入 Canvas、fail closed、immutable snapshot、无新依赖设计 |

结论：无 CRITICAL / WARNING。实现可提交。

## 需求映射

### Native bootstrap correctness

- `src-tauri/src/native_continuation/commands.rs`
  - target identity 在发送前持久化到 operation。
  - CLI invocation 成功即按 runtime accepted evidence 收口；marker 未回显只记录日志。
  - recovery 仅 probe 同一 target，bounded reader 同时校验 package marker 与
    `MOSSX_NATIVE_CONTEXT_V1`，并兼容 assistant exact ACK。
- `src/features/app/hooks/useAppServerEvents.ts`
  - `provider-continuation-*` owner 在统一 event ingress 隔离，不进入普通 Turn handler。
- `src/utils/contextProtocol.ts`
  - History presentation 隐藏完整 bootstrap control exchange，普通包含 `MOSSX` 的文本保留。

### Low-intrusion Continuation UX

- `src/features/app/components/ProviderContinuationDialog.tsx`
  - application-owned Dialog 展示创建/校验、可读 recovery、重试校验。
  - raw error 默认折叠在“技术详情”；degraded retry 保持用户确认。
- `src/features/layout/hooks/conversationCanvasNode.tsx`
  - Continuation metadata 不再作为 Canvas 根 sibling。
- `src/features/messages/components/MessagesCore.tsx`
  - 仅通过既有 `.messages` timeline-leading slot 接入。
- `src/features/shared-session/components/ProviderContinuationContextCard.tsx`
  - 原生 `<details>` 默认折叠，无新 state、polling 或 streaming 订阅。

### Shared Turn identity

- `src/features/composer/components/ChatInputBox/selectors/ModelSelect.tsx`
  - Picker 原子写入 CLI、Provider id/name/source、Model。
- `src/features/threads/hooks/useThreadMessaging.ts`
  - Shared Target Store 是 send boundary 权威输入；旧 global selection 不覆盖。
  - unsupported historical target fail closed，零 runtime send side effect。
- `src/features/shared-session/runtime/sendSharedSessionTurnV2.ts`
  - Provider display identity 随 target 冻结进 `turnRequested` snapshot。
- `src/utils/turnBadge.ts`
  - CLI 显示产品名称；explicit disk/local 与 legacy unknown 使用不同 fallback。
- `src/features/messages/presentation/sharedProjection/dataSource.test.ts`
  - Claude Provider A 与 Codex Provider B 的 snapshot 在 history rebuild 后仍彼此独立。

## 增量验证

| 命令/范围 | 结果 |
|---|---|
| Native continuation Rust module | 7 passed |
| 13 个 Continuation/Shared/Projection Vitest files | 206 passed，2 skipped |
| Shared send boundary 定向 tests | 3 passed |
| protocol/Badge/Messages 重构回归 | 65 passed，2 skipped |
| `npm run typecheck` | passed |
| changed-file scoped ESLint | passed，0 error / 0 warning |
| `rustfmt --check` | passed |
| `npm run check:runtime-contracts` | passed |
| `npm run check:model-provider-catalog` | passed |
| `npm run check:messages-boundaries` | 本批新增 2 条已清零；剩余 9 条为既有 baseline |
| `openspec validate stabilize-provider-continuation-ux --strict --no-interactive` | passed |
| `openspec validate --all --strict --no-interactive` | 471 passed；2 个既有 active change 失败，与本批无关 |

## Review 结论

- 跨平台：新增路径读取继续复用既有 resolver 与 bounded blocking reader；Frontend
  无 OS/path/shell 分支，macOS、Windows、Linux 行为一致。
- 性能：bootstrap ingress 为常数级 turn-id 判断；metadata row 无 root hook、polling、
  delta state；普通 Session 未提供 slot 时无额外 DOM。
- 幂等：operation/target identity 在外部 side effect 前固定；recovery 不重建 target。
- 交互：错误主文案与技术细节分层；来源 Session 保持不变；历史未知身份不再伪装 local。

## 仍需人工验证

真实 Desktop Provider 账号/CLI 环境无法由 unit test 替代。发布前执行：

1. Claude Provider A Native Session → Codex Provider B。
2. Codex Provider B → Claude Provider A。
3. 在 Shared Session 中发送 Claude Provider A Turn，再发送 Codex Provider B Turn。
4. 重启 App，确认两轮 Badge、折叠续接摘要、来源导航、最终消息与 processing 结束状态。
