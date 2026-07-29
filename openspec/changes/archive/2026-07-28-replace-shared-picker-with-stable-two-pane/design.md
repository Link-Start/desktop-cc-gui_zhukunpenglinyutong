## Context

问题不是 accordion state，而是两个 Radix menu focus scope 的 ownership 冲突：
Provider row 位于 portal 化的 `DropdownMenuSubContent`，父 root 与子 submenu 都能处理
focus transfer、pointer grace 与 dismiss。jsdom 无法完整复现 Tauri WebView 的原生 focus
序列，因此此前测试通过但实机失败。

## Logic Flow

1. 打开 Shared picker。
2. 选择当前 `ExecutionTarget.engine`，否则选择首个 enabled CLI。
3. 在同一个 root `DropdownMenuContent` 中渲染：
   - 左栏：CLI groups。
   - 右栏：active CLI 的 Provider Profiles 与 Models。
4. CLI item 的 non-terminal activation 使用 `preventDefault()`，仅更新 active group。
5. Provider item 的 non-terminal activation 使用 `preventDefault()`，仅更新唯一
   `expandedProviderProfileKey`。
6. Model item 是 terminal action：提交 `ExecutionTarget` 并关闭 root。

## Decisions

### 1. 单一 Radix focus surface

Shared target picker 不再使用 `DropdownMenuSub`。定位、outside dismiss、Escape 与 keyboard
仍由现有 root `DropdownMenu` 提供；只把内容布局改成双栏。

### 2. active CLI 是 local presentation state

新增 `activeTargetGroupId`，只决定右栏展示，不写入 `ExecutionTarget`。只有选中 Model 才
改变执行目标，避免浏览列表产生业务副作用。

### 3. lazy profile load 只在 group activation 时触发

激活 CLI 时调用既有 `openDefaultProviderProfile(group)`。不遍历加载所有 Profile，也不在
pointer move 高频触发，避免卡顿与重复 bridge request。

## Risks / Trade-offs

- 双栏 root 宽度增加：使用 viewport max-width，右栏允许纵向滚动。
- CLI hover 可能频繁切换：仅在 group id 变化时更新与加载。
- Legacy `modelGroups` 仍需 nested submenu：本次只移除 Shared `targetGroups` path，
  避免扩大回归范围。

## Verification

- Focused Vitest：结构、CLI activation、A/B accordion、terminal selection。
- TypeScript typecheck、ESLint、runtime contracts。
- 只在 `src-tauri/target/debug/cc-gui` 开发者模式实机重复点击验证。

## Rollback

回滚本 change 的双栏 render 与 `activeTargetGroupId`。无数据迁移。
