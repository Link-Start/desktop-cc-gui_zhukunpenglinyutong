# skills-menu-build-ci-maintenance Specification

## Purpose
TBD - created by archiving change retro-skills-menu-build-and-ci-maintenance. Update Purpose after archive.
## Requirements
### Requirement: Agent skills MUST remain workflow assets

`.agents/skills/**` 下的 Agent skills SHALL 作为 AI workflow assets，不得成为普通 desktop runtime startup 的必需条件。

#### Scenario: 正常启动 desktop app

- **WHEN** 正常启动 desktop app
- **THEN** 当用户正常启动桌面应用时，app startup 不得要求执行 `.agents/skills/**`；skills 仅供 AI workflow tooling 使用。

### Requirement: Desktop menu MUST keep DevTools toggle isolated

Desktop menu SHALL 可以暴露 localized DevTools toggle，但激活前不得改变普通 runtime behavior。

#### Scenario: 打开 app menu

- **WHEN** 打开 app menu
- **THEN** 当平台支持 app menu 时，可以展示 DevTools toggle；未激活前不得影响普通运行。

### Requirement: macOS DMG volume name MUST use product-safe name

macOS DMG build scripts SHALL 使用 product-safe volume name，避免平台权限问题。

#### Scenario: macOS 26 构建 DMG

- **WHEN** macOS 26 构建 DMG
- **THEN** 当 build script 创建 DMG volume 时，volume name 必须使用 `ccgui` 或其他验证过的 product-safe name，避免已知 EPERM failure。

### Requirement: Builtin Claude model catalog MUST respect override precedence

Builtin Claude model catalog SHALL 提供 fallback model facts，同时保留 explicit override precedence。

#### Scenario: 存在 custom override

- **WHEN** 存在 custom override
- **THEN** 当 override 或 provider-managed catalog 提供 model facts 时，它必须优先于 builtin fallback，Composer-visible model list 必须 deterministic。

