## Why

这批提交不是大功能，但都作用在高频扫描界面：SearchPalette 要快速扫结果，ReleaseNotesModal 要快速读版本变化，Git Diff panel 要快速识别改动。

既成事实是：搜索面板右侧项目图标被移除以降低噪声；release notes header 和导航按钮被重做；diff panel 的强调蓝收敛到 theme token，并压平多余内阴影。

OpenSpec 要记录这类 polish 的判断标准：少一点装饰，多一点可扫描性；使用 theme token，而不是局部硬编码。

## What Changes

- 移除 SearchPalette 右侧 project icon。
- 精修 SearchPalette、settings nav、sidebar 局部细节。
- 重构 ReleaseNotesModal header 和 navigation buttons。
- Diff panel emphasis color 收敛到 theme token，并减少 inner shadow noise。

## Scope / Impact

- Affected commits: `9928070d`, `2cd6873e`, `ca830212`, `c6d61eca`.
- Impact file/surface: `src/features/search/components/SearchPalette.tsx`
- Impact file/surface: `src/features/update/components/ReleaseNotesModal.tsx`
- Impact file/surface: `src/styles/search-palette.css`
- Impact file/surface: `src/styles/release-notes.css`
- Impact file/surface: `src/styles/diff.css`
- Impact file/surface: `src/styles/settings.part1.css`
- Impact file/surface: `src/styles/sidebar.css`

## Non-Goals

- 不改变 search index/query behavior。
- 不改变 release note content source。
- 不改变 Git diff data model。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
