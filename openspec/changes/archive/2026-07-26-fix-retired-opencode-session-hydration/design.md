## Context

OpenCode execution 已由 `engineExecutionPolicy` 和 Rust runtime policy fail closed，但 thread
hydration 仍保留早期兼容参数 `includeOpenCodeSessions`，且默认值为 `true`。normal full-catalog
路径省略该参数时会调用 `opencode_session_list`。该调用失败后由 `traceStartupCommand` 进入
global runtime notice。

约束：

- 历史 OpenCode session continuity 可以保留，不能删除用户磁盘数据。
- normal hydration 必须继续使用现有 catalog、stale guard 与 last-good merge。
- 不新增依赖，不修改 IPC payload，不引入根链 polling/state。

## Goals / Non-Goals

**Goals:**

- retired OpenCode 不再被 normal workspace hydration 自动探测。
- startup ownership 和 CI gate 与 production runtime policy 一致。
- 用最小测试锁定默认关闭与显式 compatibility 边界。

**Non-Goals:**

- hard-delete OpenCode command surface。
- 改写 workspace session catalog architecture。
- 修改其他 engine hydration 或 session attribution。

## Decisions

### 1. 在共享 hydration owner 处默认关闭

将 `includeOpenCodeSessions` 的默认值由 `true` 改为 `false`。所有 normal callers 已经通过同一
`listThreadsForWorkspace` owner 汇合，因此一次修复覆盖 active workspace、full-catalog prewarm
与 workspace flow。

备选：逐个 caller 传 `false`。该方案容易漏掉后续 caller，且复制 retired policy，拒绝。

### 2. 保留显式 compatibility 分支

暂不删除 `includeOpenCodeSessions`、service 或 backend command。显式传入 `true` 的测试/兼容调用
仍能工作，避免把 runtime-noise 修复扩大成历史数据 hard removal。

备选：删除整个 OpenCode session surface。范围过大，涉及 resume/import/export 与 daemon parity，
不符合本次 YAGNI 边界。

### 3. Gate 检查“默认值 + startup owner”

扩展现有 `check-opencode-retirement.mjs`，直接检查生产 hydration 默认 fail closed，并禁止
`STARTUP_OWNER_RECORDS` 重新声明 `opencode_session_list`。

备选：只增加 Vitest。测试可能被局部 mock 绕过，无法阻止结构性回流；治理脚本更适合固定产品边界。

## Risks / Trade-offs

- [Risk] 仅存在于 native OpenCode CLI、尚未进入 catalog/last-good 的历史行不会被 normal hydration
  新发现 → Mitigation：这是 soft-retirement 的预期边界；磁盘数据与显式 compatibility command 保留。
- [Risk] 未来恢复 OpenCode 时默认关闭会阻止发现 → Mitigation：主 spec 已要求恢复必须新建 OpenSpec
  change，并同步调整 gate。
- [Risk] 字符串型 governance gate 对重命名敏感 → Mitigation：只检查稳定 owner/default contract，
  不扫描所有 OpenCode compatibility code。

## Migration Plan

1. 修改共享 hydration 默认值并移除 startup owner。
2. 增加 focused regression test 与 retirement gate。
3. 运行 focused Vitest、typecheck、retirement check、OpenSpec strict validation。
4. 回滚时恢复上述三处差异即可；无数据迁移。

## Open Questions

无。本次不处理 OpenCode compatibility command 的最终 hard removal。
