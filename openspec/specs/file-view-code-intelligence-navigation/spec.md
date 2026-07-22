# file-view-code-intelligence-navigation Specification

ADDED by change: file-view-code-intelligence-navigation-2026-03-01

## Purpose

在现有文件树与多 Tab 文件编辑能力基础上，提供面向代码符号的语义导航（跳转定义、查找引用）与跨文件定位能力，使打开文件具备 IDE
级核心导航体验。

## Requirements

### Requirement: Editor Symbol Definition Navigation

系统 MUST 支持在文件编辑视图中对代码符号执行“跳转定义”。

#### Scenario: ctrl/cmd click navigates to single definition

- **GIVEN** 用户在支持语言文件中打开编辑模式
- **AND** 光标所在符号存在唯一定义位置
- **WHEN** 用户按住 `Ctrl/Cmd` 并点击该符号
- **THEN** 系统 MUST 打开或激活目标文件
- **AND** MUST 将编辑器定位到定义所在行列

#### Scenario: multiple definitions require explicit target selection

- **GIVEN** 当前符号存在多个可跳转定义目标
- **WHEN** 用户触发跳转定义
- **THEN** 系统 MUST 展示目标候选列表
- **AND** 用户选择后 MUST 跳转到对应目标

### Requirement: Symbol References Discovery

系统 MUST 支持从当前符号查询引用列表，并支持从引用列表继续导航。

#### Scenario: find references returns navigable results

- **GIVEN** 用户在支持语言文件中定位到符号
- **WHEN** 用户触发 “Find References / Find Usages”
- **THEN** 系统 MUST 展示引用结果列表（至少包含文件路径与位置）
- **AND** 点击任一结果项 MUST 打开并定位到对应位置

#### Scenario: no references shows explicit empty state

- **GIVEN** 当前符号不存在引用
- **WHEN** 用户触发引用查询
- **THEN** 系统 MUST 显示空结果提示
- **AND** MUST NOT 抛出未处理异常

### Requirement: Open File With Location

系统 MUST 支持“按位置打开文件”，并与现有多 Tab 行为兼容。

#### Scenario: open unopened file at location

- **GIVEN** 目标文件尚未出现在已打开 Tab
- **WHEN** 系统收到 `path + location` 打开请求
- **THEN** 系统 MUST 新增目标文件 Tab
- **AND** MUST 在文件打开后定位到目标行列

#### Scenario: activate existing tab and relocate cursor

- **GIVEN** 目标文件已在已打开 Tab 中
- **WHEN** 系统收到 `path + location` 打开请求
- **THEN** 系统 MUST 激活现有目标 Tab
- **AND** MUST 更新光标与视口到目标位置

### Requirement: LSP Failure and Unsupported Fallback

系统 MUST 对 provider 不可用、indexing、查询失败、当前 cursor 非 symbol、结果为空等场景提供 action-specific、localized、可解释状态，并 MUST NOT 将仍健康的 indexing provider 伪装成 fatal failure。

#### Scenario: backend lsp command unavailable

- **GIVEN** 当前环境不支持 definition/references/implementation 查询
- **WHEN** 用户触发对应 action
- **THEN** 系统 MUST 使用当前 UI language 显示“当前环境不支持”的 action-specific 提示
- **AND** MUST 保持编辑器可继续正常使用

#### Scenario: cursor is not on a navigable symbol

- **GIVEN** 光标位于 whitespace、comment、string、punctuation 或其他非 symbol 位置
- **WHEN** 用户触发 definition、references 或 implementation action
- **THEN** 系统 MUST 按 action 提示应将光标放在 class、method、variable、type 或 interface 等适用 symbol 上
- **AND** MUST NOT 直接展示 backend raw English error

#### Scenario: query failure is surfaced without breaking editor

- **GIVEN** provider 查询因 file access、fatal runtime failure 或 invalid response 执行失败
- **WHEN** 前端收到错误或 fallback response
- **THEN** 系统 MUST 显示可区分的 localized failure/fallback 提示并允许用户重试
- **AND** MUST NOT 导致编辑器崩溃或内容丢失

#### Scenario: provider is still indexing at request deadline

- **GIVEN** Java、TypeScript/JavaScript 或 Rust provider process 仍存活
- **WHEN** semantic navigation request 达到 15 秒 soft deadline
- **THEN** UI MUST 显示 provider 仍在 indexing 或 temporarily degraded
- **AND** backend MUST NOT 自动执行 workspace-wide heuristic fallback
- **AND** 用户 MUST 能在稍后显式 retry

### Requirement: Modifier Hover MUST Reveal Navigable Symbol Affordance

File editor SHALL 在用户按住 platform-primary modifier 时，为鼠标下可导航 identifier 提供 link-like visual affordance，且 MUST NOT 因 hover 触发 backend navigation request。

#### Scenario: Modifier hover enters an identifier

- **WHEN** 用户在 macOS 按住 `Cmd` 或在 Windows/Linux 按住 `Ctrl`
- **AND** pointer 位于 syntax tree 识别的 identifier/symbol token 上
- **THEN** token MUST 显示 underline
- **AND** pointer MUST 显示 clickable cursor

#### Scenario: Modifier hover enters a non-symbol region

- **WHEN** pointer 位于 whitespace、comment、string 或 punctuation
- **THEN** editor MUST NOT 显示 link-like affordance

#### Scenario: Modifier hover state ends

- **WHEN** modifier keyup、pointer leaves editor、window blur 或 document visibility 结束当前 interaction
- **THEN** active symbol decoration MUST be cleared immediately

#### Scenario: Hover does not query provider

- **WHEN** pointer 在按住 modifier 时跨 symbol 移动
- **THEN** editor MUST resolve affordance from local editor state
- **AND** MUST NOT call definition/reference/implementation backend solely because of hover

### Requirement: Non-Regression for Existing File Workflows

新增代码导航能力 MUST 不破坏现有文件系统与编辑器基础行为。

#### Scenario: existing file open/switch/close/save behavior remains stable

- **WHEN** 用户执行现有文件操作（打开、切换、关闭、保存）
- **THEN** 行为 MUST 与变更前保持一致
- **AND** 不得因新增导航能力引入回归

#### Scenario: java baseline passes end-to-end acceptance

- **GIVEN** 用户打开 Java 工程中的类名或方法调用
- **WHEN** 触发跳转定义与查找引用
- **THEN** 结果 MUST 可用且可导航
- **AND** 验收记录 MUST 覆盖至少一个跨文件跳转与一个引用列表场景

### Requirement: Browser page-to-code candidates reuse code intelligence navigation
File view code intelligence navigation SHALL provide or expose navigation support for Browser Agent page-to-code candidates so Browser Agent does not duplicate source navigation behavior.

#### Scenario: Browser candidate points to a file
- **WHEN** Browser Snapshot v2 includes a candidate file path
- **THEN** the user SHALL be able to open or inspect that candidate through existing file/code navigation surfaces

#### Scenario: Candidate includes matched source text
- **WHEN** a browser code candidate includes matched text or symbol metadata
- **THEN** code navigation SHALL preserve that reason so the user can understand why the file was suggested

### Requirement: Browser candidates remain explainable
File view code intelligence navigation SHALL treat browser-derived code candidates as explainable suggestions, not guaranteed source ownership.

#### Scenario: Candidate confidence is low
- **WHEN** a browser code candidate has low confidence
- **THEN** the UI or AI context SHALL preserve the low confidence state and SHALL NOT present it as a confirmed file mapping

### Requirement: Editor MUST Support Go To Implementation

系统 SHALL 在 file editor 提供“Go to Implementations” action，并 MUST 复用既有 open-at-location 与 candidate selection surface。

#### Scenario: A symbol has one implementation
- **WHEN** 用户在 interface、trait、class 或 method symbol 上触发 go-to-implementation
- **AND** backend 返回唯一 target
- **THEN** editor MUST 直接打开或激活目标文件并定位到目标位置

#### Scenario: A symbol has multiple implementations
- **WHEN** backend 返回多个 implementation targets
- **THEN** editor MUST 展示具名 candidate list
- **AND** 用户选择后 MUST 跳转到对应 target

#### Scenario: No implementation exists
- **WHEN** backend 返回空 implementation result
- **THEN** editor MUST 显示明确 empty feedback
- **AND** MUST NOT 清空或修改当前文件内容

### Requirement: Rust Files MUST Participate In Code Intelligence Navigation

Rust source files SHALL 支持 definition、references 与 implementation navigation，semantic provider 可用时 MUST 使用其 scope/type-aware result。

#### Scenario: Navigate a Rust definition
- **WHEN** 用户在 `.rs` file 的 symbol 上触发 definition
- **THEN** 系统 MUST 返回可导航 Rust definition 或明确 empty feedback

#### Scenario: Navigate Rust trait implementations
- **WHEN** 用户在 Rust trait 或 trait method 上触发 go-to-implementation
- **THEN** 系统 MUST 返回 `impl Trait for Type` 等 semantic targets
- **AND** unrelated same-name functions MUST NOT 作为 semantic result 混入

### Requirement: Existing Languages MUST Keep A Safe Implementation Fallback

Java、TS/JS 与 Rust SHALL 在 semantic implementation provider 不可用时识别明确 implementation declarations，并 MUST 保持 multi-target behavior。

#### Scenario: Java or TypeScript interface has implementations
- **WHEN** 用户对 interface/class name 触发 go-to-implementation
- **THEN** fallback MAY 返回明确 `implements` 或 `extends` declaration
- **AND** candidates MUST 保持 workspace-contained、deduplicated 与 deterministic

#### Scenario: Unsupported language triggers implementation query
- **WHEN** 当前 file language 不支持 semantic 或 fallback implementation lookup
- **THEN** backend MUST 返回可解释 unsupported error
- **AND** frontend MUST NOT crash

### Requirement: File Editor MUST Expose Navigation Resolution Mode

File editor SHALL 对最近一次 navigation query 显示 localized resolution mode，并 MUST 区分 semantic certainty 与 fast-search fallback。

#### Scenario: Semantic result is returned
- **WHEN** definition、references 或 implementation query 使用 semantic provider 完成
- **THEN** UI MUST 显示“语义导航”及对应 language/provider identity
- **AND** single-target result MUST 继续直接跳转，不增加确认弹窗

#### Scenario: Fast-search fallback is returned
- **WHEN** semantic infrastructure 不可用且 bounded heuristic fallback 完成
- **THEN** UI MUST 显示“快速搜索（降级）”warning feedback
- **AND** MUST 说明结果可能包含同名项而不是显示 generic failure

#### Scenario: Cached result is reused
- **WHEN** navigation result 从 frontend cache 命中
- **THEN** UI MUST 保留原始 mode/provider/fallback metadata
- **AND** MUST NOT 把 cached fallback 误标为 semantic result

### Requirement: Navigation Retrieval Feedback MUST Be Action-Specific And Retryable

File editor SHALL 对 query preparation、empty、timeout、provider failure 与 retry 提供 compact、localized、action-specific feedback。

#### Scenario: Provider is preparing
- **WHEN** 用户首次触发可能 cold-start 的 Java 或 TypeScript semantic query
- **THEN** UI MUST 显示当前 action 与 language-specific loading copy
- **AND** editor content、selection 与 typing MUST 保持可操作

#### Scenario: Query fails or times out
- **WHEN** navigation query 在 fallback 前后仍失败或 frontend timeout
- **THEN** UI MUST 显示 localized reason category 与 retry action
- **AND** retry MUST 重用当前 cursor/action contract，禁止修改文件内容

#### Scenario: Candidate or reference results are shown
- **WHEN** query 返回 multiple candidates 或 reference list
- **THEN** panel header MUST 显示 action、result count 与 resolution mode
- **AND** existing keyboard/click navigation behavior MUST remain available

### Requirement: Missing Semantic Providers MUST Offer Platform-Specific Installation Hints

File editor SHALL 在 semantic provider executable unavailable 时，以 installation guidance 直接替换 generic fallback notice，按 current language 与 desktop operating system 展示可复制的 installation command 或 official download guide command，并 MUST 提供安装后的 explicit retry，同时保持 fallback result 可用。

#### Scenario: macOS Java provider is missing
- **WHEN** Java navigation 以 `provider-unavailable` 降级且客户端运行在 macOS
- **THEN** warning surface MUST 直接显示未检测到 Java language server
- **AND** MUST 明确显示 Homebrew `jdtls` install command
- **AND** MUST NOT 同时显示 generic “语言服务当前不可用，已改用快速搜索” notice
- **AND** user MUST 能复制 command
- **AND** MUST 能在安装完成后重新检测当前 navigation action

#### Scenario: Missing provider fallback has a single target
- **WHEN** definition 或 implementation 以 `provider-unavailable` 降级且 heuristic fallback 只返回一个 target
- **THEN** warning surface MUST 保持 installation guidance 可见
- **AND** fallback target MUST 继续作为可点击结果提供
- **AND** UI MUST NOT 在 warning 首次 render 前自动跳转并销毁该提示

#### Scenario: Windows or Linux Java provider is missing
- **WHEN** Java navigation 以 `provider-unavailable` 降级且客户端运行在 Windows 或 Linux
- **THEN** warning surface MUST 直接显示未检测到 Java language server
- **AND** MUST 使用当前 shell syntax 显示打开 Eclipse official download page 的 command
- **AND** MUST NOT 声称某个非通用 package manager 已完成安装
- **AND** MUST 提供安装后重新检测入口

#### Scenario: TypeScript JavaScript or Rust provider is missing
- **WHEN** TS/JS 或 Rust navigation 以 `provider-unavailable` 降级
- **THEN** warning surface MUST 直接显示未检测到对应 language server
- **AND** MUST 显示对应 npm 或 rustup command
- **AND** MUST 标识 current operating system
- **AND** MUST 提供安装后重新检测入口

#### Scenario: Provider failure is not an installation problem
- **WHEN** fallback reason 是 timeout、provider exit、invalid response 或 generic failure
- **THEN** UI MUST NOT 显示 installation command
- **AND** existing retry/error feedback MUST remain available

#### Scenario: Clipboard API is unavailable
- **WHEN** install hint 已显示但 clipboard API 不可用
- **THEN** command MUST remain selectable and readable
- **AND** navigation panel MUST NOT throw、hide retry 或 hide fallback results
