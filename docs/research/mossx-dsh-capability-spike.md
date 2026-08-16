---
type: research
status: draft
---

<!-- DOC-LIFECYCLE: draft-spike -->
> [!NOTE]
> **Lifecycle: Phase S Capability Spike.** 不是产品 contract。Adapter contract 以本文件实测为准。
> 上游：[`mossx-dsh-engine-onboarding-execution.md`](./mossx-dsh-engine-onboarding-execution.md)

# DSH Capability Spike

> 日期：2026-08-15
> CLI：`dsh` `@deepseek-ai/dsh@0.1.0-rc.6`（全局 bin `/Users/zhukunpeng/.hermes/node/bin/dsh`）
> Node：`v22.22.3`（满足 `^22.19.0 || >=24.0.0`）
> Host：已有用户进程 `node` 监听 `127.0.0.1:3080`（mossx 应 **adopt**，不要杀）
> Host API `host.describe.version`：`0.0.1`（这是 host schema 版本，不是 CLI 版本）
> 分档结论：**L2 Native**；**不进 Shared**

---

## 1. Binary / 协议身份

| 项 | 证据 |
|---|---|
| Binary | `dsh --version` → `0.1.0-rc.6` |
| 安装 | npm global `@deepseek-ai/dsh`；npx 冷启动未测（doctor 优先全局 bin） |
| Unary | `POST /api/<method>` + `{"type":"client-request","rpcId","method","payload"}` |
| Unary 响应 | `{"type":"server-response","rpcId","result":{"ok":true,"value":…} \| {"ok":false,"error":{code,message,details}}}` |
| Live | **WebSocket** `ws://127.0.0.1:3080/api/events.mux` 与 `…/events.host` |
| Live 纠偏 | 执行文档写的是 WS；本地 deepseek-harness 源码 fetch handler 是 SSE。**已安装 0.1.0-rc.6 对裸 GET 返回 `426 Upgrade Required` + `upgrade: websocket`。mossx client 必须以 WS 为准。** |
| 探活 | 只信 `host.describe`，不信 TCP connect |

`host.describe` 200 片段：

```json
{"ok":true,"value":{"version":"0.0.1","cwd":"/Users/zhukunpeng","provider":"grok","model":"grok-4.6","attachedSessions":31,"canOpenPath":true}}
```

`protocolFamily = dsh-host-rpc`；`executionModel = persistent`。

---

## 2. Session / workspace

`workspace.create({ path })`：

- 目录必须已存在；`/tmp/mossx-dsh-spike` 首次 `created: true`，再次同一 path `created: false`，同一 `workspaceId`。
- 已有 `desktop-cc-gui` workspace 再次 create → `created: false`，`workspaceId=8f85242f-e2ca-430d-ba1f-b90a492ccc18`。

`session.create({ workspaceId })`：

- 立即返回真实 `sessionId`（例：`session-b2d5e57c-4e71-4b54-9bfd-a0e5d97e9140`）+ `agentPreset`。
- 同 `sessionId` + 同 workspace 再 create 幂等。
- **与 Kimi 不同**：canonical id 在 create 时已知。`dsh-pending-*` 只用于 create 返回前的 optimistic UI，禁止再造假 UUID 当 canonical。

mossx thread：

```text
canonical : dsh:<dshSessionId>
pending   : dsh-pending-<uuid>
```

`sessionResume = supported`（同一 sessionId + history / 再 prompt，不 resume agent）。

`session.fork`：

- 无 completed turn → `fork-unavailable`。
- 对已完成会话 `session-d4343f90-…` fork → 新 `sessionId`（实测 `session-d52547d8-…`）。
- 子 session 继承 cwd / 已完成 turn 前缀。→ `session.fork = supported`；L3 NativeHistoryReader 仍后置。

---

## 3. ACK / Terminal / Cancel

| 阶段 | 实测 |
|---|---|
| Input ACK | `session.prompt` → `{ accepted: true }`。**不是** turn 结束。`inputAck = request-response` |
| slash command | 协议文档：同响应 `command` slot。本 spike 未发 `/` 命令。 |
| Run started | history/mux：`turn/start` 或首条 `assistant/chunk` |
| Terminal | `turn/end` + `data.reason.kind`（已见 `completed`）。HTTP 200 / host 仍活 ≠ terminal |
| Cancel | `session.cancel` → `{ accepted: true }`。须再等 `turn/end`（cancelled/aborted） |
| Cleanup | host 进程继续活着是正常的 |

`pendingProbe`：`session.history` / `session.list` 按 sessionId 回读。history **不 resume agent**（源码注释 + 冷 session 可读）。

host 崩溃 ≠ turn 失败：ensure_host + 再读 history。

---

## 4. Live mux

WS 打开后立刻推 `session/subscribed { sessionId, lastSeq }`（每个 attached session 一条）。

Mux frame types（源码 `events.schema.ts` + 已连接证实 subscribed）：

- `session/event`（内嵌 `SessionEvent`）
- `session/subscribed`
- `approval/requested` / `approval/resolved`
- `question/requested` / `question/resolved`
- `session/queue`
- `session/jobs`
- `session/projection`
- `stream/error`

已完成会话 history 事件类型（`session-d4343f90-…`，`maxMessages: 40` 拉到 8079 条 raw events，`hasMore: true`）：

`assistant/chunk` · `assistant/message` · `tool/call` · `tool/result` · `step/start` · `step/end` · `user/message` · `agent/inbox/spliced` · `turn/start` · `turn/end` · `goal/change` · `llm/retry` · `command/run` · `command/done` · `permission/preset` · `sandbox/mode` · `approval/policy` · `web/deepseek-search-llm-request`

`assistant/chunk.data.chunk` 是 block 流（见 `block-start` / `tool-call`）。未知 type **skip**。

审批：默认 `approval/policy=ask`。mossx 必须 `POST /api/respond` 回 mux 上 `approval/requested` / `question/requested` 的 `rpcId`。不回 → 工具永远 pending。UI 只挂现有 elicitation 卡。

---

## 5. Models

`llm.models` 在已配 key 的 host 上非空。groups：

- `deepseek-official` / DeepSeek：`deepseek-v4-flash`、`deepseek-v4-pro`（reasoning `off|high|max`，default `high`）
- `vision-http` / Vision HTTP：`ovh/Qwen2.5-VL-72B-Instruct`（无 reasoning 块）
- `grok` / grok-4.6：`grok-4.5`、`grok-4.6`
- `failures: []`

`session.selectModel({ sessionId, provider, model, reasoningEffort })` 实测：

```json
{"selected":{"provider":"deepseek-official","model":"deepseek-v4-flash","reasoningEffort":"off"}}
```

`session.models` 返回 `current` + 同结构 groups。

mossx catalog 映射：

- `id` = `${provider}/${model}`（例 `deepseek-official/deepseek-v4-flash`）
- `displayName` = `${group.name} / ${model.name}`
- `provider` = DSH provider route
- `model` = DSH model id
- catalog advisory：发送仍走 `session.selectModel`

空目录三种合法原因（UI 必须分开）：host 没起来 / 用户没在 DSH Settings 配 key / `failures[]`。

`imageLimits` 在 session.list / history projections：png/jpeg/webp/gif，20MB/张。`image.input = conditional`（看所选模型 + 这组 limits）。

`reasoning.effort = conditional`（catalog `reasoning.efforts`）。

---

## 6. Usage

history / session.list 尾页 `projections.values.tokenUsage`：

```json
{"uncachedInputTokens":744288,"outputTokens":34735,"cacheReadTokens":4017920,"cacheWriteTokens":0}
```

另有 `contextPressure` / `contextBreakdown` / `sessionStats`。第一期可把 tokenUsage 投到通用 usage 卡，不做 ClaudeContextCard 级专属卡。

---

## 7. Capability 填表（15 key）

| key | 首期 | 依据 |
|---|---|---|
| streaming.text | supported | mux/history `assistant/chunk` |
| streaming.reasoning | supported | chunk 可含 reasoning block；未知 skip |
| streaming.tool-output | supported | `tool/call` + `tool/result` |
| tool.use | supported | DSH 自管工具 |
| tool.mcp | unknown | DSH 自管，mossx 不暴露 |
| reasoning.effort | supported | catalog + `selectModel` 实测 |
| collaboration.mode | unsupported | 无 mossx collab 协议 |
| session.continuation | unsupported | L3 后置 |
| image.input | supported | `PromptContentPart.image` + imageLimits |
| input.mid-turn | supported | `mode: "steer"` 协议存在；第一期发 `queue`，steer 可后接 |
| session.resume | supported | 同 sessionId + history |
| session.fork | supported | 完成 turn 后 fork 成功 |
| session.switch | unsupported | 不在 mossx 暴露 |
| session.tree | unknown | `parentSessionId` 存在于 fork/subagent；第一期不当 tree UI |
| rpc.server | unsupported | 我们是 host 的 client |

Shared：不进 `SHARED_SESSION_SUPPORTED_ENGINES`。Shared picker 显示 unsupported reason，禁止 normalize 成 claude。

---

## 8. 不做（spike 确认）

- 不调 `settings.*` / `credentials.*` / `llm.discoverModels`（特权方法）
- 不内嵌 DSH Web UI
- 不用 ACP / headless / Python SDK 发主对话
- 不写 `$DSH_HOME/settings.yaml` / `.credentials.yaml`

---

## 9. 对 Adapter contract 的冻结结论

1. mossx 全应用 **一个** DSH host；`ensure_dsh_host`：probe describe → adopt，否则 spawn `dsh web --host 127.0.0.1 --port <n>`。
2. 只杀 `spawned`，不杀 `adopted`。
3. 打开 mossx workspace 时 `workspace.create({ path })` 幂等绑定。
4. 新建会话 `session.create({ workspaceId })`，threadId = `dsh:` + 返回的 sessionId。
5. 发消息：可选 `selectModel` → `session.prompt({ mode: "queue", content })` → 等 mux `turn/end`。
6. Live 走 WS mux；delta 进 `liveAssistantTextChannel` / `liveItemDeltaChannel`。
7. 审批 / 提问走现有 elicitation + `/api/respond`。
