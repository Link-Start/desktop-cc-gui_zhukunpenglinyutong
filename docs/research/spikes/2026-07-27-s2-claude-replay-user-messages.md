# S2 Spike: Claude Code 2.1.218 `--replay-user-messages` ACK 语义实测

- 日期: 2026-07-27
- 执行方式: Node.js spawn stdio 探测脚本（NDJSON 行解析 + 超时保护）
- Harness: `docs/research/spikes/harness/s2-claude-replay-ack/probe.mjs`
- Evidence: raw `*.ndjson` / `*.meta.json` 仅本地留存；仓库 policy 见 `docs/research/spikes/harness/s2-claude-replay-ack/evidence/README.md`
- 实验 cwd: `/tmp/mossx-s2-spike`（隔离目录，未触碰真实工作区）
- API 成本: 4 次模型调用（single 1 + long 1 + two 2；badflag 0 次）

## 1. 实测环境（Capability Cache Key identity）

| 项 | 值 |
|---|---|
| binary path（symlink） | `<HOME>/.local/bin/claude` |
| binary real path | `<HOME>/.local/share/claude/versions/2.1.218` |
| binary type | Mach-O 64-bit executable arm64（255,069,680 bytes） |
| version | `2.1.218 (Claude Code)` |
| sha256 | `71abaff59312c9a9b6a1d818365048b42e4e95cc521a823660eded3e0880d9b7` |
| platform | macOS darwin / zsh |
| 实测 model | `kimi-for-coding`（本机默认配置；非 Anthropic 官方模型名，属环境事实） |

推荐 Capability Cache Key 组成: `realpath(binary) + version + sha256 + {input-format,output-format,replay-user-messages,verbose}`。注意 symlink path 不稳定（升级时重指向），必须 resolve 后取 real path。

## 2. ACK Contract Matrix（8 问逐条结论）

### Q1. flag 存在性 — PASS

`claude --help` 明确定义：

```
--replay-user-messages   Re-emit user messages from stdin back on stdout for
                         acknowledgment (only works with --input-format=stream-json
                         and --output-format=stream-json)
```

- 确切 flag 名: `--replay-user-messages`（无短选项）。
- 语义: 把 stdin 收到的 user message 重新发回 stdout，用途即 acknowledgment。
- 约束: 仅在 `--input-format=stream-json` + `--output-format=stream-json` 组合下生效。

### Q2. echo 是否回显 + 完整 shape + 事件序列位置 — PASS（有序列位置警告）

命令: `claude -p --input-format stream-json --output-format stream-json --verbose --replay-user-messages`，stdin 写入一行 `{"type":"user","message":{"role":"user","content":"..."}}`。

echo 实测完整 shape（evidence: `single-*.ndjson` event 44）：

```json
{
  "type": "user",
  "message": { "role": "user", "content": "probe MOSSX_S2_PROBE_7f3a9c one. Reply with exactly: OK" },
  "session_id": "4b16d6ee-087c-4f40-a497-fd4b222df980",
  "parent_tool_use_id": null,
  "uuid": "9d6bfd9c-dd37-41e2-ad93-772545f4ac6b",
  "timestamp": "2026-07-27T03:24:52.899Z",
  "isReplay": true
}
```

逐字段记录: `type=user`、`message.role/content`（与发送完全一致）、`session_id`、`parent_tool_use_id=null`、`uuid`（服务端分配）、`timestamp`（ISO8601，**消息被接受/提交的时刻**，非 stdout 送达时刻）、`isReplay=true`（区分 echo 与其他 user 事件的显式标记）。

**序列位置（关键发现）**: echo **在 system/init 之后**，但**不是收到 stdin 后立即发出**。三次实验一致观察到 echo 在 stdout 上的送达时刻紧贴该 turn 的最后一个 assistant message 与 `result` 之前（single: init +1679ms → echo +25762ms → result +25898ms）。echo 内部 `timestamp` 字段才是接受时刻（≈ init 完成时）。即：**echo 事件在 turn 开始时被创建，但延迟到 turn 结束才 flush 到 stdout**（stdout 无缓冲问题——同 turn 的 thinking_tokens 是持续流式到达的）。

### Q3. echo 逐字保留 + marker 关联 + 长文本 — PASS

- 短文本: 发送 55 字符，echo `message.content` 与发送字符串**逐字节相同**；唯一 marker `MOSSX_S2_PROBE_7f3a9c` 命中，可据此关联（evidence: harness 输出 `[MARKER HIT]`）。
- 长文本: 发送 7277 UTF-8 bytes（5837 JS chars，122 行多行文本含中文），echo content 经 python 逐字符比对 `identical: True`，首尾 marker 均保留（evidence: `long-*.ndjson` 比对输出）。>4KB 多行文本完整回显。
- 关联手段排序建议: ① echo 内嵌 marker/checksum 字符串直接匹配（最简单可靠）；② `echo.uuid` 与 session JSONL user entry `uuid` 一致（见 Q7），可跨 stdout/磁盘双通道校验；③ content 全文 SHA-256（需先 JSON 解析还原字符串再 hash，避免 NDJSON 转义差异）。

### Q4. `result` event shape + 与 process exit 关系 — PASS

成功路径（evidence: `single-*.meta.json` 与 transcript 末行）:

```json
{
  "type": "result", "subtype": "success",
  "is_error": false, "num_turns": 1,
  "session_id": "4b16d6ee-...",
  "result": "OK",
  "stop_reason": "end_turn", "terminal_reason": "completed",
  "api_error_status": null, "permission_denials": [],
  "duration_ms": 24228, "duration_api_ms": 24158,
  "ttft_ms": 24092, "ttft_stream_ms": 22993, "time_to_request_ms": 26,
  "total_cost_usd": 0.389064,
  "usage": { "input_tokens": 77506, "cache_read_input_tokens": 768, "output_tokens": 46, ... },
  "modelUsage": { "kimi-for-coding": {...} },
  "fast_mode_state": "off", "uuid": "65f4d019-..."
}
```

- 三次成功运行均满足: `result` 在 process exit 之前到达，exit code = 0。事件顺序恒为 `... → echo → assistant(final) → result → exit`。
- 失败路径（badflag: 非法 flag）: exit code = 1，**无任何 result event**，stdout 无 NDJSON 输出（evidence: `badflag-*.meta.json`）。
- 对应关系: `result.subtype=success` ⇔ exit 0（实测 3/3）；启动期失败 ⇒ 无 result + exit≠0。**运行期失败（API 错误/中断）本次未实测**（需真实 API 错误注入，成本与可复现性不满足 Spike 约束），列入 Wave 5 复核。

### Q5. system/init shape — 能证明什么、不能证明什么 — PASS（验证设计假设成立）

init 完整字段: `type=system, subtype=init, cwd, session_id, tools[80], mcp_servers[9], model, permissionMode, slash_commands[100], apiKeySource, claude_code_version, output_style, agents[23], skills[59], plugins, capabilities, analytics_disabled, product_feedback_disabled, uuid, memory_paths, fast_mode_state`。

- **能证明**: Runtime ready（进程存活、session_id 已分配、model/permissionMode/tools 清单已确定）。`capabilities: ["interrupt_receipt_v1", "msg_lifecycle_v1"]` 值得 Wave 5 深挖（可能存在更细粒度 message lifecycle 事件通道）。
- **不能证明**: prompt accepted。实测 init 在 +1.7s 到达，而 echo（接受确认）内部 timestamp 也 ≈ init 时刻但 stdout 延迟到 turn 末——init 与"消息是否被消费"无因果绑定。设计文档假设成立：init 只能映射到 ACK 阶段的 `run started`（甚至更弱的 `prepared`），**不能**当 `prompt accepted`。
- **意外发现**: stream-json input 模式下，**每个新 prompt 都会再发一次 system/init**（two 场景 event 62，第二条消息发送后 +3ms 出现第二个 init，同 session_id）。init 不是"每进程一次"，而是"每 turn 一次"。

### Q6. 连续两条 stdin message — PASS

- 保持 stdin 打开，第一条 `result` 到达后发送第二条，然后关闭 stdin。
- 结果: 两条消息**各自都有 echo**，顺序与发送顺序一致（echo#1 content="...one..." 在 result#1 之前，echo#2 content="...two..." 在 result#2 之前）。两个 turn 各自闭环: `init → (stream) → echo → assistant → result`（evidence: `two-*.ndjson`）。
- 顺序保证: 单进程内事件严格按 turn 串行，未观察到交错。

### Q7. session 落盘 JSONL shape — PASS

落盘位置: `~/.claude/projects/-private-tmp-mossx-s2-spike/<session_id>.jsonl`（cwd `/tmp/...` 被 resolve 为 `/private/tmp/...` 后编码）。two 场景 session 共 15 条 entry，类型序列:

```
queue-operation(enqueue) → queue-operation(dequeue) → user → attachment×3
→ assistant(thinking) → assistant(text) → queue-operation×2 → system(stop hook)
→ user → assistant ×2 → last-prompt
```

代表性 shape（可直接作 T0.6 fixtures，完整行见 session 文件 `d0ba400f-....jsonl`）：

- `queue-operation`: `{type, operation:"enqueue"|"dequeue", timestamp, sessionId, content?}` — **enqueue 带完整 content，且在 stdin 写入后 ~0.5s 即落盘**，是比 echo 更早的磁盘侧接收信号。
- `user` entry: `{parentUuid, isSidechain, promptId, type:"user", message:{role,content}, uuid, timestamp, permissionMode, promptSource:"sdk", userType:"external", entrypoint:"sdk-cli", cwd, sessionId, version:"2.1.218", gitBranch}`。**其 `uuid` 与 stdout echo 的 `uuid` 完全一致**（358fd105-... 双侧命中），`timestamp` 也一致——echo 与磁盘 entry 是同一对象的双通道投射。
- `assistant` entry: `message` 为完整 Anthropic Message 对象（含 thinking/text content blocks、model、usage、stop_reason），外加 `parentUuid` 链、`effort` 等。
- `last-prompt`: `{type, lastPrompt, leafUuid, sessionId}` — session 尾部摘要。

### Q8. identity — PASS

见第 1 节表格。`shasum -a 256` 对 symlink 会自动 follow，实测 hash 指向真实 binary。

## 3. go/no-go 结论：echo 作为 Input ACK

**结论: 有条件 GO（GO with caveats）。**

echo 机制真实存在、逐字保真、带 `isReplay` 显式标记、`uuid` 与磁盘 entry 对齐——作为 **Input ACK 的关联载体完全可用**。但必须修正设计文档的一个隐含假设：

> **echo 不是实时 ACK。** 它在 turn 结束时才送达 stdout（与 result 前后脚）。它证明的是"该消息已被接受并持久化"（其内部 timestamp 是接受时刻），但不能用于"发送后快速确认 prompt accepted 再推进状态机"的实时门控。

推荐做法（clientTurnId/checksum 关联）:

1. mossx 侧为每个输入生成 `clientTurnId`，并把 `<clientTurnId>:<checksum前8位>` 形式的 marker 注入 message 文本（或 structured content block）。
2. ACK 阶段映射修正:
   - `prepared` → 进程 spawn 成功；
   - `context accepted` / `run started` → 首个 `system/init`（每 turn 一个，按 session_id + turn 序号对齐）；
   - `prompt accepted` → **echo 到达**（语义为"已接受且已持久化"，滞后但确定）；若需要更早信号，可并行 tail session JSONL 的 `queue-operation/enqueue`（~0.5s 级，带完整 content 可 checksum），作为乐观信号、echo 作为最终确认；
   - `run settled` → `result`（subtype=success/error_*）+ exit code 联合判定。
3. 关联优先级: marker 字符串匹配（主） → echo.uuid ↔ 磁盘 user entry.uuid 交叉校验（辅） → 全文 checksum（兜底）。

## 4. `result` vs process-exit 冲突定性

- 正常路径无冲突: `result` 恒在 exit 前到达，exit 0。以 `result` 为 settled 信号、exit 为兜底即可。
- 启动期失败: 无 `result`，exit≠0 —— 必须以 **exit code + 超时无 result** 判定失败，不能干等 result。
- 风险敞口（未实测）: 运行期 API 失败/进程被杀时 `result.subtype` 是否仍送达、exit code 组合如何，需 Wave 5 用真实错误注入复核。当前实现应把"无 result 的 exit"一律按失败处理，避免悬挂。

## 5. 已知风险与 Wave 5 复核事项

1. **echo 延迟语义**: 任何依赖"echo 快速返回"的设计都需返工；本报告第 3 节的阶段映射是修正后基线。
2. **运行期失败形态未覆盖**: API 错误、SIGKILL、网络中断下的 result/exit 组合未实测（Spike 成本控制）。
3. **`capabilities: ["interrupt_receipt_v1", "msg_lifecycle_v1"]`**: init 宣告了 message lifecycle 能力，2.1.218 可能存在比 echo 更细的 ACK 事件（如 interrupt receipt），Wave 5 应查阅 SDK/changelog 确认是否有可开启的 lifecycle 事件流。
4. **每 turn 一个 system/init**: 多 turn 场景按 turn 对齐 init 与 echo，不要假设 init 全局唯一。
5. **模型与环境差异**: 本机实测 model 为 `kimi-for-coding`（非官方 Anthropic 模型），usage/cost 字段结构可能随 provider 变化；echo/init/result 的 envelope 字段（type/subtype/uuid/session_id/isReplay）属 CLI 层契约，与模型无关，但 Wave 5 换环境后应重新跑一遍 `single` 场景回归。
6. **echo 只在双 stream-json 模式生效**: mossx 若未来切到 `--output-format json`（单结果模式），echo 不可用，Input ACK 方案需降级到磁盘 JSONL 信号。
