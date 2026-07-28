## Why

Native Composer 的跨 Provider 续接把 catalog entry 的 UI `id` 当成 Claude CLI runtime
`model` 发送；当两者不同（例如 `settings-reasoning` / `deepseek-v4-pro`）时，目标 Provider
明确返回 400，但 recovery 又把已落盘的 bootstrap user entry 误判为成功证据。结果是一次
用户操作同时出现“错误模型调用”和“重试可能假成功”。

## 目标与边界

- 目标：Provider Continuation 冻结并执行 catalog 已解析的 runtime model，而 UI identity
  仍保留 catalog entry `id`。
- 目标：backend 在目标 side effect 前验证 Claude continuation model，拒绝明显的
  UI-only identity。
- 目标：Claude history 中的显式 Provider/API rejection 优先于 bootstrap user-entry
  弱证据，retry 只 probe 同一 target identity，且不得转成 `ready`。
- 边界：覆盖 Native Composer 发起的 Claude target continuation 和其 durable recovery。

## 非目标

- 不改变普通 Native/Shared send 的完整模型选择架构。
- 不新增 Provider、模型目录来源或第三方依赖。
- 不把 stderr 中与请求成败无关的 Claude connector warning 当成主错误。
- 不自动重建已经进入 `recovery-required` 的历史 operation。

## What Changes

- Native Composer 的跨 Provider model selection 同时保存 UI option identity 与 runtime
  model，continuation destination 的 `model` 使用 runtime model。
- Claude continuation backend 在启动 CLI 前执行 provider-scoped runtime model
  resolution/validation；无法证明的 UI-only id fail closed。
- Claude recovery probe 识别目标 history 中与 bootstrap turn 对应的显式 API rejection；
  rejection 优先于 bootstrap user-entry 和 marker evidence。
- 增加 `id != model`、显式 400 rejection 与 retry 不假成功的 focused regression tests。
- 同步 Native Provider Continuation 与 Claude model resolution 的 executable contract。

## 技术方案取舍

1. **推荐：选择边界解析 + backend validation + evidence precedence**
   - UI 保留 `id` 用于选择状态，冻结 destination 时写 runtime `model`。
   - backend 复用 provider-scoped catalog 做最后校验。
   - recovery 将 explicit rejection 作为强负证据。
   - 优点：同时封住生产路径、非 UI caller 和 retry；符合 Foundation 的 Target Snapshot 与
     Probe 原则。
2. **仅把 `model.id` 改为 `model.model`**
   - 改动最小，但其他 caller 仍可传 UI-only id，recovery 假成功仍存在。
   - 不采用：只能止住当前入口，不能闭环。
3. **完全信任 Claude CLI 返回码**
   - 首次执行简单，但 crash/restart 后没有 process result，只能读取 durable history。
   - 不采用：无法满足既有 idempotent recovery。

## 验收标准

- `id=settings-reasoning, model=deepseek-v4-pro` 时，Claude CLI 收到
  `deepseek-v4-pro`，不得收到 `settings-reasoning`。
- backend 收到可证明为 UI-only 的 model id 时，在目标 side effect 前返回 typed error。
- 同一 target JSONL 同时含 bootstrap user entry 与 `API Error: 400` 时，probe MUST 返回
  rejection，operation MUST NOT 进入 `ready`。
- connector warning 不得覆盖 Provider/API rejection 主错误。
- focused frontend/Rust tests、TypeScript typecheck、runtime contract check 与 OpenSpec
  strict validation 通过；不要求全量测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `native-provider-continuation`: 明确 destination runtime model、backend validation 与
  explicit rejection precedence。
- `claude-dynamic-model-discovery`: 将 `id != model` 的 send-time runtime resolution
  明确覆盖到 Provider Continuation。

## Impact

- Frontend：Native Composer model picker 与 continuation target snapshot。
- Backend：`ExecutionTargetInput` 的 Claude continuation validation、Claude bootstrap
  execution/recovery evidence parser。
- Contract：`openspec/specs/native-provider-continuation`、
  `openspec/specs/claude-dynamic-model-discovery` 与对应 Trellis executable contract。
- 兼容性：DTO 保持 additive/optional；不新增依赖，不修改来源 Session。
