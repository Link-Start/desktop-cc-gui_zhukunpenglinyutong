## Context

Codex catalog 的 visible identity 是 raw thread id；`parse_catalog_identity` 也将无 prefix id
视为 Codex。Provider Continuation target execution 却把 `thread/start` 返回值包装成
`codex:<thread-id>` 并同时用于 operation result、frontend selection 与 metadata persistence。
`metadata_stable_key_for_session_id` 因此产生
`codex:<workspace>:codex:<thread-id>`，而真实 catalog row 使用
`codex:<workspace>:<thread-id>`。

真实运行证据还显示 `thread/inject_items` 的 payload 只有起始
`MOSSX_CONTEXT_PACKAGE` marker。当前 presentation filter 在遇到第一条普通 user item 时退出
control exchange；structured import 中恰好包含 imported user/developer history，因此内部
bootstrap 内容被恢复为普通消息。

## Goals / Non-Goals

**Goals:**

- Codex continuation target 使用与 catalog 一致的 raw identity。
- Continuation metadata 对真实 catalog row 生效，并恢复历史 duplicated key 与 Family chain。
- Structured import 使用显式嵌套安全的 package/accepted envelope。
- 保持 filtering 在 presentation boundary，避免触碰 streaming reducer 或 vendor history。

**Non-Goals:**

- 不改变 Context Package portable projection。
- 不修改 Claude/Kimi target path。
- 不引入新的 persisted schema 或 background migration。
- 不改变 Sidebar/Canvas 组件结构和样式。

## Decisions

### 1. Codex operation result 使用 raw thread id

`execute_codex` 从 `thread/start` 取得 raw id 后，直接写入 `result_session_id`，并把同一 raw id
传给 `persist_target_metadata`。Recovery 继续兼容旧 `codex:` result，读取 runtime 时只提取
raw id；新 operation 不再产生 prefixed result。

选择该方案而不是让全部 Codex catalog 改成 prefixed identity，因为 raw id 是当前 catalog、
history loader、thread selection 与 provider-scoped runtime 的既有 contract。

### 2. Legacy compatibility 在 metadata overlay 中完成

Catalog lookup 对 Codex row 同时尝试：

```text
codex:<workspace>:<raw-id>
codex:<workspace>:codex:<raw-id>   # legacy bug key
<raw-id>
codex:<raw-id>
```

Continuation metadata projection 根据 `sourceSessionId` 递归解析已存在 source continuation，
重新派生 `familyId`、`familyRootSessionId` 与 `lineageDepth`。递归使用 visited set fail closed，
遇到 cycle 时保留当前 stored metadata，不猜测标题、时间或 Provider。

新写入仍只保存正确 stable key；不在 app 启动时重写用户 metadata 文件，避免 migration
side effect。后续从 legacy continuation 再次续接时，record path 复用同一 resolver，保证新
target 继承修复后的 Family。

### 3. Structured import 使用可嵌套的闭合 envelope

`codex_import_projection` 在 items 首尾分别写入 exact package marker 与 exact accepted marker。
Frontend filter 使用 identity-aware stack：

- exact package marker：push `<package-id>:<checksum>`；
- exact accepted marker：关闭 matching package 及其内部遗留的旧版未闭合 package；
- stack 非空时隐藏任意 role/kind；
- stack 为空后普通 user turn 正常展示；
- native prompt transport 继续使用现有“下一条普通 user message 结束”语义；
- shared-runtime prompt 仍仅隐藏 transport echo。

Identity-aware stack 可以正确处理被再次续接的 history 中已有嵌套 marker，也能容纳旧版本只写
package、不写 accepted 的导入记录，不依赖宽泛 substring 或消息 role。

### 4. UI 继续消费统一 continuation metadata

不增加 Codex-specific row/card。正确 metadata 进入现有 `ThreadList` Family grouping、
Continuation badge 与 `ProviderContinuationContextCard` 后，自然获得与 Claude 一致的外观和
交互。

### 5. Codex host bootstrap 在 Messages presentation boundary 定向隐藏

Codex app-server 会在 MossX continuation control prompt 之前注入
`environment_context` 等 host bootstrap，并在 control prompt 后产生 bootstrap assistant
output。该序列不属于来源历史，也不位于 structured import envelope 内，因此不能依赖
package/accepted stack 自动隐藏。

Canvas 通过 catalog 已有的 authoritative `originKind=provider-continuation` metadata 向
Messages 传递稳定 presentation flag。Messages 仅在 `activeEngine=codex` 且该 flag 为 true
时启用 leading bootstrap state machine：

- 若已出现 exact MossX protocol marker，隐藏 marker 之前的 host prefix、control exchange
  与随后 assistant/reasoning，直到第一条普通 user turn；
- marker 尚未到达时，仅隐藏完整 `<environment_context>...</environment_context>` host item，
  避免 history 增量加载时闪现；
- 第一条普通 user turn 开始后退出 leading mode，后续对话恢复既有 filter semantics；
- 普通 Codex Session、Claude continuation 与 Shared V2 conversation 不启用该 gate。

该方案不在 history loader 做 substring 删除，也不修改 streaming reducer。Presentation cache
必须把 gate 纳入 cache identity，并让 control-tail 检测理解 leading mode，避免末尾 streaming
fast path 重新放出被隐藏的 bootstrap item。

### 6. Target selection 必须等待 catalog hydration barrier

Continuation command 返回 ready 时，target metadata 已持久化，但 frontend workspace catalog
仍可能保留上一帧 snapshot。若此时先选择 raw target id，再异步刷新 catalog，Canvas 会先以
普通 Codex Session 渲染 history，下一帧才获得 `provider-continuation` origin，造成
`environment_context` 短暂闪现。

创建成功路径 MUST 复用既有 workspace catalog reload Promise，并按以下顺序收敛：

```text
runtime ready
  → await workspace catalog reload
  → close continuation dialog
  → select authoritative target row
```

该 barrier 不增加 polling、timeout、provisional row 或第二份 continuation registry。Catalog
reload 使用既有 request/stale guard；失败降级由既有 reload contract 处理。由于 selection 只
发生一次，Messages 首帧即可同时观察 target identity、Codex engine 与 continuation origin。

## Risks / Trade-offs

- [Risk] legacy metadata 形成 cycle → resolver 使用 visited set 与 bounded recursion，cycle
  时保留 stored value，不阻塞 catalog。
- [Risk] acceptance marker 被普通用户讨论 → classifier 继续要求 exact SHA256 protocol shape，
  普通包含 marker 字样的文本保持可见。
- [Risk] 历史内含旧版未闭合 structured import → 新外层 matching accepted 关闭其内部遗留
  package；独立旧 Session 不重写 vendor history，避免 migration side effect。
- [Risk] raw result 改变 frontend fixture → 同步 hook test，证明 reload/select 使用同一 raw id。
- [Risk] 用户正文讨论 `<environment_context>` → 仅在 authoritative Codex Provider
  Continuation target 的 leading bootstrap 阶段识别完整 wrapper；普通 Session 与首个真实
  user turn 之后保持可见。
- [Risk] catalog reload 增加 ready 后等待 → 复用已经必需的 reload，不新增网络往返；Dialog
  保持 running/progress surface，避免用户看到错误 target 首帧或额外 loading view。

## Migration Plan

1. 增加 raw target 与 metadata compatibility tests。
2. 修改 Codex operation result/persistence。
3. 增加 legacy key lookup 与 recursive Family resolver。
4. 增加 import accepted marker 与 identity-aware presentation filter。
5. 同步 executable contract 并执行跨层 gates。

回滚时恢复上述局部逻辑即可；没有 schema migration，也不删除或重写 vendor history。

## Open Questions

无。真实 operation、catalog metadata 与 rollout 证据已能确定 identity 和 envelope 两个根因。
