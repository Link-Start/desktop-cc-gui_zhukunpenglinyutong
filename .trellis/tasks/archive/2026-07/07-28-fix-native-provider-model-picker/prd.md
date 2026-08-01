# Native Provider Model Picker

## Goal

让单一 CLI 创建的 Native Session 按当前 CLI 展示 Provider Profiles 与各自 Model catalog，
并用互斥折叠降低菜单认知负担；跨 Provider 选择复用已有 Provider Continuation Dialog。

## OpenSpec

- Change: `fix-native-provider-model-picker`
- Source of truth: `openspec/changes/fix-native-provider-model-picker/**`

## Requirements

- Native picker 只展示当前 CLI 的 Providers，不展示其他 CLI。
- Provider Profile 的 Model 列表互斥展开。
- 当前 Provider 内切换 Model 不创建新 Session。
- 其他 Provider 下选择 Model 打开续接 Dialog，destination 冻结目标 Model。
- Kimi 未验证 destination capability 保持禁用并展示原因。
- Shared Session picker 行为保持不变。

## Acceptance Criteria

- [ ] Claude/Codex/Kimi Native Session 分别只显示自身 Provider Profiles。
- [ ] 任意时刻最多展开一个 Provider 的 Model 列表。
- [ ] 同 Provider Model selection 走当前会话 callback。
- [ ] 跨 Provider selection 在首次确认前无 side effect。
- [ ] Continuation request 包含目标 model，取消后来源状态不变。
- [ ] Focused tests、typecheck、OpenSpec strict validation 通过。

## Technical Notes

- 复用 Provider-scoped catalog cache 与现有 continuation operation/controller。
- 不新增依赖，不修改 Rust/Tauri command contract。
- Catalog 按需加载，不在 AppShell 根链增加轮询或全量预取。
