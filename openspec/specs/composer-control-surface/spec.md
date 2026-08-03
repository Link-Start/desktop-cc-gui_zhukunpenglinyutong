# composer-control-surface Specification

## Purpose
TBD - created by archiving change stabilize-composer-control-surface. Update Purpose after archive.
## Requirements

### Requirement: Composer Provider Header MUST Expose Source-Correct Catalog Actions

普通 Composer 的 Provider Profile 标题区 MUST 展示 config reload，并仅在 CLI
capability 支持时展示 model discovery。

#### Scenario: Config-only Provider

- **WHEN** 当前 Provider Profile 的 CLI 不支持 model-list
- **THEN** 标题区 MUST 仅显示 `Reload Config`
- **AND** 点击后 MUST 更新当前模型框的 configured catalog

#### Scenario: Discovery-capable Provider

- **WHEN** 当前 Provider Profile 的 CLI 支持 model-list
- **THEN** 标题区 MUST 同时显示 `Reload Config` 与 `Discover Models`
- **AND** 两个 icon button MUST 有独立 accessible name、loading 与 error state

#### Scenario: Refresh preserves selection

- **WHEN** 任一 catalog action 完成
- **THEN** 当前有效 selection MUST 保留
- **AND** UI MUST NOT 因 catalog refresh 偷偷切换模型

### Requirement: Composer Target Selector MUST Live In The Readiness Bar

Composer MUST expose the effective provider/model target through the readiness bar, and that target MAY act as the model selector trigger. The bottom toolbar MUST NOT duplicate the model selector.

#### Scenario: readiness target opens model selector

- **WHEN** the user clicks the provider/model target in the Composer readiness bar
- **THEN** the system MUST open the model selector for the effective composer target
- **AND** the selected model MUST be the same model consumed by the send path

#### Scenario: bottom toolbar omits model selector

- **WHEN** the Composer bottom toolbar renders
- **THEN** it MUST NOT render a second model selector
- **AND** the bottom toolbar SHOULD reserve space for tools, context tools, reasoning, usage, and send/stop controls

### Requirement: Model Selector MUST Use Compact Provider Groups

The model selector MUST present available providers as grouped compact options and avoid long descriptions in the primary list.

#### Scenario: compact model row

- **WHEN** the model selector lists provider models
- **THEN** each option MUST fit one visual row with the model label and selected check affordance
- **AND** it MUST NOT show long descriptive copy in the primary list row

#### Scenario: Gemini availability creates a group

- **WHEN** Gemini is detected as available for composer use
- **THEN** the model selector MUST include a Gemini group
- **AND** this MUST NOT depend on runtime model hydration already returning a non-empty Gemini list

#### Scenario: provider footer actions remain scoped

- **WHEN** the selector footer shows add/refresh actions
- **THEN** those actions MUST apply to the provider context represented by the selected group or effective target
- **AND** refreshing one provider MUST NOT start a conversation

### Requirement: Bottom Composer Tools MUST Be One Collapsible Icon Strip

Composer secondary controls MUST be managed by a single bottom inline tool strip that can be expanded or collapsed from the primary tool button.

#### Scenario: primary tool button toggles strip

- **WHEN** the user clicks the primary tool button
- **THEN** the inline tool strip MUST expand or collapse
- **AND** pressing Escape while expanded SHOULD collapse the strip

#### Scenario: secondary controls share one row

- **WHEN** the strip is expanded
- **THEN** config, shortcut actions, mode, plan toggle, context tools, panel toggle, memory reference, reasoning, and main usage controls SHOULD share the same visual row
- **AND** trailing controls MUST NOT remain outside the strip solely because they used to be right-aligned

#### Scenario: duplicate context usage is suppressed

- **WHEN** context tools render inside the inline strip
- **THEN** duplicate context usage indicators in that tool surface MAY be hidden
- **AND** the primary composer usage indicator MUST remain available in the main strip

### Requirement: Selected Context Chips MUST Live Above The Editor

Selected skill, command, and agent context chips MUST render as input context above the editable text area, not as controls inside the bottom toolbar.

#### Scenario: selected chips render in a separate context row

- **WHEN** skill, command, or agent context chips are selected
- **THEN** the Composer MUST render those chips above the editable text area in a dedicated context row
- **AND** the bottom toolbar MUST NOT render those selected context chips

#### Scenario: chip behavior is unchanged

- **WHEN** the user removes a selected context chip from the context row
- **THEN** the existing remove callback and selected state update MUST be used
- **AND** the move MUST NOT change message payload assembly, command selection, skill selection, agent selection, or send behavior

### Requirement: Inline Tool Icons MUST Be Theme-Safe And Icon-Only

Inline tool controls MUST render as compact icon-only affordances with consistent hit area, spacing, and theme-safe color.

#### Scenario: icon-only selected state

- **WHEN** mode, reasoning, or a related selector is selected
- **THEN** its collapsed toolbar representation MUST remain an icon
- **AND** it MUST NOT replace the icon with visible text

#### Scenario: compact hit area

- **WHEN** inline tool controls render
- **THEN** their hit area SHOULD be consistent and compact, approximately `28px x 32px`
- **AND** adjacent icon spacing SHOULD be minimal without allowing hover or click regions to overlap incoherently

#### Scenario: theme-safe icons

- **WHEN** the app theme is dark, dim, light, or system light
- **THEN** inline tool icons MUST remain visible by inheriting theme color tokens or `currentColor`
- **AND** toolbar icons MUST NOT depend on SVG assets with fixed black or white strokes

#### Scenario: no pseudo-button background

- **WHEN** inline tools render in the normal composer or home composer
- **THEN** they MUST NOT regain circular or pill button backgrounds from broader selector styles
- **AND** hover MAY change icon color but SHOULD NOT reintroduce large button chrome

#### Scenario: selected tool affordance is normalized

- **WHEN** inline tool controls such as completion email, live follow, live collapse, or memory reference are selected or armed
- **THEN** the control MUST keep the same icon-only hit area and MUST show a compact check affordance over the icon
- **AND** selected icon and check colors MUST come from one shared theme-safe selected color token
- **AND** selected state MUST NOT be expressed through inconsistent green dots, glowing badges, text replacement, or heavy button borders/backgrounds

### Requirement: Composer Geometry MUST Stay Compact

Composer visual geometry MUST remain compact enough for repeated workbench use.

#### Scenario: reduced corner radius

- **WHEN** the Composer input panel renders
- **THEN** its outer radius SHOULD be smaller than the old large-pill treatment
- **AND** home and normal composer variants MUST NOT drift into visibly different corner-radius languages

#### Scenario: reduced default height

- **WHEN** Composer renders without a user-resized persisted height
- **THEN** its default body height SHOULD be reduced by about two text rows from the old home composer default
- **AND** user-driven resize, max-height scrolling, and collapsed behavior MUST remain available

#### Scenario: migrated persisted height remains compact

- **WHEN** Composer restores an old persisted v2 input height
- **THEN** the restored height MUST be migrated about two text rows shorter
- **AND** the migrated height MUST NOT fall below the current minimum wrapper height

#### Scenario: bottom composer spacing remains close to viewport bottom

- **WHEN** the main Composer renders at the bottom of the realtime conversation view
- **THEN** its bottom spacing SHOULD stay compact enough that the input panel visually sits close to the viewport bottom
- **AND** this spacing change MUST NOT apply to the HomeChat curtain input unless that surface is explicitly targeted

#### Scenario: hover-only collapse affordance

- **WHEN** the Composer is not collapsed and the pointer is not hovering the top resize affordance
- **THEN** the top resize grip and collapse icons MUST remain visually hidden
- **AND** hovering, keyboard focusing, or resizing the top affordance MUST reveal the controls

#### Scenario: symmetric explicit collapse controls

- **WHEN** the top resize affordance is revealed
- **THEN** the Composer SHOULD present symmetric collapse icons around the resize grip
- **AND** activating either collapse icon MUST collapse the Composer to the bottom using the same collapsed state as drag-to-collapse

#### Scenario: send button compact square

- **WHEN** the send button renders
- **THEN** it SHOULD be a small rounded square
- **AND** it MUST NOT dominate the bottom toolbar height

### Requirement: Composer Primary Action Geometry MUST Stay Consistent Across Surfaces

Home Composer 与 Conversation Composer 的 primary send/stop action MUST 使用统一的 compact geometry，responsive styling MUST NOT 放大其中一个 surface。

#### Scenario: Home and conversation render the same compact action

- **WHEN** Home Composer 或 Conversation Composer 渲染 enabled、disabled 或 stop action
- **THEN** action MUST render as a `26px × 26px` rounded square with `8px` radius
- **AND** ArrowUp icon MUST render at `14px` while stop icon MUST render at `10px`
- **AND** state-specific color、icon 与 interaction behavior MUST remain unchanged

#### Scenario: Narrow home viewport preserves compact action

- **WHEN** Home Composer 在 `max-width: 640px` 的 responsive layout 中渲染
- **THEN** send/stop action MUST remain `26px × 26px`
- **AND** responsive styling MUST NOT enlarge it to `36px`

### Requirement: Browser Context Snapshot Cards MUST Remain Legible In Light Themes

Composer browser context snapshot cards and their message summary counterparts MUST preserve readable text and distinguishable observation state styling in dark, dim, light, system-light, and Windows WebView2 light surfaces.

#### Scenario: expired composer browser context remains readable on Windows light theme

- **WHEN** a Composer browser context attachment has observation state `expired`
- **AND** the app is running in Windows desktop with system-light or explicit `data-theme="light"`
- **THEN** the browser context card MUST render a solid-enough surface with readable title, kicker, count chips, detail action, refresh action, and remove action
- **AND** the card and state badge MUST expose an expired-specific presentation class rather than reusing stale-only styling
- **AND** the expired state label MUST come from i18n instead of displaying an untranslated raw enum in localized UI

#### Scenario: message summary preserves browser observation state

- **WHEN** a browser context summary card receives an attachment with observation state `expired`, `degraded`, or `unsupported`
- **THEN** the summary card MUST preserve that observation state for rendering
- **AND** the card and badge MUST use a state-specific class and color token
- **AND** it MUST NOT collapse all non-available states into the stale visual treatment

#### Scenario: browser context contrast fix does not change capture semantics

- **WHEN** browser context snapshot cards render with higher contrast styling
- **THEN** Browser Agent capture, freshness calculation, diagnostics, prompt attachment, and privacy redaction semantics MUST remain unchanged
- **AND** the change MUST stay scoped to presentation, i18n labels, and state preservation for summary rendering

### Requirement: Provider Groups MUST Use Provider-Scoped Model Catalogs

The grouped Composer model selector MUST resolve each engine group from provider-scoped catalog facts rather than treating the active engine `models` array as the catalog for every provider. When the active thread has a persisted managed provider binding, its active engine group MUST contain only that provider's configured models plus public models, with deterministic dedupe.

#### Scenario: active managed provider uses its catalog

- **WHEN** a new or restored Claude Code, Codex, or Kimi thread has managed `providerProfileId=A`
- **THEN** the active engine model group MUST use provider A's configured models
- **AND** it MUST append public models
- **AND** it MUST NOT include models owned only by provider B or the disk/global provider

#### Scenario: provider and public model duplicate

- **WHEN** the active provider catalog and public catalog contain the same runtime model identity
- **THEN** the selector MUST show one row
- **AND** the provider-owned label and metadata MUST take precedence

#### Scenario: provider-scoped Codex model preserves reasoning capabilities

- **WHEN** a provider-scoped Codex model matches an authoritative Codex catalog row by normalized runtime model identity
- **THEN** missing `supportedReasoningEfforts` and `defaultReasoningEffort` MUST be inherited from the authoritative row
- **AND** provider-owned label, origin, profile binding, and explicit reasoning metadata MUST remain authoritative
- **AND** an unmatched provider-only model MUST NOT receive inferred reasoning capabilities

#### Scenario: user selects an arbitrary provider-bound Codex model

- **WHEN** an active provider-bound Codex thread stores a non-empty user-selected model name
- **THEN** Composer MUST preserve the selected model without requiring membership in the current or global Codex catalog
- **AND** temporary catalog loading, refresh, or absence MUST NOT invalidate the selection
- **AND** selection repair MUST NOT replace it with a global/default model
- **AND** blank model names MUST continue through the existing fallback path

#### Scenario: user selects an arbitrary provider-bound Claude Code model

- **WHEN** an active provider-bound Claude Code thread stores a non-empty user-selected model name
- **THEN** Composer MUST preserve the selected model without requiring membership in the current Claude catalog
- **AND** temporary catalog loading, refresh, or absence MUST NOT invalidate the model or its reasoning effort
- **AND** selection repair MUST NOT replace it with a default model
- **AND** blank model names MUST continue through the existing fallback path

#### Scenario: switching parallel provider sessions updates catalog

- **WHEN** the same workspace contains active sessions bound to different provider profiles
- **AND** the user switches the active session
- **THEN** the selector MUST load and display the newly active session's provider-scoped catalog
- **AND** an older request MUST NOT overwrite the new session's model list

#### Scenario: non-active Claude group has Claude catalog

- **WHEN** the active Composer provider is not `Claude Code`
- **AND** Claude Code has settings/env or user custom model entries
- **THEN** the grouped selector MUST include a Claude Code group
- **AND** that group MUST use Claude Code model entries instead of the active provider's model list

#### Scenario: non-active Codex group has Codex catalog

- **WHEN** the active Composer provider is not `Codex`
- **AND** Codex has built-in, config-derived, runtime, or user custom model entries
- **THEN** the grouped selector MUST include a Codex group
- **AND** that group MUST use Codex model entries instead of the active provider's model list

#### Scenario: provider footer action targets effective provider

- **WHEN** a provider group is rendered in the selector
- **THEN** add-model and refresh-config footer actions MUST remain scoped to the effective selected provider context
- **AND** refreshing a provider group MUST NOT start, stop, or restart a conversation runtime

### Requirement: Native Model Selector MUST Be Scoped To Its Current CLI Providers

Native Session 的 Composer model selector MUST 只展示来源 Session 当前 CLI 下的
Provider Profiles 与 Provider-scoped Model catalogs；它 MUST NOT 把其他 CLI 作为 model
group 展示。该约束 MUST 覆盖 Claude、Codex、Kimi、Grok 与 OpenCode Native Session。

#### Scenario: Claude native session lists only Claude providers

- **WHEN** 用户在 Claude Native Session 打开 model selector
- **THEN** selector MUST 展示 Claude CLI 的 local 与 managed Provider Profiles
- **AND** MUST NOT 展示 Codex CLI 或 Kimi CLI group

#### Scenario: Codex native session lists only Codex providers

- **WHEN** 用户在 Codex Native Session 打开 model selector
- **THEN** selector MUST 展示 Codex CLI 的 disk 与 managed Provider Profiles
- **AND** MUST NOT 展示 Claude Code 或 Kimi CLI group

#### Scenario: Kimi native session preserves capability boundary

- **WHEN** 用户在 Kimi Native Session 打开 model selector
- **THEN** selector MUST 展示 Kimi CLI 的 Provider Profiles
- **AND** 未验证为 continuation target 的其他 Kimi Provider MUST 保持不可选并展示原因
- **AND** 当前绑定 Provider 内的 Model selection MUST 继续可用

#### Scenario: Grok native session lists only Grok providers

- **WHEN** 用户在 Grok Native Session 打开 model selector
- **THEN** selector MUST 只展示 Grok CLI 的 Provider Profiles 与 scoped Models
- **AND** MUST NOT 展示 Claude、Codex、Kimi 或 OpenCode CLI group

#### Scenario: OpenCode native session lists only OpenCode providers

- **WHEN** 用户在 OpenCode Native Session 打开 model selector
- **THEN** selector MUST 只展示 OpenCode 的 Provider Profiles 与 scoped Models
- **AND** MUST NOT 展示 Claude、Codex、Grok 或 Kimi CLI group

### Requirement: Provider Model Lists MUST Expand Mutually Exclusively

Composer Provider Profile 与 Model 列表 MUST 使用互斥折叠；同一 selector 中同一时间最多
展开一个 Provider Profile 的 Model 列表。Shared Session 的 CLI、Provider Profile 与
Model picker MUST 在同一 `DropdownMenuContent` focus surface 内完成交互。CLI 列表和当前
CLI 的 Provider/Model 列表 MAY 采用双栏布局，但 Provider accordion MUST NOT 放入 nested
`DropdownMenuSubContent`。CLI 切换、Provider 展开与折叠属于 non-terminal action，
MUST NOT dismiss root menu；Model selection 属于 terminal action，MUST 原子提交
`ExecutionTarget` 并关闭 picker。

#### Scenario: opening another provider collapses the previous provider

- **WHEN** Provider A 的 Model 列表已展开，用户展开 Provider B
- **THEN** Provider B 的 Model 列表 MUST 展开
- **AND** Provider A 的 Model 列表 MUST 同步折叠

#### Scenario: expanded provider is keyboard operable

- **WHEN** keyboard 用户聚焦 Provider Profile trigger 并激活它
- **THEN** trigger MUST 切换该 Profile 的 expanded state
- **AND** MUST 暴露与可见状态一致的 `aria-expanded`

#### Scenario: Shared picker uses one focus surface

- **WHEN** 用户打开 Shared Session model picker
- **THEN** CLI 列表与 Provider/Model panel MUST 位于同一 root menu
- **AND** Shared target path MUST NOT 创建 nested submenu content

#### Scenario: CLI activation switches the provider panel without dismissing

- **WHEN** 用户激活另一个 enabled CLI
- **THEN** picker MUST 保持打开
- **AND** Provider panel MUST 展示该 CLI 的 Provider Profiles
- **AND** `ExecutionTarget` MUST NOT 在浏览阶段改变

#### Scenario: Provider accordion remains mutually exclusive and responsive

- **WHEN** 用户连续展开、折叠或在多个 Shared Provider Profiles 之间快速切换
- **THEN** picker MUST 保持打开且响应每次操作
- **AND** 同一时刻最多一个 Provider 的 Model list 展开

#### Scenario: Model selection terminates the picker

- **WHEN** 用户在已展开的 Shared Provider Profile 下选择具体 Model
- **THEN** system MUST 提交一次对应 `ExecutionTarget`
- **AND** picker MUST 关闭

### Requirement: Native Provider Model Selection MUST Preserve Binding Semantics

Native selector MUST 根据来源 Session 的 frozen Engine + Provider Profile identity 分流
Model selection；当前 Provider 内选择 Model MUST 继续使用来源 Session，其他 Provider
选择 MUST NOT 原地改写来源 binding。

#### Scenario: model changes inside current provider

- **WHEN** 用户选择当前 Native binding Provider Profile 下的另一个 Model
- **THEN** Composer MUST 更新当前 Model selection
- **AND** MUST NOT 创建 Provider Continuation 或切换 CLI

#### Scenario: selecting another provider does not mutate source target

- **WHEN** 用户选择其他 Provider Profile 下的 Model
- **THEN** Composer MUST 请求 Provider Continuation confirmation
- **AND** 在 continuation 成功前 MUST NOT 改写来源 Session 的 Provider 或 Model

### Requirement: Composer Selection Repair MUST Converge

When provider catalog hydration repairs the active thread model or reasoning effort, the Composer MUST publish the normalized selection to both durable storage and active in-memory selection state.
Persisting a semantically equal selection MUST preserve state identity and MUST NOT trigger another
render.

#### Scenario: active provider selection is repaired

- **WHEN** catalog hydration determines that the active provider thread selection requires repair
- **THEN** cache, durable storage, active selection ref, and active selection state MUST observe the same normalized value
- **AND** the next render MUST NOT schedule the same repair again

#### Scenario: repeated equal persistence

- **WHEN** the active thread receives a persistence request equal to its current normalized selection
- **THEN** active selection state MUST retain its existing reference
- **AND** no additional render MUST be scheduled

### Requirement: Shared Local Model Selection MUST Preserve Catalog And Runtime Identity

Shared Session 双栏 model picker 的具体 Model selection MUST 原子提交一个可执行 `ExecutionTarget`，
并 MUST 分别保存 catalog entry
identity 与 runtime model identity，并且 MUST NOT 从 display label 猜测 runtime model。

#### Scenario: Codex switches to Claude local model with distinct identities

- **WHEN** 当前 Shared target 是 Codex CLI，用户选择 Claude Code 的
  `Local Settings.json` Provider 下 catalog id 为 `settings-main`、runtime model 为
  `kimi-for-coding` 的 row
- **THEN** picker MUST 关闭并提交一次 Claude local `ExecutionTarget`
- **AND** `modelCatalogEntryId` MUST 为 `settings-main`
- **AND** runtime `model` MUST 为 `kimi-for-coding`
- **AND** selection MUST NOT 创建 Turn 或 hidden binding

#### Scenario: legacy local row uses catalog id as runtime fallback

- **WHEN** local settings catalog row 的 runtime `model` 为空，但 catalog `id` 非空
- **THEN** selector MUST 使用 catalog `id` 作为 compatibility runtime model
- **AND** `modelCatalogEntryId` 与 runtime `model` MUST 同时提交为该 `id`
- **AND** 已知 `id != model` 的 row MUST 继续提交明确 runtime `model`

### Requirement: Native Provider Selection MUST Use The Same Normalized Binding Identity

Native 单栏与 Shared 双栏 MUST 复用同一 Provider binding identity 规则。
`engine + normalized providerProfileId` 是选中态 identity；`providerProfileSource` 是
metadata，不得因为 Native synthesized target 暂未携带 source 而丢失 Provider 或 Model 勾选。

#### Scenario: Native local selection omits source metadata

- **WHEN** Native Claude thread 的 target 使用 `providerProfileId = null`，且 synthesized
  target 未携带 `providerProfileSource`
- **THEN** `Local Settings.json` MUST 显示为当前 Provider
- **AND** runtime model 或 catalog entry 匹配的 row MUST 显示选中勾选

### Requirement: New Home MUST Use The Atomic CLI And Provider Target Picker

New Home Composer MUST 使用现有双栏 CLI + Provider/Model target picker 选择新会话目标。该 picker MUST 将 CLI 浏览、Provider 展开与最终 Model selection 保持在同一 focus surface；只有 Model selection SHALL 形成完整 create-session target。

#### Scenario: Home opens the double-column target picker

- **WHEN** 用户在 New Home 打开模型选择器
- **THEN** 左栏 MUST 展示当前 capability gate 允许浏览的 CLI
- **AND** 右栏 MUST 展示当前 CLI 的 Provider Profiles 与 Provider-scoped Models
- **AND** selector MUST NOT退化为仅展示当前 CLI Provider 的 Native 单栏模式

#### Scenario: Home browsing does not mutate session state

- **WHEN** 用户在 New Home 切换 CLI 或展开 Provider Profile，但尚未选择具体 Model
- **THEN** picker MUST 保持打开
- **AND** system MUST NOT 创建 thread、写入 Shared target store 或请求 Native Provider Continuation

#### Scenario: Home model selection creates one atomic draft target

- **WHEN** 用户在任一 enabled CLI/Provider 下选择具体 Model
- **THEN** system MUST 原子保存 Engine、Provider Profile、Model catalog/runtime identity 与 Reasoning selection
- **AND** picker MUST 关闭并在 Home Composer footer 展示该选择
- **AND** Home hero Engine icon MUST 与该 creation target 的 Engine 同步

#### Scenario: Unsupported discovery keeps the Provider header aligned

- **WHEN** 双栏 picker 展示不具备可信 CLI model discovery protocol 的 Claude Code
- **THEN** Provider header MUST 保留与 Codex 相同的 discovery action slot
- **AND** discovery icon MUST 置灰且不可触发 discovery
- **AND** system MUST NOT 将 config reload、HTTP 请求或静态模型列表伪装成 CLI discovery

#### Scenario: Claude local model selection settles before menu close

- **WHEN** Home 当前 target 属于 Codex，用户打开 Claude Code 的 local/disk Profile 并选择一个有效 Model
- **THEN** selector MUST 先提交包含 `engine=claude`、canonical local binding、catalog/runtime model identity 与 `providerProfileSource=disk` 的完整 target
- **AND** picker MUST 在 target owner 接收选择后关闭
- **AND** catalog refresh 或 dropdown default-close MUST NOT吞掉该次 selection

#### Scenario: Atomic catalog never projects Native current models

- **WHEN** Home 双栏展示 Claude Code local/disk 与 managed Provider Profiles
- **THEN** 每个 Profile 的 Models MUST 只来自该 `engine + providerProfileId` 的 scoped catalog
- **AND** Atomic catalog MUST NOT接收或投影 Native Session 的 `currentModels`
- **AND** Local Models MUST NOT出现在任一 managed Provider 下
- **AND** 展开 Local Profile 后用户 MUST 能选择其有效 Model

### Requirement: New Home Target MUST Initialize The Created Conversation

New Home 发送 MUST 使用当前完整 create-session target 创建新会话并发送首 Turn。创建链路 MUST NOT 依赖异步全局 Engine/Model state 更新来反推 Provider 或 Model。

#### Scenario: Home creates a conversation with the selected target

- **WHEN** 用户在 New Home 选择目标后发送首条消息
- **THEN** system MUST 使用所选 Engine 与 Provider Profile 创建新 thread
- **AND** 首 Turn MUST 使用所选 runtime Model 与 Reasoning
- **AND** 新 thread 的 Composer selection MUST 使用所选 model catalog identity 与 Reasoning

#### Scenario: Home creation target is consumed once

- **WHEN** creation orchestration 已使用 Home target 创建 thread
- **THEN** creation-only target MUST NOT 作为普通 Turn option 继续传播
- **AND** 后续 Native Session 发送 MUST 由已创建 thread 的 Engine/Provider binding 与 thread-scoped Composer selection 决定

#### Scenario: Existing selector modes remain isolated

- **WHEN** 用户打开普通 Native Session 或 Shared Session 的模型选择器
- **THEN** Native Session MUST 继续使用当前 CLI 的单栏 Provider/Model selector
- **AND** Shared Session MUST 继续使用双栏 selector 与其 durable selected target persistence
- **AND** Home create-session draft MUST NOT 改写这两种 Session 的状态
- **AND** Native 单栏 catalog owner 与 Atomic 双栏 catalog owner MUST NOT共享可变 selection/expanded state 或 `currentModels` input

### Requirement: Shared And Home Atomic Pickers MUST Enable Five CLIs

Shared Session and New Home Atomic target pickers MUST expose Claude Code、Codex CLI、
Kimi CLI、Grok CLI and OpenCode CLI as enabled creation/execution targets. Native Session
selector behavior MUST remain unchanged.

#### Scenario: Shared picker lists five enabled CLI rows

- **WHEN** a user opens the Shared Session target picker
- **THEN** Claude、Codex、Kimi、Grok and OpenCode rows MUST be enabled
- **AND** selecting any row MUST display that CLI's Provider Profiles in the right panel

#### Scenario: Home picker creates a newly supported target

- **WHEN** a user selects a Kimi、Grok or OpenCode Provider Model from New Home
- **THEN** Home MUST create one complete create-session target
- **AND** the new Native Session and first Turn MUST use that Engine、Provider and runtime Model

#### Scenario: Native session remains unchanged

- **WHEN** a user opens an existing Kimi、Grok or OpenCode Native Session selector
- **THEN** the selector MUST preserve its existing Native behavior
- **AND** this Shared integration MUST NOT add cross-CLI mutation to the Native Session
