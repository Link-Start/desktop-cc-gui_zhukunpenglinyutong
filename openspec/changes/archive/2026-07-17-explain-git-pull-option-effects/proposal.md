## Why

Git History 的 Pull Dialog 虽然会实时展示最终 `git pull` command，但 `Intent / Will Happen / Will NOT Happen`
仍是固定文案。低频使用 Git 的用户无法从界面理解单个 option 的实际影响，也无法识别
`--rebase --no-commit --no-verify` 等组合中哪些参数真正生效、哪些只适用于 merge path。

## 目标与边界

- 根据当前 `strategy / noCommit / noVerify` selection 动态生成专业但易懂的 Pull 行为说明。
- 同时解释目标 remote branch、单项 option effect、组合后的最终结果与明确不会发生的行为。
- 保留现有 `Intent / Will Happen / Will NOT Happen / Example` 信息结构和 command preview。
- 只修改 frontend presentation，不修改 option selection、payload、command ordering、Tauri/Rust execution 或 Git 行为。

## 非目标

- 不禁用、自动清除或改写任何 option combination。
- 不改变 `--rebase / --ff-only / --no-ff / --squash` 的互斥状态模型。
- 不增加 Git preflight、branch divergence query 或 backend capability。
- 不修改 Pull confirm/cancel、loading、error handling 或 refresh flow。

## What Changes

- 为 Pull Dialog 增加由现有 selection 派生的 explanation view model。
- `Intent` 根据 remote、target branch 和 integration strategy 动态说明本次目的。
- `Will Happen` 逐项说明已选 option，并对 merge-only、redundant 或 no-op combination 给出上下文提示。
- `Will NOT Happen` 动态说明不会 push、不会自动 commit、不会创建 merge commit 或不会改写 history 等边界。
- Pull Dialog 每次打开时默认展开修改选项，确保低频 Git 用户能直接发现所有 option。
- 对 hero command preview 与底部 `Example` command 按 command、remote、branch、option 做一致的 token coloring。
- 将相同 token coloring 扩展到用户框选的 Fetch `Example`、Sync route/summary/command 与 Push
  route/target branch 字段，形成一致的 Git operation visual language。
- 同步所有 locale 的用户可见 copy，避免 fallback key 泄漏。
- 增加 focused tests，覆盖单项 option、代表性组合与 chip removal 后的同步更新。

## 技术方案对比

### Option A：feature-local pure resolver（采用）

- 将 selection 映射为 translation keys + interpolation params，再由现有 Dialog render。
- 优点：无新增 React state/effect；组合规则可独立测试；文案与 command execution 完全解耦。
- 代价：增加一个小型 feature-local helper 和对应测试。

### Option B：在 JSX 中嵌套条件拼接

- 直接在 `GitHistoryPanelDialogs.tsx` 内用 ternary 生成所有说明。
- 优点：文件数量少。
- 缺点：20 种 selection state 很快形成难读分支，难以证明 no-op/redundant combination 覆盖完整。

选择 Option A，以最小的 typed pure function 隔离非平凡组合逻辑，不引入 dependency 或 shared abstraction。

## 验收标准

- 未选择 option 时，说明 Git 将按 repository/user configuration 决定 integration strategy。
- 选择任一 strategy 后，说明区立即反映其 history、commit 与 failure semantics。
- `--no-ff` 与 `--squash` 明确说明其 merge-path effect，并提示现有 Git rebase configuration
  仍可能决定最终走 rebase，界面不承诺未显式传入的 `--no-rebase` 行为。
- `--no-commit` 和 `--no-verify` 的描述随当前 strategy 变化，而不是展示固定泛化文案。
- `--no-ff + --no-commit`、`--ff-only + --no-commit`、`--squash + --no-commit`、
  `--rebase + --no-commit + --no-verify` 均显示符合 Git semantics 的组合说明。
- 选择、取消选择、移除 chip 后，说明区与 command preview 同步更新。
- 每次打开 Pull Dialog 时修改选项默认可见，用户仍可使用原 toggle 手动收起或再次展开。
- hero 与 `Example` 中的 command 使用一致的 token coloring，且辅助技术仍可从自然文本读取完整原始 command。
- Fetch、Sync、Push 的框选 command、branch route、ahead/behind summary 与 target branch value
  使用相同语义色，同时保留原始文本、i18n、字段值和自然可读语义。
- Pull request payload 和最终 Git command 与变更前保持一致。
- focused Vitest、TypeScript typecheck、lint、large-file gate 与 strict OpenSpec validation 通过。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `git-history-panel`: Pull Dialog 的 intent details 从固定文案扩展为随当前 option selection 动态变化的组合语义说明。

## Impact

- Frontend：`src/features/git-history/components/git-history-panel/**`。
- i18n：`src/i18n/locales/*/git.ts`。
- Tests：Git History Pull Dialog focused unit/component tests。
- Styling：仅在现有 intent details card 内增加最小 presentation styles（如确有需要）。
- Backend/API/dependencies：无变化。
