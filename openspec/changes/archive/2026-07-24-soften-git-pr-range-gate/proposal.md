## Why

Create PR workflow 当前把 `>240 changed files` 一律视为异常范围并在 precheck 阶段 Hard Stop。该策略能拦截错误 base，但也会阻断 generated catalog、vendor assets 或批量迁移等合法的大范围 PR；用户只能绕过客户端手工创建。

## 目标与边界

- 保留 `upstream/<base>...HEAD` 范围预检与错误 base 防护。
- 将“仅文件数超限”改为需要用户显式确认的 Soft Gate，并在确认后重新执行完整预检。
- 区分 `241–300 files` 与 `>300 files` 的风险说明；后者明确提示 GitHub diff 可能无法完整展示。
- 使用结构化 backend contract 表达确认要求，禁止前端解析错误文案。
- 首版继续面向 GitHub `gh` workflow，不改变 push/create/comment 顺序。

## 非目标

- 不删除 `240` 风险基线，也不把阈值改成全局可配置项。
- 不维护 generated/vendor/catalog 路径白名单；合法例外统一由一次性人工确认授权。
- 不允许绕过 empty range 或 suspicious root/base 等结构性异常。
- 不改变 GitHub 远端权限、merge policy、review policy 或 diff rendering 限制。

## What Changes

- Backend Range Gate 将产生 `pass / confirmation-required / blocked` 三类决策。
- `241–300 files` 返回普通大型范围确认；`>300 files` 返回 incomplete diff 强警告确认。
- Create PR request 新增一次性 `allowLargeRange` override；override 必须绑定 backend 返回的 current range fingerprint，且只绕过纯文件数 Soft Gate。
- Workflow result 新增结构化 `rangeGate` metadata，包含 changed file count、threshold、severity、confirmation requirement 与 opaque range fingerprint。
- Git History Create PR UI 在 Soft Gate 返回时显示原生确认对话框；用户确认后重新调用 workflow。
- 取消时回到中性的表单/等待状态，不显示误导性的“可重试该操作”错误。
- suspicious root/base 检查优先于文件数检查，保持不可绕过。
- remote daemon 的新增 fetch/diff precheck 使用 bounded non-interactive Git runner，失败时返回结构化 precheck result。

## 方案对比与取舍

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A | 删除或提高 `240` 阈值 | 改动最小 | 丢失 base 错误防护，未来仍会命中新阈值 | 不采纳 |
| B | 按目录识别 generated/vendor 文件并自动豁免 | 操作更少 | 路径规则脆弱，容易漏判或被滥用 | 不采纳 |
| C | 文件数 Soft Gate + 一次性显式确认，结构异常继续 Hard Stop | 保留安全性并支持合法例外，contract 清晰 | 多一次确认与 backend 重试 | 采纳 |

## 验收标准

- `≤240 files` 保持单次调用通过。
- `241–300 files` 未授权时返回结构化 confirmation requirement，确认后可继续创建。
- `>300 files` 未授权时明确提示 GitHub diff 可能无法完整展示，确认后可继续创建。
- empty range 和 suspicious root/base 在任何 override 下仍然 Hard Stop。
- 用户取消确认时不 push、不创建 PR，且 UI 不显示 generic retry error。
- remote daemon 与 local backend 的 request/result contract 保持一致。
- 确认后若 `upstream/<base>` 或 `HEAD` 已变化，旧 authorization 不得继续通过，必须返回 current range 的新确认要求。
- Rust、Vitest、typecheck、lint 与 OpenSpec strict validation 通过。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `git-operations`: 将 changed-file count 从无条件 Hard Stop 调整为可确认 Soft Gate，同时保留结构性异常 Hard Stop。
- `git-pr-submission-workflow`: 扩展 Create PR request/result contract，支持一次性 large-range override 与结构化 Range Gate metadata。
- `git-history-panel`: 在 Create PR dialog 中增加大型范围风险确认及取消后的准确反馈。

## Impact

- Backend: `src-tauri/src/git/mod.rs`、`src-tauri/src/git/commands.rs`、`src-tauri/src/git/commands_pr_workflow.rs`、daemon forwarding/dispatch contract、Rust types/tests。
- Frontend: `src/services/tauri/git.ts`、`src/types/git.ts`、Git History PR interaction hook、i18n 与 Vitest。
- OpenSpec: 三个既有 capability 的 delta specs。
- Dependencies/storage: 无新增依赖、无持久化数据、无 migration。
