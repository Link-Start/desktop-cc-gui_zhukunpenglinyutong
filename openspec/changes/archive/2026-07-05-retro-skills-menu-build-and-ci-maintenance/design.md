## Context

记录 Vercel/writing skills、DevTools 菜单、macOS 26 DMG volume rename、PR workflow、locale split、builtin Claude model catalog override precedence。

这组提交分散在 workflow assets、desktop menu、build scripts、CI、i18n、model catalog，但都属于支撑产品质量的维护面。它们如果没有 OpenSpec，很容易被误认为“杂项 chore”，后续回归时找不到边界。

## Decisions

- Skills 是 AI workflow assets，不是 desktop runtime dependency。
- DevTools menu 是 platform debug affordance。
- DMG volume name 使用稳定 product-safe name。
- Locale splitting 用于控制大文件和加载边界。
- Builtin Claude model catalog 是 fallback facts，explicit override 优先。

## Risks And Guardrails

- Skills 目录被误打包成 runtime 必需依赖。
- CI policy 变更降低 PR 反馈。
- Builtin catalog 覆盖用户/provider override。
- 防线：runtime 不执行 skills；catalog precedence 有测试和 spec。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-skills-menu-build-and-ci-maintenance --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
