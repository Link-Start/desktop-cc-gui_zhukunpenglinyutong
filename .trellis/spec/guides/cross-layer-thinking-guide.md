# Cross-Layer Thinking Guide（跨层思考指南）

## mossx 的主链路

```text
React Component
  -> Feature Hook
  -> Service Wrapper (src/services/tauri.ts)
  -> Tauri Command (Rust)
  -> Storage / Engine Runtime
  -> Response Mapping
  -> UI State + Render
```

## 高风险边界（High-Risk Boundaries）

- hook <-> `services/tauri.ts`
- `services/tauri.ts` <-> Rust command 参数/字段
- `services/dragDrop.ts` <-> Tauri `onDragDropEvent` / forwarded WebView drag-drop event
- client storage <-> runtime default/fallback
- i18n key <-> UI copy fallback

## 变更前必做

1. 列出所有受影响 command/event/payload 字段。
2. 明确 request 与 response 的 mapping 方向。
3. 定义 fallback（Tauri 不可用 / web-service mode）。
4. 先定义验证策略再写代码。
5. 禁用 capability 时按“行为入口”盘点 UI、legacy config replay、后台任务、sync/async、local/remote；history/filter/diagnostics compatibility 与 execution 必须分开判断。
6. retry/stale guard 必须落在 shared owner boundary；检查是否还有 selection、ensure、cache、fallback 或 timeout sibling caller 能绕过。
7. legacy provider config 归一时，user-confirmed action MAY 选择可见 fallback；无人确认的 background automation MUST fail closed 或自动禁用，禁止静默把数据改发另一个 provider。
8. prompt / policy enablement 发生变化时，必须区分 runtime state 与 persisted thread history：restart process 不代表 resume 的 thread 已忘记旧 instructions；deactivation 需要 authoritative replacement / tombstone 或明确的新 thread contract。

## 常见失败模式

- 前端字段名改了，service mapping 没更新。
- optional 字段被当 required 使用。
- `undefined` 与显式空集合（如 `[]`）被错误地当成同一语义，导致 fallback 误吃全量数据。
- retry 流程非 idempotent，触发重复副作用。
- 只隐藏主 UI，却遗漏 Prompt Enhancer、Project Map、Task Center recovery 或 legacy config replay 等 sibling execution surface。
- disabled/stale guard 放在 local/success 分支，remote forwarding、timeout/error fallback 仍先产生副作用。
- retry budget 放在 selection caller，其他 caller 再次调用 shared resume 时预算被隐式重置。
- 把 disabled provider 的 enabled background job 直接归一到另一个 provider，造成用户未确认的跨 provider 执行。
- listener 未清理，导致重复触发。
- 只监听 main WebView 的 drag/drop，遗漏 Browser Agent child WebView 截获的 OS drop，导致 Composer 外部文件拖入断链。

## Optional Payload Contract

- 对 optional collection payload 必须显式区分三种状态：
  - `undefined` / `None`：调用方未提供 scope，允许 backend 使用既有 fallback。
  - `[]` / `Some([])`：调用方显式清空 scope，backend MUST 保持空结果，禁止回退到全量 diff。
  - `["a", "b"]` / `Some([...])`：调用方提供显式 scope，backend MUST 只处理该集合。
- 如果 UI 有“默认选中”与“用户手动清空后为空”两种空态，hook/service 层必须保留这个差异，不能只看当前集合内容。
- 涉及 path scope 的 payload，frontend 与 backend 必须共享 normalize contract，至少统一 `\\` / `/`、leading slash 与 trailing slash 处理。

## 最低验证集（Minimum Verification）

- `src/services/tauri.test.ts` payload mapping 测试。
- 对应 feature hook/component 的 error + edge case 测试。
- 至少覆盖一次“显式空 scope 不回退”的 UI + backend 回归测试。
- capability hard-disable 至少覆盖：fresh/legacy settings、visible selector、legacy replay、background detection/preflight、direct service/IPC、local/remote、sync/async。
- async owner 至少覆盖：success、error、unavailable、timeout、cache hit，以及 old-id/new canonical-id 或 workspace/thread scope race。
- contract 相关命令：

```bash
npm run check:runtime-contracts
npm run doctor:strict
```

## PR 记录要求

- 标注 cross-layer 影响面。
- 标注关键 mapping 变更点。
- 标注验证结果与剩余风险。
