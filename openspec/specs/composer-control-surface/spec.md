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

The grouped Composer model selector MUST resolve each provider group from provider-scoped catalog facts rather than treating the active engine `models` array as the catalog for every provider.

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
group 展示。

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
