## 1. Explanation Model

- [x] 1.1 [P0] [依赖: 无] 输入现有 `GitPullStrategyOption | null`、`noCommit`、`noVerify`，
  实现 feature-local typed pure resolver；输出 strategy-level intent/boundary 与 context-aware effect keys；
  以 table-driven Vitest 覆盖 default、四种 strategy 和代表性 additive combinations。

## 2. Pull Dialog Presentation

- [x] 2.1 [P0] [依赖: 1.1] 输入 resolver view model 和现有 `t(...)`，在 Pull Dialog 的
  `Intent / Will Happen / Will NOT Happen` card 中渲染动态说明；输出保持现有 option handlers、
  chips、command preview、confirm payload 不变的 presentation。
- [x] 2.2 [P1] [依赖: 2.1] 输入现有 facts card layout，增加 effect rows 所需的最小 feature-scoped CSS；
  输出支持窄窗口自然换行且不改变 Dialog width。
- [x] 2.3 [P0] [依赖: 2.1] 输入现有 `pullOptionsMenuOpen` toggle，在每次打开 Pull Dialog 时默认展开；
  输出 option controls 无需额外点击即可发现，同时保留手动收起、展开与原 selection handlers。
- [x] 2.4 [P1] [依赖: 2.1] 输入既有 `pullExampleCommand` constituent values，生成 shared ordered token list；
  输出 hero preview 与底部 `Example` 的一致 token coloring，完整 command string 与 ordering 不变。
- [x] 2.5 [P1] [依赖: 2.4] 抽取 typed feature-local `GitOperationTokens` renderer，并扩展到 Fetch
  `Example`、Sync route/summary/hero/Example、Push route/target branch；输出 shared semantic colors，
  原始 text/value/handler/payload 不变。

## 3. Localization

- [x] 3.1 [P0] [依赖: 1.1] 输入 resolver 使用的 translation keys，同步
  `src/i18n/locales/*/git.ts`；输出所有支持 locale 均有完整 copy，technical literals 保持 English。

## 4. Regression Coverage

- [x] 4.1 [P0] [依赖: 2.1, 3.1] 输入 Pull Dialog 交互，补充 component test：
  selection/chip removal 会同步更新说明和 command preview，且 confirm 前不执行 Pull。
- [x] 4.2 [P0] [依赖: 1.1, 2.1, 2.2, 3.1, 4.1] 运行 focused Vitest、`npm run typecheck`、
  `npm run lint`、`npm run check:large-files` 与 `openspec validate
  explain-git-pull-option-effects --strict --no-interactive`；输出全部 gate 结果并记录任何环境限制。
- [x] 4.3 [P0] [依赖: 2.3, 2.4] 更新 Pull Dialog component test，覆盖 options 默认可见、
  两处 command token structure、selection 后 command string 不变与 confirm 前不执行 Pull；运行 focused gates。
- [x] 4.4 [P0] [依赖: 2.5] 更新 Git History component tests，覆盖 Fetch、Sync、Push 框选 surface
  的 token classes、完整自然文本和既有 confirm payload；运行 focused gates 与 OpenSpec verify。

## 5. Review Hardening

- [x] 5.1 [P0] [依赖: 1.1, 3.1] 校准 `--no-ff` / `--squash` 及 additive option 的所有 locale copy；
  输出只承诺 merge-path effect，并明确 Git rebase configuration 仍可能生效。
- [x] 5.2 [P0] [依赖: 2.5] 移除 `code` / generic token root 上 prohibited accessible name，
  保留完整自然文本与 `translate="no"`；为动态 effect summary 增加 polite atomic status。
- [x] 5.3 [P0] [依赖: 4.1, 5.2] 更新 component tests，以可见 token text 验证着色 surface，
  并精确锁定选项组合的 Pull request payload。
- [x] 5.4 [P0] [依赖: 5.1, 5.2, 5.3] 运行 focused Vitest、typecheck、lint、build、
  runtime/static-import contract、large-file gate、strict OpenSpec validation 与 verify。
