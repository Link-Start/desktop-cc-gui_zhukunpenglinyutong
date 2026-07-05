## Context

记录搜索面板、release notes modal、diff panel token 和阴影等 scan-heavy surface 的已完成 polish。

这批提交不是大功能，但都作用在高频扫描界面：SearchPalette 要快速扫结果，ReleaseNotesModal 要快速读版本变化，Git Diff panel 要快速识别改动。

## Decisions

- Search result labels/actions 优先于 decorative chrome。
- Release navigation 保持紧凑可读。
- Diff emphasis 使用 theme-compatible tokens。

## Risks And Guardrails

- 移除图标降低某些用户对 scope 的识别。
- Diff 视觉压平后 emphasis 不足。
- 防线：scan-first，必要时通过文本/分组而不是装饰恢复信息。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-search-release-notes-and-diff-polish --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
