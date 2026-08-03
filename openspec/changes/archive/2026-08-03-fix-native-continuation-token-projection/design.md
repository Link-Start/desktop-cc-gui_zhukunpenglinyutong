## Context

Native Provider Continuation 先由 `native_history::reader` 把 vendor JSONL 归一化为 portable
entries，再由 `shared_context::compiler` 选择 projection mode、执行 checkpoint，最后由
Claude prompt 或 Codex `thread/inject_items` transport 交付。

当前有四个耦合缺陷：

1. `estimated_tokens` 固定使用 `chars / 4`，但 UI 将其误描述为 Provider 当前 context。
2. Codex `compacted` record 被当作 unknown block，reader 仍保留 compaction 前的全量 rollout。
3. `structured_history_import` 在 mode selection 中优先于 budget，导致 Codex import 不执行
   checkpoint。
4. checkpoint 只折叠 `text` block；单一 oversized Turn 中的 atomic Tool Exchange 无法折叠，
   `drop-oldest-complete-turns` 最终会把唯一 Turn 整体清空。

约束：来源 history 必须只读；materialization 必须 deterministic；Tool Call/Result pairing
不得被拆开；preview 不增加网络调用；现有 IPC shape 与 target transport capability 保持兼容。

## Goals / Non-Goals

**Goals:**

- Codex export 与其最后有效 compaction window 对齐。
- Transport capability 与 package budget 解耦。
- Tool-heavy、single-Turn history 在固定 budget 内生成 non-empty deterministic package。
- UI 准确描述 estimate 的业务语义。

**Non-Goals:**

- 实现 Claude/Codex 官方 tokenizer 或计费级 Token 统计。
- 修改 Context Package schema、operation database schema 或 vendor history。
- 改变 target identity、lineage、provider binding、bootstrap ACK 与 Canvas presentation。

## Decisions

### 1. Reader 在 normalization 前重放 Codex compaction

JSONL 仍按 frozen cursor 完整读取和校验 checksum，但 normalization 输入改为 effective records：

```text
普通 record                  → append
有效 Codex compacted record → clear previous records
                              append replacement_history items
后续普通 record              → append
```

只识别 outer `type=compacted` 且 `payload.replacement_history` 为 array 的记录。嵌套 item 的
fallback identity 由 outer source line、replacement index 与 item bytes 确定生成。这样不修改
来源文件、不依赖运行时内存状态，重复 prepare 仍得到相同 artifact。

不采用“只读取最后一次 compaction 之后的文件尾”，因为 replacement history 本身就是新窗口的
基础，跳过它会丢失 compaction summary 与 host instructions。

### 2. Projection mode 只描述 transport，budgeting 独立决定

`NativeHistoryImport` 继续表示 Codex typed import transport。compiler 另外计算
`requires_checkpoint = source_estimated_tokens > budget`；只要超预算，就对 delta 执行统一
fold/trim，且 manifest mode 仍保持 `native-history-import`。

这比把 Codex 强制改成 `Checkpoint` mode 更稳健：后者会改变 `execute_codex` transport 分支，
退化为 prompt delivery，并丢失 typed Tool Exchange。

### 3. Atomic Tool Exchange 作为不可拆分 block 折叠

checkpoint 对 `atomic-tool-exchange` 的 `argumentsSummary` 与 `outputSummary` 分别执行
deterministic folding：

- 保留 `toolCallId`、`toolName` 与 call/result pairing；
- 保留结构 keys、head/tail、error/warning/failed evidence；
- folding 结果再经过 Unicode-safe char cap，防止单行巨型 JSON 或日志突破上限；
- 记录 `checkpoint-tool-exchange` compression category 与 omission。

不把 Tool Result 全部删除，因为错误证据与执行结果是续接判断的重要上下文。

### 4. 最后一个 oversized Turn 使用 portable spine

trim 先继续按完整 Turn 删除旧历史，但永远不删除最后一个 Turn。若最后 Turn 仍超预算：

1. 保留其 User entry；
2. 保留最后一条 Assistant entry；若不存在则保留最后一条 portable entry；
3. 从旧到新删除其余中间 entry，直到满足 budget；
4. 每次删除都写入 `checkpoint-budget` omission。

folded block 有严格 char cap，因此 User + final Assistant spine 必须能落入 12k 默认 budget。
若 source entries 非空但最终 package 仍为空或超预算，compiler fail closed，禁止创建 target。

### 5. Estimate label 描述 projection，而非 model context

IPC 继续返回 `sourceEstimatedTokens` 与 `packageEstimatedTokens`，避免兼容性破坏。UI label 改为
“可移植历史 Token → 续接包 Token”。数值仍使用 deterministic estimator，便于 artifact
identity、测试与离线 preview；不再暗示等于 Provider-reported usage。

## Risks / Trade-offs

- [Risk] replacement history 包含 encrypted compaction block → 继续走 private omission，禁止泄露。
- [Risk] budgeted native import 相比全量 import 丢失旧 Tool Output → manifest omissions 保留
  degradation evidence，产品仍在同一次确认中明确继续。
- [Risk] char estimator 对不同语言误差明显 → UI 修正语义；精确 tokenizer 留作独立 capability，
  本变更不增加延迟和依赖。
- [Risk] portable spine 丢失同一 Turn 的中间步骤 → 保留 User intent、最终 Assistant 与
  deterministic omissions，优于空 package 或无限量 import。

## Migration Plan

1. 先增加 Codex compaction、atomic Tool folding、single oversized Turn 与 budgeted import tests。
2. 修改 reader/compiler，并保持 serialization/IPC 向后兼容。
3. 更新 UI label、Trellis contract 与 OpenSpec delta。
4. 执行 focused tests、typecheck、runtime contracts 与 strict validation。

回滚只需恢复 reader/compiler/UI 的局部逻辑；没有 persisted schema migration。已冻结的旧
prepared operation 继续复用其原 artifact，不在 target side effect 后重编译。

## Open Questions

无。真实 Claude/Codex artifact、rollout compaction record 与 provider usage 已足以确定边界。
