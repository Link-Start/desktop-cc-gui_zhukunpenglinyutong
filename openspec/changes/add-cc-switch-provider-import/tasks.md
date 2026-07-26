# add-cc-switch-provider-import Tasks

## 1. Backend: CC Switch 只读命令

- [x] 1.1 新增 `src-tauri/src/vendors/cc_switch.rs`：`CcSwitchProvider` / `CcSwitchProviderList` 结构；home dir 路径解析（`.cc-switch/cc-switch.db` → `config.json` 兜底）；rusqlite read-only 查询；baseUrl/hasApiKey 按类型提取（codex TOML 解析）
- [x] 1.2 Rust 单测：claude/codex 条目映射、baseUrl 提取（含 TOML 缺失/解析失败）、JSON 兜底解析、数据源缺失返回 `available=false`（用 tempdir 注入路径，测试不依赖真实 home）
- [x] 1.3 `vendors/mod.rs` 声明模块；`vendors/commands.rs` 注册 `vendor_list_cc_switch_providers` 并在 `lib.rs` invoke handler 挂载

## 2. Frontend service 与类型

- [x] 2.1 `src/services/tauri/vendors.ts` 新增 `listCcSwitchProviders(appType)` + `CcSwitchProvider` 类型导出（经 `services/tauri.ts` re-export）

## 3. 导入对话框与 hook

- [x] 3.1 `src/features/vendors/hooks/useCcSwitchImport.ts`：加载、勾选、全选、name+baseUrl 归一化去重、按 appType 映射并循环调用 add service、成功/失败汇总
- [x] 3.2 `useCcSwitchImport.test.tsx`：去重命中/未命中、映射结果（claude/codex/kimi 三种）、空态、部分失败汇总
- [x] 3.3 `src/features/vendors/components/CcSwitchImportDialog.tsx`：复刻 CC Switch 选择式 UI（左分类列、右勾选列表、已导入徽标、全选、底部计数、成功横幅、空态）

## 4. 页面接线

- [x] 4.1 `ProviderList.tsx` / `CodexProviderList.tsx` / `KimiProviderList.tsx` 各加 `trailingActions?: ReactNode`，渲染在「+ 添加」之后
- [x] 4.2 `VendorSettingsPanel.tsx`：claude/codex tab 注入「导入」按钮（`trailingActions`）+ 挂载 `CcSwitchImportDialog`（claude→claude、codex→codex 数据源），导入完成后触发对应列表刷新；Kimi 按钮按用户决策 v1 隐藏（hook 映射保留）

## 5. i18n

- [x] 5.1 `settings.vendor.ccSwitchImport.*` 文案（zh/en；`settings.vendor` 命名空间仅存在于 zh/en，其余 locale 走 fallback，与既有 vendor key 同构）

## 6. 验证

- [x] 6.1 `cargo test --manifest-path src-tauri/Cargo.toml`（含新增单测）
- [x] 6.2 `npm run typecheck` + `npm run lint`
- [x] 6.3 受影响 Vitest 套件（vendors feature）通过
- [x] 6.4 `openspec validate add-cc-switch-provider-import --strict --no-interactive`
- [ ] 6.5 手工冒烟：启动 app，三页分别打开导入对话框，勾选导入并在列表中确认条目与字段（本机有真实 CC Switch DB）
