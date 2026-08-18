## MODIFIED Requirements

### Requirement: Settings appearance SHALL expose a scannable wallpaper entry

Settings → 基础 → 外观 MUST 用 preference row + segmented control 提供三个选项。自定义态 MUST 额外提供选择图片与清除。弹层 / Dialog MUST 保持不透明。Windows MUST 与其它平台展示同一段页面背景入口，MUST NOT 因 `isWindowsPlatform` 隐藏该行。

#### Scenario: Appearance section lists three wallpaper modes

- **WHEN** 用户打开设置外观
- **THEN** 系统 MUST 展示「流体背景 / 不要背景 / 自定义」分段控件
- **AND** 当前选中项 MUST 与持久化 mode 一致

#### Scenario: Windows appearance still lists wallpaper controls

- **WHEN** 操作系统为 Windows 且用户打开设置外观
- **THEN** 系统 MUST 展示页面背景入口与流体选项
- **AND** MUST NOT 因平台把该行整段隐藏

#### Scenario: Custom controls appear only for custom mode

- **WHEN** 当前 mode 不是 `custom`
- **THEN** 系统 MUST NOT 展示上传 / 清除控件
- **WHEN** 用户切到 `custom`
- **THEN** 系统 MUST 展示选择图片入口；已有路径时 MUST 可清除

### Requirement: Main window SHALL render a configurable workspace wallpaper

主窗口进入后 MUST 按 `AppSettings.workspaceWallpaper` 渲染背景。默认 mode MUST 是 `none`：缺字段或尚未被用户改过时 MUST NOT 自动开背景。用户 MUST 能在 Settings 外观中选择 `none`（不要背景）、`fluid`（流体背景）或 `custom`（上传本地图片）。该设置 MUST 跨重启保持。系统 MUST NOT 把 wallpaper 状态写入 AppShell domain bag。Windows MUST 使用与其它平台相同的 mode 解析，MUST NOT 把已保存的 `fluid` / `custom` 强制改成 `none`。

#### Scenario: Fresh settings keep wallpaper off

- **WHEN** 主窗口启动且 `workspaceWallpaper` 缺省或尚未被用户改过
- **THEN** 系统 MUST 保持实色主题底，MUST NOT 挂 wallpaper 层
- **AND** MUST NOT 在 about / detached 窗口渲染该背景

#### Scenario: User turns wallpaper off

- **WHEN** 用户在设置中选择「不要背景」
- **THEN** 系统 MUST 立即移除 wallpaper 层并恢复实色主题底
- **AND** 重启后 MUST 仍保持 `none`

#### Scenario: Windows fluid wallpaper mounts the shader canvas

- **WHEN** 操作系统为 Windows 且用户选择流体背景
- **THEN** 系统 MUST 挂 wallpaper 层并 attach WebGL2 canvas
- **AND** MUST NOT 用实色层替代 canvas，除非 WebGL2 / compile 失败后走 CSS fallback

#### Scenario: User uploads a custom image

- **WHEN** 用户选择「自定义」并挑中一张本地 png / jpg / jpeg / webp / gif
- **THEN** 系统 MUST 把该绝对路径写入 `workspaceWallpaper.customImagePath`
- **AND** 主窗口 MUST 以 cover 方式铺满该图片

#### Scenario: Custom path is missing or invalid

- **WHEN** mode 为 `custom` 但路径为空、扩展名非法，或资源无法加载
- **THEN** 系统 MUST 安全回退到 `fluid`
- **AND** MUST NOT 因这次回退改写用户尚未确认的合法存储值（仅运行时显示回退；sanitize 可在读入时把非法值写成 `fluid`）

### Requirement: Settings appearance SHALL list fluid motions next to palettes

Settings → 基础 → 外观在 `mode === "fluid"` 时 MUST 在配色点下方展示五个动势芯片：流动、太极、暴风雨、龙卷风、游走。当前选中项 MUST 与持久化 `fluidMotion` 一致。`mode` 不是 `fluid` 时 MUST NOT 展示动势芯片。Windows MUST 继续展示整段 wallpaper 入口，MUST NOT 隐藏动势芯片。

#### Scenario: Fluid mode shows five motion chips

- **WHEN** 用户打开设置外观且 wallpaper 为流体
- **THEN** 系统 MUST 展示五个动势芯片
- **AND** 点击某一芯片 MUST 写入对应 `fluidMotion`

#### Scenario: Motion chips hide when wallpaper is not fluid

- **WHEN** wallpaper mode 为 `none` 或 `custom`
- **THEN** 系统 MUST NOT 展示动势芯片

#### Scenario: Windows fluid motion chips each render their own field

- **WHEN** 操作系统为 Windows 且用户选择流体背景并切换动势芯片
- **THEN** 系统 MUST 渲染对应该芯片的场（流动 / 太极 / 暴风雨 / 龙卷风 / 游走）
- **AND** MUST NOT 把太极或更后的档静默画成流动
- **AND** 游走全量 shader compile 失败时 MUST 使用降级变体或 CSS fallback，MUST NOT 假装仍是流动
