## Context

`create_git_pr_workflow` 当前在执行 push/create 之前 fetch `upstream/<base>`，通过 `git diff --name-only upstream/<base>...HEAD` 计算 changed paths，并由 `evaluate_pr_range_gate` 返回 `Pass` 或 `Blocked`。`>240 files` 与 empty/suspicious scope 共用失败结果，前端只能把它们都显示为 generic retry error。

该变更横跨 React → Tauri invoke → local/remote Rust command → daemon dispatch，因此 request/result 必须保持 local 与 remote backend 一致。现有 `ask` API 已提供桌面原生确认能力，不需要引入新组件或依赖。

## Goals / Non-Goals

**Goals:**

- 将纯 changed-file count 超限建模为一次性、可审计的用户授权。
- 保留 empty range 与 suspicious root/base 的不可绕过 Hard Stop。
- 让前端通过 typed metadata 决策确认文案，不解析 backend message。
- 确认后重新 fetch/recompute range，避免使用第一次预检的 stale result。
- 保持 `precheck -> push -> create -> comment` 执行顺序与 existing PR 复用语义。

**Non-Goals:**

- 不新增持久化“永远允许大型 PR”设置。
- 不自动识别 generated/vendor/catalog 路径。
- 不改变 GitHub 自身的 diff/merge/review 行为。
- 不把其他 Git write operation 纳入本次调整。

## Decisions

### 1. 三态 Range Gate decision

Backend 内部使用：

- `Pass { changed_files }`
- `ConfirmationRequired { changed_files, severity, reason }`
- `Blocked { category, reason }`

`severity` 仅允许：

- `large`：`241–300 files`
- `diff-incomplete`：`>300 files`

相较于直接提高阈值，该模型保留了原风险信号；相较于目录白名单，它不依赖仓库路径约定。

### 2. 一次性 request override

Create PR request 增加 optional `allowLargeRange`（Rust 为 `allow_large_range: Option<bool>`，默认 `false`）与 `confirmedRangeFingerprint`。只有 authorization flag 为 true 且 fingerprint 与 fresh precheck 的 `upstream/<base>` / `HEAD` revision pair 完全一致时，才允许 `ConfirmationRequired` 转为 `Pass`；不得改变 empty/suspicious `Blocked`。

Frontend 第一次调用不携带 override。收到 confirmation metadata 后调用现有 `ask`；只有用户确认才以 `allowLargeRange=true` 和 backend 返回的 opaque fingerprint 重新执行完整 workflow。第二次调用必须重新 fetch、解析 revision pair 并计算 changed paths；若 fingerprint 已变化，则返回 current range 的新确认要求。

### 3. 结构化 result metadata

`GitPrWorkflowResult` 增加 optional `rangeGate`：

- `changedFiles`
- `threshold`
- `severity`
- `requiresConfirmation`
- `rangeFingerprint`

确认要求仍使用 `ok=false/status=failed/errorCategory=range-confirmation-required` 返回，以保持现有 stage/result status union 和 daemon compatibility；前端必须在 generic failure settlement 前拦截该 category。metadata 是判断依据，category 只负责错误分类。

### 4. Hard Stop 优先级

decision 顺序调整为：

1. empty range → Hard Stop
2. suspicious root files + sufficiently large scope → Hard Stop
3. changed-file count → Pass 或 ConfirmationRequired

这保证 `allowLargeRange` 不会掩盖 README/LICENSE 等既有错误-base 信号。

### 5. daemon precheck 执行边界

remote daemon 仅为本次新增的 PR fetch/diff/revision precheck 使用 bounded non-interactive Git runner：120 秒 timeout、禁止 credential prompt、child kill-on-drop。命令失败统一 settlement 为 `GitPrWorkflowResult` 的 failed precheck stage，不把 raw `Err` 抛到 frontend generic catch。其他 daemon Git operation 不在本次范围内。

### 6. 取消不是可重试错误

用户取消时不进行第二次 backend 调用，不 push、不 create。UI 回到中性的表单/等待状态，不保留 failed result，不触发 generic error notice，也不追加“可重试该操作”；再次点击 Create PR 可重新发起预检。

## Risks / Trade-offs

- [用户可能确认错误 base 的大型范围] → suspicious root/base 规则继续 Hard Stop；确认文案显示 base/head 和 changed-file count。
- [两次 precheck 增加一次 fetch/auth 成本] → 只发生在 `>240 files`，换取确认后范围不陈旧。
- [GitHub 300-file diff 限制未来变化] → 300 作为当前 review-risk boundary 只保留在 backend constant；frontend 只按 severity 描述“可能无法完整展示”，不重复硬编码具体数值。
- [remote daemon contract 漏传 override/metadata] → 为 forwarding payload 与 daemon dispatch 增加 contract test/存在性检查。
- [backend 确认状态仍使用 failed result shape] → frontend 对 confirmation category 单独 settlement；取消时清空该临时结果，不扩展全局 status enum。
- [确认期间 range 变化] → authorization 绑定 opaque revision fingerprint；不匹配时重新确认，不直接进入 push/create。

## Migration Plan

1. 扩展 Rust/TypeScript optional contract，旧调用方不传字段时行为安全。
2. 更新 Range Gate decision 与 tests。
3. 贯通 local command、remote forwarding 与 daemon dispatch。
4. 接入前端确认/重试和 i18n。
5. 运行 focused tests、typecheck、lint、Rust tests 与 OpenSpec strict validation。

Rollback 时移除 optional request/result 字段和前端确认分支，恢复 `>240` 直接 `Blocked`。无数据 migration。

## Open Questions

- 无。阈值区间与 Hard/Soft Gate 边界已由用户确认。
