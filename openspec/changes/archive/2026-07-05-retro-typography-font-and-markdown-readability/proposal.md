## Why

这组提交看起来是 typography polish，但实际影响的是所有长文本阅读面：conversation Markdown、file preview、Spec Hub、settings label、sidebar text density。字体一旦没有规范，后续每个 UI 细节都会用自己的字号、line-height、font-family 解决局部问题，最后形成不可维护的视觉噪声。

既成事实是：UI chrome 已经转向 SF Pro 语义变量，Markdown/document reading surface 引入 Geist local asset，并调整了 base/message typography。OpenSpec 需要记录“UI chrome”和“长文阅读面”是两个不同目标，不应该被一个全局字体选择简单覆盖。

用户已经确认新代码体验满意，因此这里补的是已完成变更的行为边界：字体本地打包、设置项语义不变、Markdown 可读性优先。

## What Changes

- 引入 `src/assets/fonts/Geist-Variable.woff2` 和 `geist.css`。
- 通过 `typographyCssVars` 和 `fonts.ts` 统一 UI 字体变量。
- 调整 Markdown message styles，提升段落、代码、列表的阅读节奏。
- 保留 settings 中用户字体/字号配置的既有语义。

## Scope / Impact

- Affected commits: `aad3d7a3`, `9d480e77`.
- Impact file/surface: `src/assets/fonts/**`
- Impact file/surface: `src/features/app/utils/typographyCssVars.ts`
- Impact file/surface: `src/utils/fonts.ts`
- Impact file/surface: `src/styles/base.css`
- Impact file/surface: `src/styles/messages.part2.css`
- Impact file/surface: `src/features/settings/**`

## Non-Goals

- 不引入在线字体加载。
- 不重写 Markdown parser。
- 不改变用户自定义字体设置的数据结构。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
