## Why

代码块和文件变更是 AI coding transcript 的高价值信息。用户需要快速判断“这段代码是什么语言”“这个文件被怎么改了”“能否复制/审查”。如果每个 surface 自己渲染文件变更，消息、Composer、tool block、Git diff 会出现不同密度和不同语义。

既成事实是：代码块语言徽标和复制按钮已经抽为共享能力，`FileChangeRow` 已经承担 compact per-file change rendering，Git diff toolbar 也向同一 token 风格靠拢。

本 proposal 补齐 contract：紧凑不是隐藏信息，统一不是改变 diff model。

## What Changes

- 抽取 code block language icon/copy affordance。
- 新增并复用 `FileChangeRow`。
- 把 file-change evidence 收敛为 per-file compact rows。
- Git diff toolbar 和 tool row 使用 shared visual tokens。

## Scope / Impact

- Affected commits: `f80683bd`, `599db468`, `6a4ef2bd`, `1884d0c0`.
- Impact file/surface: `src/features/messages/components/Markdown.tsx`
- Impact file/surface: `src/features/messages/components/codeBlockLanguageIcon.tsx`
- Impact file/surface: `src/features/messages/components/toolBlocks/FileChangeRow.tsx`
- Impact file/surface: `src/features/git/components/GitDiffPanel*.tsx`
- Impact file/surface: `src/styles/messages.part1.css`
- Impact file/surface: `src/styles/diff.css`
- Impact file/surface: `src/styles/tool-blocks.css`

## Non-Goals

- 不改变 diff 计算模型。
- 不改变文件写入或 Git backend command。
- 不改变 Markdown parser pipeline。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
