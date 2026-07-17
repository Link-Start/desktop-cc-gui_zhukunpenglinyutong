## Context

Pull Dialog 当前从 `pullStrategy / pullNoCommit / pullNoVerify` 生成 command preview，但三段 intent copy
始终读取固定 i18n key。相同 selection state 已经存在于 `GitHistoryPanelImpl` 并传给
`GitHistoryPanelDialogs`，因此 presentation 可以纯派生，不需要新增 state、effect、backend query 或 IPC payload。

Git option semantics 存在上下文差异：

- `--no-commit` 只在 merge 需要创建 merge commit 时提供停顿；fast-forward 无 commit 可停。
- `--no-verify` 在 Pull 的 merge path 控制 `pre-merge-commit` / `commit-msg` hooks。
- `--rebase` 不走 `git pull` 的 merge option forwarding path，因此 merge-only additive option 不产生同样效果。
- `--no-ff` 与 `--squash` 都是 merge-path option；当前 frontend/backend 没有补充 `--no-rebase`，
  因此当 `pull.rebase=true` 时 Git 仍可能走 rebase，说明不能无条件承诺 merge outcome。
- 仅当 Git 最终进入 merge path 时，`--squash` 才会避免自动 commit 或移动 `HEAD`；
  在该前提下与 `--no-commit` 组合属于 redundant explanation。

本变更必须让用户看见这些差异，但不得替用户更改 selection。

## Goals / Non-Goals

**Goals:**

- 由当前 Pull selection 生成稳定、可测试、可本地化的 explanation model。
- 同时表达单项 option effect 和组合后的 context-specific effect。
- 默认直接暴露 option controls，并保留原有 selection、互斥和 toggle semantics。
- 用轻量 token spans 增强 command preview 层级，同时保持完整 command string、submit payload 与执行行为不变。
- 对 default/no-strategy state 保持诚实：最终 integration 可能受 Git configuration 影响。

**Non-Goals:**

- 不做 option validation、disable、auto-clear 或 normalization。
- 不修改 Tauri service、Rust command、daemon parity 或 Git argument ordering。
- 不引入运行时 Git config/preflight query。
- 不重新设计整个 Pull Dialog layout。

## Decisions

### Decision 1: 使用 feature-local typed pure resolver

新增 feature-local utility：

```ts
resolveGitPullExplanation({
  strategy,
  noCommit,
  noVerify,
}): GitPullExplanation
```

返回 translation key 而不是最终 copy：

```ts
type GitPullExplanation = {
  intentKey: GitPullExplanationKey;
  effectRows: GitPullExplanationEffect[];
  willNotHappenKey: GitPullExplanationKey;
};
```

理由：

- selection 是完整输入，resolver 可保持 deterministic 与 side-effect free。
- JSX 只负责 `t(...)` 和 presentation，避免在 `@ts-nocheck` render file 中继续堆叠组合规则。
- 组合状态可 table-driven test，不需要挂载完整 Git History runtime。

替代方案是在 JSX 中使用 nested ternary。它少一个文件，但会让 5 个 strategy state × 4 个 additive state
混入大型 render surface，难以审计和复用测试，因此不采用。

### Decision 2: 按 strategy 上下文化 additive option

`--no-commit` 与 `--no-verify` 不使用固定说明；resolver 根据 strategy 选择对应 effect key：

| Strategy | `--no-commit` explanation | `--no-verify` explanation |
|---|---|---|
| default | 仅当最终走 merge 且需要 commit 时生效 | 仅当最终走 merge hook path 时生效 |
| `--rebase` | merge-only effect 不适用 | merge hook effect 不适用 |
| `--ff-only` | fast-forward 无 merge commit 可暂停 | fast-forward 无 merge commit hooks |
| `--no-ff` | 仅当最终走 merge 时，在 merge commit 前暂停 | 仅当最终创建 merge commit 时跳过对应 hooks |
| `--squash` | 仅在 merge path 中与 squash 的“不自动提交”效果重复 | 仅在 merge path 中没有 merge commit hooks 可跳过 |

这张矩阵只控制 explanation，不控制 selection 或 command。`--no-ff` / `--squash` 行必须同时提示：
option 本身不会覆盖既有 rebase configuration。

### Decision 3: 保留三段 details card，增加轻量 effect rows

- `Intent`：一条 strategy-level summary。
- `Will Happen`：按 selection order 展示 strategy、`--no-commit`、`--no-verify` effect row。
- `Will NOT Happen`：一条 strategy-level boundary，并始终明确 Pull 不会 push。
- `Example`：继续使用既有 `pullExampleCommand`。

未选择 option 时仍显示一个 default effect row，避免空白。

替代方案是为每个 option 增加 tooltip。Tooltip 难以表达组合结果，也不满足用户要求的“下方描述区动态替换”，因此不采用。

### Decision 4: 所有用户可见 copy 继续走 i18n

新增 keys 同步到 `src/i18n/locales/*/git.ts`。Technical literals（如 `--rebase`、`HEAD`、hook 名）保持原文，
业务解释按 locale 翻译。

### Decision 5: 默认展开 option controls，并复用同一 command token model

- `handleOpenPullDialog` 每次重置 dialog 时把现有 `pullOptionsMenuOpen` 设为 `true`，不新增 state。
- 保留原 toggle，用户仍可手动收起或再次展开；option click、互斥、chip removal 全部沿用原 handler。
- 由 remote、target branch 与现有 selection 生成 ordered token list；renderer 通过相同 separator
  规则自然拼出原 command text，避免视觉 markup 与完整 command string 漂移。
- hero preview 与底部 `Example` 渲染同一 token list；CSS 只使用 feature-scoped class 和 theme variables，
  不引入 syntax highlight dependency。

### Decision 6: Git operation dialogs 复用 feature-local token renderer

新增 typed `GitOperationTokens` presentation component，输入 ordered tokens：

- command 使用 `command / operator / option`；
- branch route 使用 `branch / operator / remote / operator / branch`；
- token 自带可选 `separatorBefore`，确保 `->`、`:`、`&&` 与空格不因 JSX 拆分而改变；
- token spans 保持自然文本顺序并使用 `translate="no"`，不在 `code` / generic element 上添加
  prohibited accessible name；
- Pull、Fetch、Sync、Push 只替换 text markup，不改任何 state、input value、handler 或 payload；
- Sync `ahead/behind` 保留原 i18n 输出，仅增加 summary tone；Push target input 仅增加 branch tone class。

选择 feature-local component 而不是复制 spans，避免多个 dialog 的颜色和 spacing contract 漂移。

## Risks / Trade-offs

- [Risk] Git configuration 会影响未显式选择 strategy 的最终行为
  → Mitigation：default copy 以及 merge-only 的 `--no-ff` / `--squash` copy 都明确标注 configuration
  可能决定最终走 rebase，不承诺具体 merge outcome。

- [Risk] 说明比原固定文案更长，窄窗口可能增加高度
  → Mitigation：复用现有 facts card，只增加 compact effect rows；允许自然换行，不改变 Dialog width。

- [Risk] 文案和真实 command path 漂移
  → Mitigation：用 pure resolver matrix + component test 锁定 option state；backend command 维持现状。

- [Risk] 用户将 no-op explanation 误认为系统自动移除了 option
  → Mitigation：command preview 和 chip 继续显示原 flag，文案明确使用“仍会出现在 command 中，但本路径无额外作用”。

## Migration Plan

1. 增加 explanation resolver 与 table-driven tests。
2. 在既有 Pull details card 中接入 resolver，不改 selection handler。
3. 同步 locale keys 和最小 styles。
4. 增加 Pull Dialog interaction regression test。
5. 扩展同一 token renderer 到 Fetch、Sync、Push 框选 surface，并补 DOM contract test。
6. 运行 focused test、typecheck、lint、large-file gate 和 OpenSpec validation。

Rollback：

- 移除 resolver/render rows，恢复原三个固定 i18n key。
- backend、payload 和 persisted state 均未变化，无数据 migration。

## Open Questions

- 无。本轮范围已确认仅做 presentation，不处理无效组合禁用。
