---
type: research
status: draft
---

<!-- DOC-LIFECYCLE: draft-execution-plan -->
> [!IMPORTANT]
> **Lifecycle: Draft execution plan，不是 current product contract。**
> 实现前必须先开 OpenSpec change，再按本文落地。行为事实源仍是 OpenSpec + 代码。
> 上游契约：
> - [`mossx-new-cli-onboarding-guide.md`](./mossx-new-cli-onboarding-guide.md)（§0 全量接入矩阵）
> - [`mossx-multi-cli-provider-session-foundation-design.md`](./mossx-multi-cli-provider-session-foundation-design.md)（基石设计）
> 参照样例：`openspec/changes/archive/2026-07-24-add-kimi-engine/`

# mossx 接入 DeepSeek Harness（DSH）执行文档

> 日期：2026-08-15
> 适用读者：下一场对话里实际写代码的工程师 / agent
> 目标：把 DSH 接成 mossx 第 7 个 **Native Engine**，不内嵌 DSH Web UI，交互面与其他 CLI 一致
> 上游版本锚点：本地竞品仓库 `CC GUI 竞品参考/deepseek-harness`，`@deepseek-ai/dsh` `0.1.0-rc.5`（developer preview，协议可能破）

---

## 0. 下一场对话怎么用这份文档

开新对话后，按这个顺序执行，**不要跳过 Phase 0 / Phase S**：

1. 读本文件全文 + onboarding guide §0 矩阵。
2. 用真实 `dsh web` 做 Phase S 实测，把第 4 节表格里的「待实测」改成带证据的结论。
3. 创建 OpenSpec change：`openspec/changes/add-dsh-engine/`（proposal / design / tasks / spec delta）。
4. 按本文第 8 节 **P0 → P6** 落地。
5. 每层做完跑该层自检；收口前跑第 10 节验收，并回写基石设计「零、当前实现校准」。

禁止：

- 把 DSH 做成 vendor preset / `ANTHROPIC_BASE_URL` 中转
- iframe / webview 内嵌 DSH Web UI
- 在 mossx 里重做 DSH 的 Models / credentials 配置页
- 第一期把 DSH 放进 Shared Session
- 把 ACP / headless / Python SDK 当主协议
- 每个 mossx workspace spawn 一个 `dsh web`

---

## 1. 已拍板决策（不要再争论）

| # | 决策 | 含义 |
|---|---|---|
| D1 | DSH 是 **Engine**，不是 Provider | mossx 选择器里出现「DeepSeek Harness / DSH」。Anthropic / OpenAI / DeepSeek / 自定义网关是 DSH 内部的 provider |
| D2 | 配置归 DSH | key、base URL、catalog、自定义 provider 由用户在 DSH Web UI 或 `$DSH_HOME` 完成。mossx 第一期只做薄连接设置 |
| D3 | 模型列表读 DSH host API | `POST /api/llm.models`。不是刮网页，也不是 mossx 静态 catalog |
| D4 | mossx **自动拉起 / 复用** `dsh web` | 类似 Codex persistent runtime。探测已有 host；没有再 spawn |
| D5 | **Native DSH session** | mossx thread 直接映射 DSH `sessionId`。侧栏 / 历史 / resume / fork 与 DSH Web UI 看同一批会话 |
| D6 | 全应用 **一个** DSH host | 一个 Node 进程管全部 workspace / session。不要按 Codex「每 workspace 一个 runtime」复制 |
| D7 | 第一期只做 Native，**不进 Shared** | 与 Gemini 同类：引擎可选，Shared Target Picker 里 disabled 并给 reason |
| D8 | 第一期目标档位 **L2 Native** | create / list / history / fork / cancel / live mux / 审批桥。L3 Continuation、Shared 后置 |
| D9 | 新协议族 | registry 增加 `dsh-host-rpc`（或等价 kebab-case），`executionModel: persistent` |

产品一句话：

> mossx 负责发现/拉起 `dsh web`，用 Host RPC 当第二个 client；用户去 DSH Web UI 配模型；选中 DSH 后，mossx 的 composer / 侧栏 / 幕布像其他 CLI 一样工作。

---

## 2. 正确心智模型

```text
mossx UI (composer / sidebar / curtain)
        │
        │ Tauri commands
        ▼
mossx Rust DSH adapter
        │  ensure_host()
        │  POST /api/<method>
        │  WS  /api/events.mux
        │  WS  /api/events.host
        ▼
dsh web  (一个持久 Node 进程, 默认 127.0.0.1:3080)
        │
        ├─ Web UI client          ← 用户配模型 / key（我们不内嵌）
        ├─ Host RPC               ← mossx 用这条
        ├─ $DSH_HOME/settings.yaml
        └─ $DSH_HOME/.credentials.yaml
```

三层正交，禁止压成一个字符串：

| 层 | 谁拥有 | 例子 |
|---|---|---|
| Engine | mossx | `dsh` |
| DSH Provider | DSH | `deepseek-official` / `anthropic` / `openai` / 自定义 route |
| Model | DSH catalog | `deepseek-v4-flash` / `claude-sonnet-4-5` |

mossx 模型下拉应对 DSH 的 `{ provider, model }` 二元组，而不是只显示 model id。

---

## 3. DSH 运行形态（代码事实）

### 3.1 CLI

发布包：`@deepseek-ai/dsh`，bin 名 `dsh`。

| 命令 | 用途 | 能否当主引擎 |
|---|---|---|
| `dsh web` / `dsh --profile web` | 启动 web profile + HTTP host | **能，主路径** |
| `dsh --profile headless "job"` | 一轮退出，无 server | 不能 |
| `dsh plugin --profile <name> …` | 给 profile 装插件 | 辅助 |
| ACP demo / `@deepseek-ai/dsh-acp` | stdio ACP，无模型选择器 / list / resume | 不能当主路径 |
| SDK JSON-RPC | 调用方自带 model，无 catalog | 不能当主路径 |

安装渠道（第一期按 npm 处理）：

```sh
npx @deepseek-ai/dsh web
# 或全局
npm i -g @deepseek-ai/dsh
dsh web --port 3080
```

Node 要求（上游 `package.json`）：`^22.19.0 || >=24.0.0`。doctor 必须检查。

### 3.2 Home 与配置

| 路径 | 内容 |
|---|---|
| `$DSH_HOME` 或 `~/.dsh` | harness home |
| `$DSH_HOME/settings.yaml` | provider / model / UI 偏好 |
| `$DSH_HOME/.credentials.yaml` | write-only secrets |
| `$DSH_HOME/profiles/web/` | web profile（首次 `dsh web` 自动初始化） |
| `$DSH_HOME/AGENTS.md` | DSH 自己的全局 agent 指令 |

mossx **不要写** credentials / settings.yaml。最多：

- 解析 `dsh` 二进制
- 记 host/port
- 提供「在浏览器打开 DSH Settings」

### 3.3 Web host 启动参数

`dsh web` 自己的 flag（launcher flag 必须写在前面）：

```sh
dsh web --port 3080
dsh web --host 127.0.0.1
dsh --profile web --port 0          # OS 选空闲端口
```

事实：

- 默认 port `3080`（`packages/bundle/web-app/cordis.patch.yml`）
- CLI **拒绝** `--host 0.0.0.0`（当前不支持 bind-all）
- 启动成功后打印 `dsh web: http://127.0.0.1:<port>`
- `/api` 默认信任 loopback。`llm.models` / `session.*` 可从 loopback 调用
- `settings.*` / `credentials.*` / `llm.discoverModels` 是特权方法，只给 loopback 同源。mossx 第一期不要调它们

### 3.4 Host RPC（主协议）

Unary：

```http
POST /api/<method>
Content-Type: application/json

{
  "type": "client-request",
  "rpcId": "<uuid>",
  "method": "<method>",
  "payload": { ... }
}
```

HTTP 响应：

```json
{
  "type": "server-response",
  "rpcId": "<same>",
  "result": { "ok": ... } | { "error": { "code": "...", "message": "...", "details": {} } }
}
```

方法（来自 `packages/host/apiproxy/src/api/rpc-map.ts`）：

| Method | 第一期是否必须 | 用途 |
|---|---|---|
| `host.describe` | 必须 | 探活、拿 version / cwd |
| `llm.models` | 必须 | host 级模型目录 |
| `llm.providers` | 建议 | 配置态 / 空目录诊断 |
| `workspace.list` | 必须 | 列 DSH workspace |
| `workspace.create` | 必须 | `{ path }` 幂等认领已存在目录 |
| `session.list` | 必须 | 全部 session 摘要 |
| `session.create` | 必须 | `{ workspaceId }` 或 `{ cwd }` |
| `session.history` | 必须 | 分页事件 + 尾页 projections |
| `session.prompt` | 必须 | `{ sessionId, mode: "queue"\|"steer", content }` |
| `session.selectModel` | 必须 | `{ sessionId, provider, model, reasoningEffort? }` |
| `session.cancel` | 必须 | 停当前 turn |
| `session.fork` | 建议 | Native fork |
| `session.rename` | 建议 | 侧栏标题 |
| `session.attachment` | 按需 | 读已入日志的图 |
| `subagent.list/history/prompt/interrupt` | 第二期 | DSH 自己的 subagent |
| `settings.*` / `credentials.*` / `llm.discoverModels` | 禁止（P1） | 配置仍归 DSH UI |

实时：

| Path | 用途 |
|---|---|
| `WS /api/events.mux` | 全 session 事件 + 审批/提问 + queue 快照 |
| `WS /api/events.host` | session 创建/销毁、running 翻转、无 turn 的 agent 失败 |

回答 server-request：

```http
POST /api/respond
```

回显 mux 里 `approval/requested` / `question/requested` 的 `rpcId`。

### 3.5 模型目录形状

`llm.models` 返回（session 无关）：

```ts
{
  groups: Array<{
    id: string          // provider route，如 deepseek-official
    name: string
    models: Array<{
      id: string
      name: string
      description?: string
      reasoning?: { efforts: Array<{ id: string; name: string }>; defaultEffort?: string }
    }>
  }>
  failures: Array<{ id: string; name: string; message: string }>
}
```

映射到 mossx `EngineModelInfo` 时建议：

- `id` = `${provider}/${model}` 或保留二元组并在发送时拆开
- `displayName` = `${providerName} / ${model.name}`
- `provider` = DSH provider route
- catalog 是 advisory：未列出的 model 仍可能可用。选择器以 groups 为准，发送时走 `session.selectModel`

空目录的合法原因：

1. host 没起来
2. 用户还没在 DSH Settings → Models 配任何 key
3. 某个 provider 的 `failures[]` 有诊断

UI 要区分这三种，不要显示「引擎未安装」。

### 3.6 Session / workspace 身份

DSH workspace = 已存在目录的稳定 id + title + `sessionIds[]`。

`workspace.create({ path })`：

- 目录必须已存在（不做 mkdir）
- 同一 canonical path 再次调用返回已有 workspace，`created: false`

`session.create`：

- 只能带 `workspaceId` **或** `cwd` 之一
- 可预分配 `sessionId`；同 id + 同 cwd 幂等；cwd 不同则 `session-conflict`
- 省略项目时用 host 进程 cwd —— **mossx 禁止走这条**，必须先 `workspace.create(mossxWorkspacePath)`

mossx thread id 约定（第一期冻结）：

```text
canonical : dsh:<dshSessionId>
pending   : dsh-pending-<uuid>
```

`inferEngineFromLegacyThreadId` 只要 `engineIds.json` 含 `dsh`，前缀规则会自动认。但大量 **硬编码** `kimi:` / `opencode:` if 链不会自动覆盖，见第 7 节。

history loader factory 漏加 `dsh:` 会 **静默落到 Codex loader**。这是已知事故模式。

### 3.7 ACK / Terminal（按文档的协议语义，Phase S 必须实测）

| 阶段 | 协议证据 | 不能当成 |
|---|---|---|
| Input ACK | `session.prompt` 返回 `{ accepted: true }` | turn 结束 |
| slash command | 同响应里的 `command` slot | model turn |
| Run started | mux `turn/start` 或第一条 `assistant/chunk` | process spawn |
| Terminal | mux `turn/end` | HTTP 200、进程还活着 |
| Cancel | `session.cancel` → `{ accepted: true }`，再等 turn 以 cancelled 结算 | 立刻当 completed |
| Cleanup | host 进程继续活着是正常的 | 不要等进程退出 |

建议 `inputAck = "request-response"`（以 `accepted: true` 为准）。  
`pendingProbe`：用 `session.history` / `session.list` 按 `sessionId` 回读。  
host 崩溃 ≠ turn 失败；要走 ensure_host + 再读 history。

审批 / 提问：

- mux：`approval/requested`、`question/requested`
- mossx 必须回 `POST /api/respond`
- 不回会导致 DSH 工具永远 pending
- 复用现有 `RequestUserInputMessage` / 审批卡，禁止为 DSH 再做一套弹层

---

## 4. Phase S Capability Spike（写产品代码前必做）

对照 onboarding guide §2.1。下面是预填 + 必须实测的格子。

| 维度 | 预研结论 | 必须实测的证据 | RuntimeCapabilities |
|---|---|---|---|
| Binary | `dsh`，`@deepseek-ai/dsh` | `dsh --version` 输出；npx 与全局 bin 差异 | — |
| 协议 | HTTP Host RPC + WS mux/host | 对 live host 打 `host.describe`、`llm.models` | protocolFamily=`dsh-host-rpc` |
| Session create | `session.create({ workspaceId })` | 返回 sessionId；重复 id 的幂等/冲突 | native session |
| Resume | 同一 sessionId + history / 再 prompt | 重启 mossx 后打开同一 `dsh:<id>` | sessionResume=supported |
| Fork | `session.fork({ sessionId, atSeq? })` | 子 session 继承 cwd / model | native-history-clone 候选 |
| Input | `session.prompt` content parts：text + image | 纯文本；带图（若模型声明 image） | imageInput 按 catalog |
| Live | mux `session/event` | 记录 event type 清单 | streaming=supported |
| Input ACK | `{ accepted: true }` | 抓一条真实响应 | inputAck=request-response |
| Terminal | `turn/end` | 与 accepted 不是同一时刻 | typed final |
| Cancel | `session.cancel` | 进行中 turn 的结算码 | pendingCancel |
| History | `session.history` | 冷 session 能否不 resume agent 就读 | history import=unsupported；read=supported |
| Models | `llm.models` | 配 1 个 DeepSeek key 后 groups 非空 | — |
| Reasoning | model.reasoning.efforts | 选 effort 后 `selectModel` 是否生效 | reasoningEffort=conditional |
| Approval | mux + `/api/respond` | 一次工具批准闭环 | user-input elicitation |
| Usage | 待查 token-meter projection | history 尾页 / mux projection 是否有 tokenUsage | usage 按实测 |
| Shared | 第一期不做 | 写决策记录即可 | 不进 SHARED 集合 |

Spike 产出物（单独短文或写进 change design）：

```text
docs/research/mossx-dsh-capability-spike.md
```

必须带：命令、响应片段、DSH 版本、分档结论（L2 Native / 不进 Shared）。

---

## 5. mossx 侧目标架构

### 5.1 新 ident

| 字段 | 值 |
|---|---|
| engine id | `dsh` |
| displayName | `DeepSeek Harness` |
| shortName | `DSH` |
| adapterId | `builtin.dsh` |
| protocolFamily | `dsh-host-rpc` |
| executionModel | `persistent` |
| capabilityProfile | `dsh` |
| thread prefix | `dsh:` / `dsh-pending-` |
| serde | `"dsh"` |

### 5.2 Host supervisor（最像 Codex，但全局单例）

伪代码：

```text
ensure_dsh_host(settings) -> DshHostHandle
  1. 若已有 owned 或 adopted handle 且 host.describe 成功 → 复用
  2. probe settings.dsh_host (default 127.0.0.1:3080)
  3. 若 describe 成功 → adopt（不杀别人的进程）
  4. 否则 resolve dsh bin（settings.dsh_bin / PATH / npx）
  5. spawn: dsh web --host 127.0.0.1 --port <chosen>
  6. 读 stdout 里的 `dsh web: http://...` 或轮询 describe，超时失败
  7. 记下 ownership = spawned | adopted
```

规则：

- mossx 退出：只杀 `spawned`，不杀 `adopted`
- 3080 被非 DSH 占用：换 port 或报错，不要误连
- 探活只信 `host.describe`，不要只信 TCP connect
- 不要为每个 workspace spawn
- Windows / PATH / npx 解析复用现有 `build_codex_path_env` / `find_cli_binary` 思路

建议设置字段（第一期）：

```text
dshBin: string | null
dshHost: string        // default 127.0.0.1
dshPort: number        // default 3080
dshAutoStart: bool     // default true（已拍板 D4）
```

### 5.3 每个 mossx workspace 的绑定

```text
open mossx workspace W (path P)
  host = ensure_dsh_host()
  ws = workspace.create({ path: P })     // 幂等
  persist mapping: mossxWorkspaceId -> dshWorkspaceId
  rows = session.list()
  show rows whose id ∈ ws.sessionIds && !archived
```

新建会话：

```text
session.create({ workspaceId: dshWorkspaceId })
threadId = "dsh:" + sessionId
```

发消息：

```text
ensure host + mux subscribed
if model changed: session.selectModel({ sessionId, provider, model, reasoningEffort? })
session.prompt({ sessionId, mode: "queue", content: [{ type:"text", text }] })
wait mux until turn/end
```

steer（第二期可接 mossx 已有 steer）：`mode: "steer"`。

### 5.4 事件投影

Rust 不要直接把 DSH `SessionEvent` 扔给前端。收敛在：

```text
src-tauri/src/engine/dsh/
  host.rs              // HTTP + WS client
  supervisor.rs        // ensure / adopt / spawn / drop
  session.rs           // create/list/prompt/cancel/history
  events.rs            // mux → EngineEvent
  history.rs           // list/load/delete?（DSH 删除可能是 archive）
  provider_profile.rs  // 第一期可做空实现 / 单 local sentinel
```

前端：

```text
src/features/threads/adapters/dshRealtimeAdapter.ts
src/features/threads/loaders/dshHistoryLoader.ts
```

归一到现有 `NormalizedThreadEvent`：

`run:start / turn:start / message:delta / tool:start|update|end / turn:end / run.settled / requestUserInput`

delta 必须走 `liveAssistantTextChannel` / `liveItemDeltaChannel`，禁止每 chunk 打根 reducer。

DSH 私有 event 名登记到 `NORMALIZED_EVENT_DICTIONARY`。未知 type skip，不要炸。

### 5.5 模型选择

`get_engine_models(Dsh)`：

1. ensure host
2. `llm.models`
3. flatten groups；失败的 provider 进 status.error / 诊断，不要让整个列表失败

composer：

- `AVAILABLE_PROVIDERS` 加 `dsh`
- `engineToProvider('dsh') = 'dsh'`
- 选模型时带上 DSH provider route
- 未配置模型时 composer 禁用发送，文案指向「打开 DSH Settings」

### 5.6 CLI 生命周期

`CliInstallEngine` 增加 `Dsh`：

- 包名：`@deepseek-ai/dsh@latest`
- bin：`dsh`
- 策略：npm global（与 Kimi/Codex 同类）
- doctor：`dsh --version` + `host.describe`（host 没起来不算 CLI 没装）
- 卸载：产品 UI 仍默认隐藏 uninstall，但 installer enum 要能编过

---

## 6. 明确不做（写进 OpenSpec 非目标）

1. 内嵌 DSH Web UI / 反向把 mossx 当 DSH client plugin
2. mossx 内配置 DSH providers / API key / base URL
3. 调用 `settings.*` / `credentials.*` 写 DSH home
4. 用 ACP / headless / Python SDK 发主对话
5. Shared Session / Squad / Provider Continuation（L3）
6. 把 DSH 的 workspace 列表替代 mossx workspace 系统
7. 为 DSH 单独做一套审批 UI
8. 每个 workspace 一个 `dsh web`
9. 手改 DSH session 文件注入历史
10. 在内核到处加 `if engine == "dsh"`（能进 adapter / capability 的不要散落；前缀白名单除外，那些是历史债，按矩阵 ⚠ 逐条加）

---

## 7. 全量接入点核对（执行时逐行勾）

完整文件表见 onboarding guide §0。这里只标 **DSH 特有注意点**。漏 ⚠ 不会编译失败，只会静默缺功能。

### A. Identity

| # | 动作 | DSH 注意 |
|---|---|---|
| A1 🔴 | `src/types/engine.ts` `EngineType` + `"dsh"` | |
| A2 🔴 | `src/features/engine/engineIds.json` | 加完整 entry，含 `dsh-host-rpc` |
| A3 🔴 | `engineRegistry.ts` 扩 `EngineProtocolFamily` | 前后端 union 一起改 |
| A4 🔴 | `src-tauri/src/engine/mod.rs` | 禁止 `_ => unreachable!()` |
| A5 🔴 | daemon `engine_bridge.rs` | 主 crate 绿 ≠ daemon 绿 |
| A6 🔴 | `adapter_registry.rs` | `BuiltinEngineProtocol::family()` 现在只有 Codex vs 其他。必须给 DSH 第三条臂，否则会谎报 `stream-json-cli` |

### B. Rust runtime

| # | 动作 | DSH 注意 |
|---|---|---|
| B1–B4 🔴 | manager / status / commands / events | `get_engine_models` 走 host，不走本地 config.toml |
| B5 ⚠ | `list_dsh_sessions` / `load_dsh_session` / delete-or-archive | 删不了就 archive + 文档说明 |
| B6 🔴 | `add_workspace` | 不要因没检测到 `dsh` 就拒绝加 workspace；host 可后启 |
| B7 ⚠ | 启动预热 | 可 lazy，第一次选 DSH 再 ensure_host |
| B8 ⚠ | session_management `get_engine_config` | 返回 bin/host/port |
| B9 🔵 | 默认启用 | 建议默认可见，未安装时 not-installed |
| B10 🔴 | `engine/dsh/` 四件套 | host client 不要散落到 commands.rs |

### C. Capability 治理

| # | 动作 |
|---|---|
| C1 🔴 | `openspec/specs/engine-capability-matrix/fixtures/matrix.json` 加 `dsh` 行（15 key 全填） |
| C2 ⚠ | `scripts/check-engine-capability-matrix.mjs` 的 `ENGINE_VARIANTS` |
| C3 ⚠ | `scripts/check-engine-adapter-registry.mjs` 的 `expectedBuiltins` |
| C4 ⚠ | `scripts/check-model-provider-catalog.mjs` | DSH 模型运行时才有。生成目录可空或只放占位，**必须在脚本白名单里写决策**，否则 selector 空白 |
| C5 ⚠ | `scan-engine-name-branches.mjs` | 新 `engine === "dsh"` 进 policy 或加豁免注释 |

顺序：先改 fixture 和三个脚本，再 `--write` 生成。反了会假绿。

建议首期 capability（Spike 后可改）：

| key | 首期 |
|---|---|
| streaming | supported |
| imageInput | conditional（看 catalog `input`） |
| reasoningEffort | conditional |
| sessionResume | supported |
| toolsControl | supported（DSH 自己的工具，不是 mossx 关工具） |
| mcp | unknown / DSH 自管，不在 mossx 暴露 |
| collaborationMode | unsupported |
| Shared | unsupported |

### D. 幕布 ⚠

| # | 文件 | 漏了会怎样 |
|---|---|---|
| D1 🔴 | `dshRealtimeAdapter.ts` + registry | 编译失败（有兜底） |
| D2 ⚠ | `dshHistoryLoader.ts` + `historyLoaderFactory.ts` | **静默走 Codex loader** |
| D3 ⚠ | `conversationCurtainContracts.ts` | 私有事件被丢 |
| D4 ⚠ | `TimelineRowRenderer.tsx` streaming 白名单 | 永远没有 streaming 光标 |
| D5 ⚠ | `MessagesCore.tsx` 多处白名单 | tool/usage/heartbeat 不渲染 |
| D6 ⚠ | `useAppServerEvents.ts` `inferRawMethodEngine` | live 丢事件 |
| D10 🔵 | user-input elicitation | 审批卡死。**第一期必做** |

自检：

```bash
rg -n '"dsh"' src/features/messages src/features/threads src/conversation-presentation src/features/app/hooks/useAppServerEvents.ts
```

不应为空。再跑 realtime / history vitest。

硬编码前缀清单（至少这些，执行时再 `rg` 一遍）：

- `src/features/threads/hooks/useThreadActions.historyLoaderFactory.ts`
- `src/features/threads/hooks/sessionIndexThreadSummaries.ts`（`ENGINE_PREFIX` + `normalizeEngine`）
- `src/features/threads/hooks/useThreadActions.helpers.ts`
- `src/features/threads/hooks/useThreadMessaging.ts` / `useThreadMessagingThreadResolution.ts`
- `src/features/threads/hooks/useThreadTurnEvents.ts`
- `src/features/threads/hooks/useThreadsReducer.ts`
- `src/features/threads/hooks/threadEventDiagnostics.ts`
- `src/features/threads/hooks/threadReducerReasoningGuards.ts`
- `src/features/threads/hooks/threadRuntimeOwnershipHelpers.ts`
- `src/features/threads/utils/threadStorage.ts`
- `src/features/threads/utils/rewindSupportedThreadId.ts`
- `src/features/app/hooks/useAppServerEvents.ts`
- `src/features/messages/timeline/components/TimelineRowRenderer.tsx`
- `src/features/messages/components/MessagesCore.tsx`

### E. Composer

| # | 注意 |
|---|---|
| E1 ⚠ | `engineToProvider` 漏了会显示成 Claude 图标 |
| E2 ⚠ | `AVAILABLE_PROVIDERS` |
| E3 🔵 | 不要做 mossx 侧 DSH 自定义模型存储 |
| E5 ⚠ | `EngineIcon` + `providerBrandIcon`。可用 DeepSeek 标，文案必须是 Harness |
| E6 🔵 | reasoning 按模型 capability，禁止用全局 engine 档位冒充 |
| E7 ⚠ | 默认可见 |

### F. Shared

第一期 **不进**。PR 描述写：

> DSH 不加入 `SHARED_SESSION_SUPPORTED_ENGINES` / `is_supported_shared_session_engine()`。Shared picker 显示 unsupported reason。避免 normalize 成 claude。

F2–F7 先不加分支。

### G. Settings / Sidebar

| # | 第一期做什么 |
|---|---|
| G1 | 薄面板：bin / host / port / 打开 DSH UI / 状态（installed / host up / model count） |
| G2 | `CliCustomPathDialog` 加 dsh |
| G3 | doctor：version + describe + models |
| G4–G5 | Sidebar 新建 DSH 会话 + badge |
| G6 | Session 管理能列出 `dsh:` |

**不要**做 `DshProviderDialog`。

### H. i18n

10 语言：`workspace.ts` / `providers.ts` / `sidebar.ts` / `settings.ts` / `runtimeNotice.ts`。  
key 建议：`engineDsh`、`providers.dsh.label`、host 未启动 / 未配置模型 / 打开 DSH Settings。

---

## 8. 分阶段任务（按这个开 PR）

### Phase 0 — OpenSpec（代码前）

- [ ] 创建 `openspec/changes/add-dsh-engine/`
- [ ] `proposal.md`：Why / What / 非目标 / 风险（可抄本文 1、6）
- [ ] `design.md`：host supervisor、thread 映射、ACK、模型二元组、不进 Shared
- [ ] `specs/dsh-engine-runtime/spec.md` 等 capability delta
- [ ] `tasks.md` 勾选本节省略版

### Phase S — 实测 spike（仍可不改产品代码）

- [ ] 本机 `npx @deepseek-ai/dsh web` 或源码 `pnpm dsh web`
- [ ] 在 DSH UI 配至少一个可用模型
- [ ] curl/脚本打 `host.describe` / `llm.models` / `workspace.create` / `session.create` / `session.prompt`
- [ ] 抓一条 mux 事件流，列出 type
- [ ] 走通一次 approval/question
- [ ] 写 `docs/research/mossx-dsh-capability-spike.md`

### P0 — Identity + supervisor + models

目标：选中 DSH 后模型列表有内容。

- [ ] A1–A6 + protocol family 第三条臂
- [ ] `detect_dsh_status`：找 bin + 可选 probe host
- [ ] supervisor ensure/adopt/spawn
- [ ] `get_engine_models` → `llm.models`
- [ ] composer picker 出现 DSH 分组
- [ ] 设置薄面板 + 打开浏览器 `http://127.0.0.1:3080`（或实际 port）
- [ ] C 层 matrix + 三个 gate 脚本

### P1 — Native session CRUD + send

目标：能建会话、发一条、看到回复。

- [ ] workspace.create 绑定
- [ ] session.create / list / prompt / cancel
- [ ] mux → EngineEvent → `dshRealtimeAdapter`
- [ ] thread 前缀 `dsh:` / pending promotion（对照 Kimi P7/P8，禁止假 sessionId）
- [ ] D4/D5/D6 白名单
- [ ] 目视：streaming 光标

### P2 — History / sidebar / resume

- [ ] `dshHistoryLoader` + factory 分支
- [ ] `list_dsh_sessions` / `load_dsh_session`
- [ ] 重启 mossx 后续上同一 `dsh:<id>`
- [ ] 与 DSH Web UI 对照同一会话
- [ ] sessionIndex / Sidebar badge / i18n

### P3 — 审批 / 图 / reasoning / fork

- [ ] approval + question → 现有 elicitation → `/api/respond`
- [ ] 图像：仅当 catalog 声明 image
- [ ] `session.selectModel` + reasoningEffort
- [ ] `session.fork`（若 Spike 证明可用）

### P4 — CLI 生命周期

- [ ] `CliInstallEngine::Dsh`
- [ ] install / update / doctor
- [ ] Node 版本不够时的明确错误

### P5 — 治理收口

- [ ] 15 项 contract tests 能填的先填；Shared 相关标 N/A 并写原因
- [ ] 存量 Claude/Codex/Kimi fixture 回归
- [ ] 回写基石设计「零、当前实现校准」
- [ ] OpenSpec verify / 准备 archive

### P6 — 明确后置

- Shared / Squad
- Provider Continuation（L3）
- mossx 写 DSH settings
- DSH subagent 深度投影（可先当普通 tool 卡）
- 多 host / 远程 DSH

---

## 9. 建议文件清单

新增（名称可微调，但职责不要拆散）：

```text
openspec/changes/add-dsh-engine/proposal.md
openspec/changes/add-dsh-engine/design.md
openspec/changes/add-dsh-engine/tasks.md
openspec/changes/add-dsh-engine/specs/dsh-engine-runtime/spec.md

docs/research/mossx-dsh-capability-spike.md          # Phase S 产出

src-tauri/src/engine/dsh/mod.rs
src-tauri/src/engine/dsh/host.rs
src-tauri/src/engine/dsh/supervisor.rs
src-tauri/src/engine/dsh/session.rs
src-tauri/src/engine/dsh/events.rs
src-tauri/src/engine/dsh/history.rs
src-tauri/src/engine/dsh_provider_profile.rs         # 可先 stub

src/features/threads/adapters/dshRealtimeAdapter.ts
src/features/threads/loaders/dshHistoryLoader.ts
src/features/vendors/components/DshConnectionCard.tsx  # 薄连接，不是 ProviderDialog
```

必改（不完全，以 §0 矩阵为准）：

```text
src/types/engine.ts
src/features/engine/engineIds.json
src/features/engine/engineRegistry.ts
src-tauri/src/engine/mod.rs
src-tauri/src/engine/adapter_registry.rs
src-tauri/src/engine/manager.rs
src-tauri/src/engine/status.rs
src-tauri/src/engine/commands.rs
src-tauri/src/engine/events.rs
src-tauri/src/bin/cc_gui_daemon/engine_bridge.rs
src-tauri/src/codex/installer.rs
openspec/specs/engine-capability-matrix/fixtures/matrix.json
scripts/check-engine-capability-matrix.mjs
scripts/check-engine-adapter-registry.mjs
scripts/check-model-provider-catalog.mjs
src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.tsx
src/features/composer/components/ChatInputBox/types.ts
src/features/engine/components/EngineIcon.tsx
src/features/threads/hooks/useThreadActions.historyLoaderFactory.ts
src/features/messages/timeline/components/TimelineRowRenderer.tsx
src/features/messages/components/MessagesCore.tsx
src/features/app/hooks/useAppServerEvents.ts
src/i18n/locales/*/
```

---

## 10. 验收

### 10.1 命令

```bash
npm run typecheck
npm run lint
npm run check:engine-capability-matrix
npm run check:engine-adapter-registry
npm run check:model-provider-catalog
npm run check:engine-controller-facade
npm run check:capability-aware-policy-router
cargo check --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml --bin cc_gui_daemon
# 聚焦测试（落地后补齐文件名）
npx vitest run src/features/threads/adapters src/features/threads/loaders
```

### 10.2 产品冒烟

1. 未装 `dsh`：引擎显示未安装，可走安装器；不影响其他引擎。
2. 已装但 host 未开：mossx 自动 spawn；设置页显示 host up。
3. 用户已自己开了 `dsh web`：mossx adopt，退出 mossx 后用户的 DSH 还在。
4. DSH UI 配好模型后，mossx 模型列表非空，分组显示 provider。
5. 在 mossx 建 DSH 会话、发消息、有 streaming、有 tool 卡。
6. 刷新 / 重启 mossx，同一会话还在，history 与 live 一致。
7. 打开 DSH Web UI，能看到同一 session。
8. 需要审批的工具：mossx 弹出既有审批卡，批准后 DSH 继续。
9. Stop：turn 取消，host 进程仍在。
10. Shared picker 里 DSH 不可选，且有原因，不会被改写成 Claude。

### 10.3 渲染目视（无自动化兜底）

- streaming 光标
- reasoning 折叠（若该模型有）
- tool 块
- usage 收尾（若 Spike 证明有）
- history reload 后与 live 一致

### 10.4 存量零回归

- 不改 `ConversationItem` / `threadItems.ts` / live channel 语义
- 白名单只追加不重排
- Claude/Codex/Kimi golden fixtures 全绿

---

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| DSH developer preview，RPC 会破 | client 收口在 `engine/dsh/host.rs`；单测钉 envelope |
| 3080 冲突 | describe 校验；失败换 port 或明确报错 |
| 误杀用户自己的 `dsh` | spawned vs adopted |
| npx 冷启动很慢 | doctor 说明；优先全局 bin；spawn 超时要可读 |
| Node 版本不够 | doctor 先查 node |
| 模型列表为空被当成 bug | 三种空态文案分开 |
| pending → canonical 双行 | 抄 Kimi P7/P8，禁止假 sessionId |
| 审批没桥导致永久 loading | P3 不做完不能说 Native 可用 |
| 协议族漏改，DSH 被标成 stream-json | A6 单测 |

---

## 12. 给执行 agent 的开场白（可直接粘贴）

```text
按 docs/research/mossx-dsh-engine-onboarding-execution.md 接入 DSH。

硬约束：
- DSH 是第 7 个 Native Engine，不是 vendor preset，不内嵌 Web UI
- 配置（key / provider / 模型目录维护）留给 DSH Web UI
- mossx 自动拉起或复用 `dsh web`，全应用一个 host
- Native session：thread id = dsh:<dshSessionId>
- 第一期不进 Shared
- 先 OpenSpec change + Phase S 实测，再改 EngineType
- 必读 docs/research/mossx-new-cli-onboarding-guide.md §0 矩阵
- ⚠ 项全部人工勾选，尤其 historyLoaderFactory 和渲染白名单

先做 Phase 0 + Phase S，把 spike 证据写进
docs/research/mossx-dsh-capability-spike.md，再开始 P0。
```

---

## 13. 参考路径

### mossx

- `docs/research/mossx-new-cli-onboarding-guide.md`
- `docs/research/mossx-multi-cli-provider-session-foundation-design.md`
- `openspec/changes/archive/2026-07-24-add-kimi-engine/`
- `src/features/engine/engineIds.json`
- `src/features/threads/hooks/useThreadActions.historyLoaderFactory.ts`
- `src-tauri/src/engine/adapter_registry.rs`
- `src-tauri/src/codex/installer.rs`

### DSH（本地竞品 checkout）

- `apps/cli/README.md` / `apps/cli/src/args.ts`
- `docs/user/guide/index.md` / `docs/user/guide/providers.md`
- `docs/architecture.md`
- `packages/host/apiproxy/src/api/rpc-map.ts`
- `packages/host/apiproxy/src/api/llm.ts`
- `packages/host/apiproxy/src/api/sessions.ts`
- `packages/host/apiproxy/src/api/workspace.ts`
- `packages/host/apiproxy/src/api/events.ts`
- `packages/client/connection/src/api-path.ts`
- `packages/bundle/web-app/README.md`
- `packages/acp/acp/README.md`（为什么 ACP 不能当主路径）
