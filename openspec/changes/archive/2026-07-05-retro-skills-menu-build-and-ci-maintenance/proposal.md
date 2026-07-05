## Why

这组提交分散在 workflow assets、desktop menu、build scripts、CI、i18n、model catalog，但都属于支撑产品质量的维护面。它们如果没有 OpenSpec，很容易被误认为“杂项 chore”，后续回归时找不到边界。

既成事实是：`.agents/skills` 增加 Vercel optimize 和 writing guidelines；桌面菜单新增 DevTools toggle；DMG volume rename 为 `ccgui` 避免 macOS 26 EPERM；PR workflow 停止在 pull requests 上运行；browserAgent locale 拆分；builtin Claude model catalog 增加 override precedence。

OpenSpec 需要把这些维护动作写成几个清楚的 contract：skills 不参与 runtime startup，DevTools menu 是调试入口，build script 使用 product-safe volume name，model catalog fallback 必须尊重 override。

## What Changes

- 新增 Vercel optimize 和 writing guidelines skills。
- 新增 localized DevTools menu item。
- macOS DMG volume rename to `ccgui`。
- 调整 PR workflow policy。
- 拆分 browserAgent locale。
- 新增 builtin Claude model catalog with override precedence。

## Scope / Impact

- Affected commits: `5b49eb12`, `7a1d11e5`, `446af282`, `feabe0b7`, `9e779014`, `22c9092d`.
- Impact file/surface: `.agents/skills/**`
- Impact file/surface: `skills-lock.json`
- Impact file/surface: `src-tauri/src/menu.rs`
- Impact file/surface: `src-tauri/Cargo.toml`
- Impact file/surface: `scripts/build-platform.mjs`
- Impact file/surface: `scripts/create-dmg.sh`
- Impact file/surface: `.github/workflows/**`
- Impact file/surface: `src/i18n/locales/**`
- Impact file/surface: `src-tauri/src/engine/**`
- Impact file/surface: `openspec/specs/**`

## Non-Goals

- 不验证 Vercel external service behavior。
- 不改变 release signing/notarization policy。
- 不替代 provider-managed model catalogs。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
