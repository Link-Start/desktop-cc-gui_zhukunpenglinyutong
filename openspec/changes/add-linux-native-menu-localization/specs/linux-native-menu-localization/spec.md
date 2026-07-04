## ADDED Requirements

### Requirement: The Native Menu MUST Be Built In The Saved UI Language

系统 MUST 在构建原生（GTK/AppKit）菜单时使用用户已保存的界面语言，而不是写死单一语言，因为原生菜单在 Rust 层构建、无法访问 React i18next 层。

The native menu bar is constructed in Rust and cannot reach the React i18next
layer, so its labels must be sourced from a Rust-side mirror of the `menu.*`
translation keys, selected by the saved language.

#### Scenario: native menu labels follow the saved language at build time

- **WHEN** 系统构建原生菜单
- **THEN** 每个菜单项的标签 MUST 取自与当前已保存语言对应的标签集合
- **AND** 标签集合 MUST 覆盖全部菜单项（File / Edit / Composer / View 等）
- **AND** Rust 侧标签 MUST 与 `src/i18n/locales/*/menu` 的键保持一致

#### Scenario: Linux builds in-language rather than relying on runtime relabel

- **GIVEN** 运行平台为 Linux（GTK/muda）
- **WHEN** 用户的保存语言不是默认语言
- **THEN** 系统 MUST 在构建时就以正确语言创建菜单
- **AND** 系统 MUST NOT 依赖运行时 `menu_update_labels` 重绘 GTK 菜单栏（muda/GTK 限制下不可靠）
- **AND** 运行时切换语言 MAY 在下次启动时才完全生效

#### Scenario: adding a locale is a single constructor

- **WHEN** 新增一个受支持语言
- **THEN** 只 MUST 新增一个标签集合构造器
- **AND** 既有语言的菜单构建路径 MUST NOT 需要改动
