## Context

`SettingsView` 以 TypeScript `AppSettings` 构造完整 payload，经 `update_app_settings` 交给 Rust。Rust 使用强类型 `AppSettings` deserialize/serialize；当前一批 frontend shortcut fields 未在 Rust struct 中声明，因此 save/echo 会静默删除这些字段。Settings 的 draft effect 随 `appSettings` 回写，最终表现为“录入后自动还原”。

快捷键展示已由 `shortcutActions` metadata、shared parser/formatter/matcher 和若干 AppShell handlers 驱动。常用模块应建立在该 contract 上，不引入第二套配置模型。

## Goals / Non-Goals

**Goals:**

- 让 TypeScript 与 Rust 的全部 shortcut fields 形成对称 persistence contract。
- 用 metadata projection 在顶部展示常用模块，不复制 setting state。
- 新模块 actions 复用既有 view handlers，并通过统一 keyboard dispatcher/matcher 触发。
- 保持旧 JSON backward compatible，缺失新字段时安全使用默认值。

**Non-Goals:**

- 不实现快捷键冲突解析 UI、chord 或 key sequence。
- 不重构整个 `AppSettings` schema 或 AppShell orchestration。
- 不改变模块内部状态模型。

## Decisions

### Decision: Rust 显式镜像全部 shortcut fields

为 `src-tauri/src/types.rs::AppSettings` 补齐 serde-renamed `Option<String>` fields 与集中 default functions。相比用 `flatten` 保存任意未知 JSON，这能保持 compile-time contract、默认值与测试可见性，避免 settings 文件成为无类型 bag。

### Decision: 常用分组是 metadata projection

在 `ShortcutActionMetadata` 增加 `featured` 标记。顶部 `common` group 过滤 featured actions；原有 semantic category 继续渲染同一 action。相比复制 action definitions，此方案保证 setting key、label、default、scope 始终只有一个事实源。

### Decision: 新视图快捷键默认 `null`

Git Graph、Notes、Intent Canvas、Radar、Project Map、Browser Dock、File Compare 没有经过跨平台 collision audit 的安全默认组合，因此显式默认 `null`。用户配置后由 shared parser/matcher 处理。

### Decision: 复用现有 AppShell view handlers

新增 feature-local hook 只负责 keyboard dispatch，不重建 view transitions。它接收现有 `handleOpenGitHistoryPanel`、`handleOpenIntentCanvas`、`handleOpenProjectMap`、Browser Dock 与 File Compare callbacks；Notes/Radar 仅补充与当前 toolbar 等价的窄 handler。

## Risks / Trade-offs

- [同一 action 在 common 与原分组重复展示] → 两处引用同一 setting，更新会同步；这是置顶快速访问的有意 trade-off。
- [新 action 与用户已有 shortcut 冲突] → 默认 `null`；不主动覆盖用户设置，后续可独立增加 conflict UI。
- [AppShell callback identity 引起 listener 重注册] → 使用现有 stable event callback/callback 模式，并通过 `registerKeydownHandler` cleanup。
- [Rust/TypeScript contract 再次漂移] → 增加覆盖完整 shortcut payload 的 Rust round-trip regression test。

## Migration Plan

1. 先补齐 Rust 旧缺失 fields，确保现有用户自定义值不再丢失。
2. 再添加七个新 module fields，missing JSON 使用 `null`。
3. 发布 frontend metadata/UI/handler wiring。
4. 回滚时可整体移除新增 action wiring；已保存的未知 JSON fields 在旧版 Rust 中会被忽略，不影响启动。

## Open Questions

无。新模块默认不绑定按键，冲突策略留待独立需求。
