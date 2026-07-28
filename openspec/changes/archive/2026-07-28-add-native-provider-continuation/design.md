## Context

Change A-C 已提供 Shared canonical storage、ExecutionTarget、ContextCompiler、Artifact Store
与 two-phase delivery。Native Session 仍保留 vendor-owned history；它没有 Shared Event Log。

当前跨 Provider 最接近的能力位于 Codex `fork_thread`：先在来源 Provider fork，再复制 rollout
JSONL 到目标 `CODEX_HOME`，并把结果写成 `parentThreadId`。该路径违反 Change D 的 ownership
与 relationship contract，且 Claude/Kimi 没有等价安全实现。

本变更同时触及 Rust source adapter、app-owned persistence、Tauri/daemon capability bridge、thread
metadata 与 Sidebar UI。所有目标 Runtime side effect 必须晚于 immutable preparation。

## Goals / Non-Goals

**Goals:**

- 三类 Native history source 统一输出 canonical-shaped entries、stable cursor、fingerprint、
  fidelity 与 omissions。
- preparation 原子持久化 normalized entries artifact、ContextPackage artifact 与
  materialization record；retry 不重读来源。
- 创建独立的目标 Native Session/Binding，持久化 provider-continuation Origin 与 Family。
- Sidebar 顶层展示、来源导航、typed failure/recovery feedback。
- 清退 Codex vendor rollout copy 与 `native-provider-rebind` 的错误关系语义。

**Non-Goals:**

- Native Session 热切 Provider、vendor history import/patch、Shared history migration。
- Conversation Family 嵌套 UI、Shared historical fork、跨设备 artifact replication。
- 将 unsupported Runtime 包装成成功；Kimi 没有稳定 cursor 时必须 fail closed。

## Decisions

### 1. Reader 是只读 anti-corruption layer

新增 `native_history` backend module：

```text
NativeHistorySource
  -> reader_for(engine)
  -> probe() => capability + currentThroughCursor
  -> read(throughCursor) => ordered ContextSourceEntry[]
```

Claude/Codex 复用已有 history path resolution/parsing primitives；Kimi 仅复用公开
`state.json + wire.jsonl` surface。cursor 使用 source file identity、bounded byte length 与
最后完整行 checksum 组成的 opaque token。read 只读取 probe 时冻结的 byte upper bound，
若 inode/file identity 或 bounded prefix checksum 改变则返回 `source-drifted`。

替代方案是直接复用 frontend history loaders。拒绝：它们输出 presentation items，已经
丢失 provenance、Tool pairing 与 stable source boundary。

### 2. Native source 编译不经过 Shared Event Log

`ContextCompiler` 增加 native-source 入口，将 `ContextSourceEntry` 直接转换为既有
`PortableContextEntry`、manifest 与 compression report。`ContextPackage.source` 明确记录
`kind=native-history`、reader id、source fingerprint 与 cursor range；checksum 覆盖这些字段
和 normalized entries。

转换复用 Change C 的 capability selection、Tool pair、artifact/omission 与 deterministic
compression helpers，不创建 `SharedCanonicalEntry`、sequence 或 Shared cursor。

替代方案是构造临时 Shared events 再写数据库。拒绝：这会把 Native source 伪装成 Shared
事实并污染 ownership。

### 3. Artifact 与 preparation record 先于目标 side effect

Artifact Store 扩展为可存储 typed deterministic payload，而非仅 `ContextPackage`。一次
operation 依次生成 normalized entries artifact 与 ContextPackage artifact，然后在 app-owned
SQLite continuation store 的单 transaction 中插入 immutable
`NativeHistoryMaterialization`：

```text
operationId (PK)
source + readerId + fingerprint + throughCursor
normalizedArtifactRef + checksum
contextPackageArtifactRef + checksum
destinationTargetSnapshot
phase = prepared | creating | ready | recovery-required | failed
resultSessionId?
```

相同 `operationId` 重试必须读取、校验并复用 record；参数不同返回
`operation-conflict`。artifact 缺失/checksum 不符进入 `recovery-required`，禁止重读来源。

替代方案是 JSON metadata + 两次 atomic write。拒绝：无法对两个 artifact ref 与 operation
phase 提供单 transaction identity。

### 4. 创建命令是 prepare/execute 两段，但 UI 暴露一个动作

Backend command `create_native_provider_continuation` 接收 source session snapshot、
destination target 与 client operation id：

1. resolve authoritative source Provider/Native id；
2. probe/read；
3. compile/write artifacts/commit preparation；
4. provision destination Native Session；
5. deliver ContextPackage 并等待 adapter acceptance；
6. persist canonical target id、binding、Origin/Family；
7. 返回新 `ThreadSummary`。

内部 phase 可恢复，frontend 不自行编排跨层事务。UI 使用 request generation 防止重复点击；
相同 operation id 可安全 retry。

目标 adapter 复用 Change C capability/ACK：

- Codex：新 thread + `thread/inject_items`，不复制 rollout。
- Claude：新 session identity + bounded transcript/checkpoint input，echo checksum 后 ready。
- Kimi：只有公开 adapter 能证明 acceptance 时执行；否则 typed unsupported。

### 5. Origin/Family 是 catalog metadata，不是 parent tree

扩展 `ThreadSummary`：

```text
originKind = provider-continuation
sourceSessionId
sourceProviderProfileId?
familyId
familyRootSessionId
lineageParentSessionId
lineageKind = provider-continuation
lineageDepth
```

历史 Root 缺 Family 时，以稳定 session key 自建 family。Continuation 继承来源 family，并将
来源写入 lineage parent。绝不设置 `parentThreadId`；`useThreadRows` 因而自然保持顶层。

Sidebar row 显示 Origin badge；context menu 的“查看来源会话”仅做 workspace/thread
navigation。来源已删除时禁用导航并显示“来源不可用”，不删除 Continuation。

### 6. 旧 Codex 跨 Provider fork 校准

同 Provider 的历史 Turn fork 仍走 native `thread/fork`。选择不同 Provider 时不再调用
`copy_native_fork_history_to_selected_provider`，而是进入 Provider Continuation flow；旧
`native-provider-rebind` response mapping 删除。这样修复共享根因，不保留两套相互漂移语义。

## Error Matrix

| Code | 条件 | 行为 |
|---|---|---|
| `unsupported-stable-cursor` | Reader 无稳定边界 | 不写 materialization，不创建目标 |
| `source-not-found` / `permission-denied` | 来源不可读 | 不创建目标，保留来源 |
| `source-drifted` | probe/read 间 bounded source 改变 | 不写 prepared record |
| `operation-conflict` | operation id 对应不同参数 | 拒绝复用 |
| `artifact-integrity` | retry artifact 缺失/checksum 错 | `recovery-required`，禁止重读 |
| `target-unavailable` | Provider/Runtime 不可用 | prepared 可重试，不回退 Provider |
| `acceptance-ambiguous` | 目标 side effect 后 ACK 不确定 | `recovery-required`，先 probe |
| `catalog-commit-failed` | target ready 但 metadata 未落盘 | 保留 result identity，重试 commit |

## Risks / Trade-offs

- [Vendor format 漂移] → Reader 版本化、typed unsupported、fixture contract tests；不猜字段。
- [来源文件在 probe/read 间增长] → byte upper bound + prefix fingerprint；只允许 append-after-bound。
- [目标已创建但 ACK 丢失] → durable phase/result identity + provider-specific probe，禁止盲建。
- [Artifact Store 泛化扩大影响面] → 保持旧 package API，新增 typed payload API，不引入依赖。
- [Sidebar metadata 在 native catalog merge 中丢失] → catalog metadata authoritative overlay +
  frontend mapping tests。
- [Kimi 稳定 API 能力不足] → 第一阶段显示 unsupported，不以 wire 文件写入伪装支持。

## Migration Plan

1. 增加 Reader/compiler/materialization contract 与 fixture tests，不接 UI。
2. 增加 backend Continuation command、Desktop 完整执行与 daemon typed capability gate。
3. 扩展 metadata/ThreadSummary/Sidebar UI，接入入口和来源导航。
4. 将 Codex 不同 Provider fork 路由到 Continuation；删除 vendor history copy。
5. 增量验证后更新 Change D checklist；manual Desktop smoke 保留为发布 gate。

回滚时可隐藏 UI 入口并保留已创建 Continuation metadata；旧来源和新 Native Session 都是
独立对象，无需回写 vendor history。不得恢复 vendor history copy 路径。

## Open Questions

无阻塞问题。Kimi Reader/target acceptance 是否可用以 runtime capability probe 为准；无法
证明时按设计返回 typed unsupported，不改变 Change D 语义。
