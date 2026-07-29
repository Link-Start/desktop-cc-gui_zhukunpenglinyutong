## Why

Kimi、Grok、OpenCode 已进入 Shared Session 的 Target Picker，但侧边栏创建入口仍隐式借用当前 Composer Target，且 OpenCode 的运行时 Model catalog 与 Shared 校验 catalog 不同源、Kimi/Grok local Provider Runtime key 不一致，导致会话创建或首轮发送失败。需要沿用 Claude/Codex 的 Shared Foundation contract 补齐入口到 runtime receipt 的整条链路，而不是放宽校验或复制生命周期分支。

## 目标与边界

- `Shared CLI` 创建入口显式选择本机可用的 Claude/Codex/Kimi/Grok/OpenCode CLI。
- 所选 CLI 使用其 canonical local Provider 与 runtime-authoritative 默认 Model 创建完整 `ExecutionTarget`。
- OpenCode Shared create/send 的 Model 验证与 `get_engine_models` 保持同一 catalog authority。
- Kimi/Grok local dispatch receipt 使用与 durable Attempt 相同的 canonical Provider Runtime key。
- 保持 Shared 四级 Picker、strict target validation、durable attempt、Native Session 行为与 Gemini fail-closed 不变。

## 非目标

- 不在创建菜单中继续展开 Provider/Model；进入 Shared Session 后仍由现有四级 Picker 切换。
- 不引入 auto-route、silent fallback、跨 CLI 猜测 Model 或弱化 receipt identity 校验。
- 不重做 Kimi/Grok/OpenCode Native Session 接入，不改变其产品交互。

## What Changes

- 为侧边栏 `Shared CLI` 增加 CLI 二级菜单，按 workspace-scoped engine availability 禁用不可用项并显示原因。
- 将 Shared 创建回调改为显式接收所选 Engine，并通过统一 local initial-target resolver 生成完整 Target。
- 统一 OpenCode local runtime/cached Model catalog 的展示与 Shared 校验 authority。
- 统一 Kimi/Grok local launch profile 与 Shared durable Attempt 的 Provider Runtime key。
- 增加覆盖 Shared 菜单、初始 Target、OpenCode catalog parity、Kimi/Grok receipt identity 的 focused regression tests。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `shared-session-engine-selection`: Shared Session 创建必须先显式选择可用 CLI，且不能借用当前 Composer Target。
- `model-provider-catalog-runtime`: OpenCode local Shared validation 必须与 runtime/cached catalog 使用同一 authority。
- `shared-send-pipeline`: Kimi/Grok local dispatch receipt 的 Provider Runtime key 必须与 durable Attempt snapshot 精确一致。

## 方案对比

### 方案 A：二级 CLI 选择后立即创建（采用）

使用所选 CLI 的 canonical local Provider 和 runtime-authoritative 默认 Model 创建 Shared Session，进入会话后由现有四级 Picker 切换 Provider/Model。它符合用户预期，复用现有菜单 flyout 和 Composer Picker，改动面最小。

### 方案 B：创建前展开 CLI → Provider → Model

Target 更显式，但会把四级 Picker 复制进侧边栏菜单，增加多层 hover、异步 catalog 与键盘可访问性的复杂度，并形成第二套 Target selection owner，因此不采用。

## 验收标准

- 点击 `Shared CLI` 展示五个 Shared-supported CLI；ready 项可创建，不可用项禁用且保留原因/刷新能力。
- 从任意当前 active engine 选择另一 CLI 创建 Shared Session，不再出现 engine mismatch，也不继承旧 Composer Model。
- OpenCode 选择 `opencode models` 返回但 generated fallback 未包含的 Model 时，Shared create/send 不报 `invalid-target-model`。
- Kimi/Grok local Shared turn 不再报 `dispatch receipt Provider Runtime key does not match durable attempt`。
- strict target/model/receipt validation、Gemini fail-closed 与 Native Session focused regression tests 保持通过。
- 只运行受影响模块的增量测试，不运行全量测试。

## Impact

- Frontend：Sidebar new-session menu、AppShell Shared creation callback、Thread action types 与 focused tests。
- Backend：engine Model catalog authority/cache、Kimi/Grok Provider launch profile、Shared validation/receipt tests。
- Specs：上述三个现有 capability 的 delta requirements。
- Dependencies：不新增依赖，不做数据迁移。
