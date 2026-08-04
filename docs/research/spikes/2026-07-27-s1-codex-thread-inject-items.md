---
type: evidence
status: historical
---

<!-- DOC-LIFECYCLE: historical-reproducible-evidence -->
> [!NOTE]
> **Lifecycle: Historical reproducible spike evidence.** 结论只对报告记录的 CLI binary/version/schema 有效。CLI 或 protocol version 变化后必须重跑对应 harness，旧报告不得自动升级为 current capability claim。

# S1 Spike：Codex CLI 0.144.6 `thread/inject_items` 实测报告

- **探测日期**：2026-07-27
- **任务**：Wave 0 / S1，验证 mossx ContextCompiler `native-history-import` 投影模式所依赖的 Codex App Server `thread/inject_items` 能力
- **性质**：纯调研，未修改任何产品代码；所有实验 thread 的 cwd 均为 `/tmp/mossx-s1-spike/workdir`
- **Harness**：`docs/research/spikes/harness/s1-codex-inject-items/harness.mjs`（Node 22，stdio JSON-RPC，可重复执行）
- **证据策略**：仓库仅保留结论依赖的最小 schema subset；raw transcript / rollout excerpt 含 host metadata，仅本地留存，见 `docs/research/spikes/harness/s1-codex-inject-items/evidence/README.md`

---

## 1. 实测环境（Binary Identity）

| 项 | 值 |
|---|---|
| binary path | `/opt/homebrew/bin/codex` |
| version | `codex-cli 0.144.6` |
| sha256 | `134063e133f0b4244fa3b251acf973d4fe4b4aeeacbdc135211bf480f59f1477` |
| 平台 | macOS (darwin, arm64)，zsh |
| codexHome | `<HOME>/.codex`（initialize 响应确认，路径已脱敏） |
| 协议指纹来源 | `codex app-server generate-json-schema -o <dir>`（二进制自带 schema 导出子命令，另有 `generate-ts`） |
| schema evidence 指纹 | 仓库仅保留本次结论直接依赖的 5 个关键导出文件；可验证 SHA256 清单见 `evidence/schema-snapshot/SHA256SUMS.txt` |
| 完整 bundle | 原始导出共 267 个文件，不入库；需要 drift 复核时用同一 binary 重新运行 `generate-json-schema` |

**Capability Cache Key 建议**：`(binary_realpath, version_string, binary_sha256, ClientRequest.json_sha256)`。schema 可用同一二进制随时重新导出并比对哈希，做 drift 检测。

---

## 2. Capability Matrix（9 问逐条实测结论）

| # | 问题 | 结论 | 关键证据 |
|---|------|------|----------|
| 1 | App Server 启动与 initialize 握手 | **PASS** | `transcript-probe-*.jsonl` |
| 2 | `thread/inject_items` 是否存在 | **PASS** | schema + `transcript-badmethod-*.jsonl` |
| 3 | 支持的 Item 类型 | **PASS**（5/5 目标类型全过） | `transcript-types-*.jsonl`、`rollout-excerpt-types.md` |
| 4 | 注入是否持久化到 rollout | **PASS** | `rollout-excerpt-probe.md` 等 4 份摘录 |
| 5 | 注入后能否 read-back | **PARTIAL**（rollout 文件可读回；App Server API 读不回） | `transcript-resume-*.jsonl`、`transcript-itemslist-*.jsonl` |
| 6 | 重复注入行为与 id 分配 | **PASS**（不去重、不报错、原样追加；id 由调用方全权负责） | `rollout-excerpt-dup.md` |
| 7 | `clientUserMessageId` 关联 | **PASS** | `rollout-excerpt-canary.md` line 13 |
| 8 | 注入上下文对模型可见 | **PASS**（canary 事实 "42" 被模型准确回答） | `transcript-canary-*.jsonl`、`rollout-excerpt-canary.md` |
| 9 | Capability Cache Key identity | **PASS** | 本报告 §1 |

### Q1. 启动与握手 — PASS

- 启动命令：`codex app-server --listen stdio://`（默认即 stdio；还支持 `unix://`、`ws://IP:PORT`）。
- 传输协议：**newline-delimited JSON-RPC 2.0**（stdout 每行一个 JSON 对象；stderr 输出日志，需分离）。
- `initialize` 参数：`{ clientInfo: { name, title, version }, capabilities }`。`capabilities` 可传 `null`（最小握手实测通过）；传 `{ experimentalApi: true, requestAttestation: false }` 亦通过。
- 握手后发送 `initialized` notification（空 params）。
- initialize 响应含 `userAgent`、`codexHome`、`platformFamily`、`platformOs`。
- 关键事实：**`thread/inject_items` 在未声明 `experimentalApi` 的最小握手下依然可用**（实测 `inject without experimentalApi: {}`），即它不是 experimental-gated 方法。

### Q2. 方法存在性与 schema — PASS

- 方法名精确为 **`thread/inject_items`**（snake_case；`thread/injectItems`、`thread/inject_item`、`thread/append_items` 均返回 `-32600 unknown variant`，错误信息中枚举了全部合法方法名）。
- 参数 schema（来自 `generate-json-schema` 导出，`evidence/schema-snapshot/ThreadInjectItemsParams.json`）：

```json
{ "threadId": "string (UUID)", "items": ["Raw Responses API items (JsonValue[])"] }
```

- 官方描述原文：*"Raw Responses API items to append to the thread's model-visible history."*
- 响应：空对象 `{}`（`ThreadInjectItemsResponse = Record<string, never>`），无分配 id、无回执明细。
- 错误格式实测：
  - 缺 `items` 字段：`-32600 "missing field items"`
  - 非法 threadId：`-32600 "invalid thread id: invalid character: expected an optional prefix of urn:uuid: …"`（即 threadId 必须是 UUID，可带 `urn:uuid:` 前缀）

### Q3. 支持的 Item 类型 — PASS（目标 5 类全部实测通过）

逐条单独注入（隔离定位），全部返回 `{}` 且原样持久化（`rollout-excerpt-types.md`）：

| Item 类型 | 实测 payload 要点 | 结果 |
|---|---|---|
| `message` (user, `input_text`) | `{type:"message", role:"user", content:[{type:"input_text", text}]}` | OK，原样落盘 |
| `message` (assistant, `output_text`) | `{type:"message", role:"assistant", content:[{type:"output_text", text}]}` | OK，原样落盘 |
| `function_call` | `{type:"function_call", name, arguments, call_id}` | OK，原样落盘 |
| `function_call_output` | `{type:"function_call_output", call_id, output}` | OK，原样落盘 |
| `reasoning` | `{type:"reasoning", summary:[{type:"summary_text",…}], content:[{type:"reasoning_text",…}], encrypted_content:null}` | OK，落盘保留 summary，`encrypted_content` 保持 `null` |

协议 `ResponseItem` 类型（`evidence/schema-snapshot/ResponseItem.ts`）还定义了 `agent_message`、`local_shell_call`、`custom_tool_call(_output)`、`tool_search_call/output`、`web_search_call`、`image_generation_call`、`compaction`、`context_compaction` 等更多变体——**本次未逐一实测**，标记为"schema 声明支持、行为待复核"。

### Q4. 持久化 — PASS

- 注入的 items 以 `response_item` 记录原样追加到 thread rollout JSONL。
- rollout 路径模式：`~/.codex/sessions/YYYY/MM/DD/rollout-<ISO 时间>-<threadId>.jsonl`；`thread/start` 响应的 `thread.path` 字段直接给出准确路径（不必猜目录）。
- 摘录示例（`rollout-excerpt-probe.md` line 7）：注入的 user message 完整保留 `content`，并被自动附加 `internal_chat_message_metadata_passthrough: { turn_id: "auto-compact-0" }`——即注入项被归入一个合成 turn，而非真实用户 turn。
- `thread/start` 传 `ephemeral: false` 才有 rollout 落盘（本次全部实验均 ephemeral=false）。

### Q5. Read-back — PARTIAL

| 途径 | 结果 |
|---|---|
| 直接读 rollout 文件 | **可用**：注入项完整可读（见 Q4） |
| `thread/resume` + `thread/read { includeTurns: true }` | **读不回**：resume 成功，但 `turns=0`，注入项不渲染为 turn item |
| `thread/turns/list` | 方法存在，返回空 `data: []` |
| `thread/items/list` | 返回 `-32601 "thread/items/list is not supported yet"`（协议已预留、实现未落地） |

结论：注入项进入的是 **model-visible history**（模型上下文），不进入 **UI-visible turn items**。mossx 若需要向用户展示已注入历史，数据源只能是 rollout 文件（或自建注入台账），不能依赖 App Server 读回 API。`thread/items/list` 是未来升级后值得复测的口子。

### Q6. 重复注入与 id 分配 — PASS（行为已明确）

实测（`rollout-excerpt-dup.md`）：

- 同一 item（含相同调用方指定 `id: "msg_s1spike_dup_001"`）注入两次 → 两次均返回 `{}`，rollout 中出现 **两条完全相同的记录**，**无去重、无报错**。
- 不带 `id` 的 item 注入两次 → 同样原样追加两条，且 rollout 中 **id 保持缺失**（server 不补发 id）。
- 结论：**幂等性责任完全在调用方**。mossx ContextCompiler 必须自建注入去重（例如以 `(threadId, item_hash)` 台账），否则重试会产生重复历史。

### Q7. `clientUserMessageId` 关联 — PASS

- `turn/start` 参数 schema 确认存在 `clientUserMessageId?: string | null`。
- 实测传入 `cum_s1spike_canary_001` 后，rollout 落盘为 `event_msg` 记录：`{"type":"user_message", "client_id":"cum_s1spike_canary_001", "message":…}`（`rollout-excerpt-canary.md` line 13）。
- 同一 turn 的 user message `response_item` 携带 `internal_chat_message_metadata_passthrough.turn_id = <turn UUID>`，assistant 回答落盘为 `event_msg {type:"agent_message"}` + `task_complete {turn_id, last_agent_message}`。
- 关联链：`client_id`（event_msg.user_message）→ 同 turn 的 `response_item`（turn_id）→ `task_complete`（turn_id）。三段可拼出 user item ↔ response 的对应关系。

### Q8. 注入上下文对模型可见 — PASS（关键问题）

实验（仅消耗 1 个 trivial turn，24,478 input tokens / 5 output tokens）：

1. 注入两条 items：user「请记住：MOSSX_CANARY_7F3A 是一个数字，它的值是 42」+ assistant「好的，我已经记住…」。
2. 随后 `turn/start` 提问「MOSSX_CANARY_7F3A 的值是多少？只回答数字本身」。
3. 模型回答：**`42`**（`item/agentMessage/delta` 通知与 rollout `agent_message` 均为 "42"）。

这是模型不可能先验知道的事实，证明注入项真实进入了 model-visible history。schema 描述与实际行为一致。

### Q9. Cache Key identity — PASS

见 §1。补充：`codex app-server --help` 自含 `generate-json-schema` / `generate-ts` 子命令，schema 指纹获取不依赖外部文档，可作为 CI 中的 drift 检测步骤。

---

## 3. 对 `native-history-import` 模式的 go/no-go 结论

**GO（有条件）**。`thread/inject_items` 在 codex-cli 0.144.6 上真实存在、行为符合 `native-history-import` 的核心假设：结构化 Responses API items 可被追加进目标 thread 的 model-visible history、原样持久化到 rollout、且后续 turn 的模型确实能"看到"注入内容。

约束条件（必须纳入设计）：

1. **幂等自建**：server 不去重、不分配 id、不重写调用方 id。ContextCompiler 必须维护注入台账 `(threadId, item_fingerprint)`，重放安全由 mossx 侧保证。
2. **读回只能靠 rollout 文件**：App Server 当前无任何 API 能读回注入项（`thread/items/list` 未实现）。注入结果的校验与展示数据源自建或解析 rollout JSONL（`thread/start`/`thread/resume` 响应的 `thread.path` 给出准确路径）。
3. **注入项不属于真实 turn**：落盘时被挂到合成 `turn_id: "auto-compact-0"`，不会出现在 `thread/read` 的 turns 视图中——UI 层不要指望它渲染为对话气泡。
4. **握手零门槛**：stdio JSON-RPC + `initialize`（capabilities 可为 null）+ `initialized` 即可用，无需 experimental flag；但 schema 标注 `[experimental]`，跨版本必须做 capability 探测而非假设存在。
5. **threadId 格式**：必须是 UUID（可带 `urn:uuid:` 前缀），非法 id 在调用时即报错。
6. **成本控制**：探测时 `approvalPolicy: "never"` + `sandbox: "read-only"`（turn 级为 `sandboxPolicy: {type:"readOnly", networkAccess:false}`）可完全避免交互阻塞。

---

## 4. 已知风险与待 Wave 5 复核事项

| 风险 | 说明 | 复核动作 |
|---|---|---|
| schema 标记 experimental | `app-server`、`generate-json-schema`、`generate-ts` 均标 `[experimental]`，方法集可能随版本漂移 | Wave 5 用 cache key 中的 `ClientRequest.json` sha256 做 drift 检测；升级 codex 后重跑 `harness.mjs probe` |
| 未实测的 item 变体 | `local_shell_call`、`custom_tool_call*`、`tool_search_*`、`web_search_call`、`image_generation_call`、`compaction`、`context_compaction`、`agent_message` 仅 schema 声明支持 | 若 ContextCompiler 投影需要这些类型，补一轮 types 实验 |
| `thread/items/list` 未实现 | 返回 `-32601 not supported yet`；未来版本落地后读回能力可从 PARTIAL 升级为 PASS | 每次升级后重跑 itemslist 探测 |
| 注入项的 turn 归属语义 | `auto-compact-0` 合成 turn 的语义（是否参与 auto-compact、token 计费）未深挖 | 长会话注入场景压测时观察 compact 行为 |
| 多 turn 后注入时序 | 本次均在 turn 之前注入；turn 进行中注入的行为（是否阻塞/乱序）未测 | 若设计允许运行中注入，补测并发场景 |
| rollout 文件格式稳定性 | 读回依赖 `response_item`/`event_msg` 记录格式，属内部格式 | drift 检测时顺带校验 rollout 摘录解析脚本 |

---

## 附：复现指引

```bash
# 环境：codex-cli 0.144.6 已登录（~/.codex/auth.json）
node docs/research/spikes/harness/s1-codex-inject-items/harness.mjs probe       # Q1/Q2/Q4 冒烟
node docs/research/spikes/harness/s1-codex-inject-items/harness.mjs types       # Q3
node docs/research/spikes/harness/s1-codex-inject-items/harness.mjs dup         # Q6
node docs/research/spikes/harness/s1-codex-inject-items/harness.mjs badmethod   # Q2 错误格式
node docs/research/spikes/harness/s1-codex-inject-items/harness.mjs resume <threadId>  # Q5
node docs/research/spikes/harness/s1-codex-inject-items/harness.mjs canary      # Q7/Q8（消耗 1 次 API 调用）
```

transcript 默认写入 `/tmp/mossx-s1-spike/evidence/`；raw capture 不入库。
