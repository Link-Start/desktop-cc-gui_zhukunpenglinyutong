# Tasks

## 1. OpenSpec / Contract

- [x] 1.1 创建 proposal / design / tasks / spec delta
- [ ] 1.2 实现后 sync 主 spec（`cli-engine-visibility`，archive 时执行）

## 2. AppSettings 持久化

- [x] 2.1 `src/types/settings.ts` 新增 `disabledCliEngines: string[]`；移除 `geminiEnabled` / `opencodeEnabled`
- [x] 2.2 `useAppSettings` 两处默认值补 `disabledCliEngines: []`，同步清理死字段默认值与其测试引用
- [x] 2.3 Rust `AppSettings` struct 补 `disabledCliEngines`（修复 serde 静默丢字段导致开关无效）+ round-trip 测试锁定

## 3. VendorSettingsPanel 分组 + hover「...」菜单

- [x] 3.1 分组计算：`enabledItems` / `disabledItems` / `upcomingItems`（`groupCliEngineNavItems`，cliEngineNav）
- [x] 3.2 组 header（chevron + 组名）+ 折叠 local state（未启用 / 暂未开放默认折叠，未启用空组不渲染，新停用时自动展开一次）
- [x] 3.3 supported 行 hover「...」（ellipsis）dropdown 菜单（关闭启用 / 启用），切换调 `onUpdateAppSettings`
- [x] 3.4 搜索时平铺过滤（维持现状）；移动端横排隐藏组 header 按组序平铺
- [x] 3.5 CSS：组 header / 主按钮 / 折叠 / 空态 / hover 浮现「...」（hover / focus-visible / data-state=open 三态可见）

## 4. i18n

- [x] 4.1 zh / en 补齐：`cliGroupEnabled` / `cliGroupDisabled` / `cliGroupUpcoming` / `cliGroupEnabledEmpty` / `cliMoreActions` / `cliDisableEngine` / `cliEnableEngine`（其余 locale 走 fallback：zh-TW→zh，其它→en）

## 5. composer 联动

- [x] 5.1 settings 通路：新增 `cliEngineVisibilityStore` 外部 store（同构 composerEnginePrefsStore），`useAppShellComposerPrefsPersistence` 随设置变化 seed
- [x] 5.2 `ProviderSelect.visibleProviders` 过滤接入用户开关，保留 `id === value` 兜底

## 6. 测试

- [x] 6.1 `VendorSettingsPanel.test.tsx`：分组渲染 / 「...」菜单停用与重新启用持久化 / 搜索平铺 / 折叠 / 空组 / 新停用自动展开 / 停用后配置页可达
- [x] 6.2 `useAppSettings.test.ts`：新字段默认值 + 归一化（去重/滤非字符串）+ 死字段移除
- [x] 6.3 `ProviderSelect.test.tsx`：停用引擎隐藏 + 当前值兜底

## 7. Verify

- [x] 7.1 `tsc --noEmit` 干净；vendors + ChatInputBox + settings 相关 72 文件 533 用例全绿
- [ ] 7.2 手工：停用 OpenCode → 设置页落组 + composer 下拉消失 → 重启保持 → 重新启用配置原样
