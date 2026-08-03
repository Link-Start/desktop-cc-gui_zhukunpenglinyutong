# Design — CLI 可见性开关与分组

## 核心决策

### 1. 分组唯一维度是用户意愿

每个 CLI 有三个正交状态：`supported`（应用是否实装）、用户开关（新增）、`hasConfig` / installed（状态标记）。分组只按「用户意愿 × supported」划分：

| 组 | 条件 | 默认折叠 | 行尾交互 |
|---|---|---|---|
| 已启用 | `supported && !disabled` | 展开 | hover「...」菜单 → 关闭启用 |
| 未启用 | `supported && disabled` | 折叠；空组不渲染；用户新停用某 CLI 时自动展开一次给出可见归宿（初次挂载不自动展开） | hover「...」菜单 → 启用 |
| 暂未开放 | `!supported` | 折叠（15 项太长） | 无，维持整行置灰 |

`hasConfig` 绿点语义不变，继续作为行内状态标记；installed 探测不出现在设置页分组维度中。

行内交互刻意不用常驻 Switch：20 行 × 常驻 Switch 视觉噪音大，且「关闭启用」是低频操作。改为行 hover / focus 时行尾浮现「...」（ellipsis）按钮，点击弹出 dropdown（`关闭启用` / `启用`），菜单打开期间按钮保持可见（`data-state="open"`）；触屏无 hover 场景下通过 focus-visible 与点击同样可达。

### 2. 持久化用黑名单而非白名单

`AppSettings.disabledCliEngines: string[]`，默认 `[]` = 全部启用：

- 老用户升级后行为零变化（向后兼容）。
- 未来新增 supported CLI 自动默认可见，无需迁移。
- 停用的语义是「用户主动关过」，白名单会把「从未见过」误表达为「不想要」。

死字段 `geminiEnabled` / `opencodeEnabled`（type + 两处默认值 + 测试引用）随本变更移除；用户 settings.json 中残留的多余 key 在读取时天然被忽略，无迁移成本。

### 3. 开关只控制可见性，不动配置数据

停用 CLI 不触碰其供应商配置 / 本地 settings 文件；内容区配置页仍可通过点击「未启用」组的行打开编辑。重新启用即恢复原状。

### 4. composer 联动与 availability 语义隔离

`providerAvailability` 语义保持「后端探测可用性」（未安装会展示 statusLabel / disabledMessage）。用户开关作为独立的 visibility 维度进入 `ProviderSelect`：

```text
visible = userVisible(provider.id) && (available(provider.id) || provider.id === value)
```

- 已停用引擎从下拉消失；当前选中引擎已停用时仍显示当前值（沿用现有 `id === value` 兜底）。
- 已有会话、共享会话、ThreadList 等只读 surface 不受影响。
- 允许全部停用；不做「至少保留一个」的强制挽留。

### 5. 搜索与移动端

- 搜索输入时退回现有平铺过滤行为（不分组、无 header）。
- 移动端（`max-md` 横排导航）隐藏组 header，按 已启用 → 未启用 → 暂未开放 顺序平铺。

## 数据流

```text
VendorSettingsPanel 行「...」菜单
  → onUpdateAppSettings({ ...appSettings, disabledCliEngines })
  → useAppSettings 持久化（settings.json）
  → appSettings 回流 VendorSettingsPanel（分组重算）
  → cliEngineVisibilityStore seed → composer ProviderSelect 过滤下拉项
```

## 6. Commit message picker data flow

```text
BUILTIN_ENGINE_TYPES
  -> isEngineExecutionEnabled
  -> disabledCliEngines snapshot
  -> CommitMessageEnginePicker
  -> language selection
  -> runGeneration / persist last config
```

`useCommitMessageGenerationMenu` 在每次打开菜单时读取 visibility snapshot，避免把低频菜单状态订阅到 GitDiff/GitHistory render chain。`RendererContextMenuState.content` 提供 feature-owned custom content；既有 generic items 继续承载“提交框位置”等扩展项。language 只保存在 picker local state，点击 engine 后立即关闭菜单并进入既有 generation flow。

picker 使用统一的 `296x352` positioning estimate。bottom composer 向上并与 trigger 右边缘对齐，top composer 向下展开；两种 placement 均保留 12px viewport boundary。视觉层去掉重复标题并压缩 row density，确保 enabled engines 与 generic extra items 在常规窗口内同时可达。
