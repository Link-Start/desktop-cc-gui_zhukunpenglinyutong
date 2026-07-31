## ADDED Requirements

### Requirement: Native Sidebar Create Menu MUST Bind Selected Provider For Launch

系统 MUST 将 workspace 侧边栏「新建会话」菜单中的供应商选择建模为 **启用启动决策**（下一会话的 L2 launch binding），而不是可有可无的 UI 勾选。

#### Scenario: select managed provider then create session

- **WHEN** 用户在新建会话菜单右侧选中某 engine 的 managed provider P，再点击左侧对应 CLI 入口创建会话
- **THEN** 前端 MUST 调用创建路径并携带 `providerProfileId = P.id` 与完整 `providerProfile` 元数据（至少 id/name/source）
- **AND** 新建 thread 的内存/状态 MUST 记录同一 managed binding
- **AND** 该会话后续首发 `engine_send_message` MUST 携带同一 `providerProfileId`（从 thread state 读取），MUST NOT 静默改用全局 current-only 路径

#### Scenario: select local or disk sentinel profile

- **WHEN** 用户选择 Claude/Kimi/Grok/OpenCode 的 local profile 或 Codex disk profile
- **THEN** 创建路径 MUST 遵循既有 sentinel 归一化（local → 无 managed 覆盖；disk → disk binding 规则）
- **AND** 行为 MUST NOT 注入其他 managed provider 的 env

#### Scenario: menu provider select does not create session alone

- **WHEN** 用户仅点击右侧供应商项（keep menu open）
- **THEN** 系统 MUST 更新该 engine 的 last-selected profile 记忆并更新选中态
- **AND** MUST NOT 仅因选择而创建 thread

#### Scenario: unavailable remembered provider blocks create

- **WHEN** 记忆中的 managed provider 已不存在于 catalog（unavailable）
- **THEN** 主入口创建 MUST 被阻止（不可用）
- **AND** MUST NOT fallback 到另一 provider 静默创建

### Requirement: Native Menu Enable-For-Launch MUST Sync Global Active Provider

新建菜单「选供应商」MUST 同步 L1 全局 active（配置页「使用中」），并同时写入 L2 创建记忆；会话发送仍以 thread binding 为准。

#### Scenario: sidebar provider pick enables settings isActive

- **WHEN** 用户在新建会话菜单中选择 Claude managed provider P
- **THEN** 前端 MUST 调用与设置页「启用」相同的 `switchClaudeProvider(P)`（或等价 switch）
- **AND** 配置页供应商列表在刷新后 MUST 将 P 显示为「使用中」
- **AND** 前端 MUST 仍记忆 P 供左侧 create 写入 thread `providerProfileId`

#### Scenario: bound sessions keep L2 after global enable from menu

- **WHEN** 已存在绑定 managed provider A 的会话，用户在菜单选择并启用 provider B
- **THEN** 会话 A 的 thread binding MUST 保持 A
- **AND** 后续新建会话 MUST 默认使用 B

### Requirement: Provider Continuation MUST Activate Destination Provider

用户在已有会话中通过「使用其他 Provider 继续」切换到目标 provider 后，系统 MUST 完成与新建菜单一致的启动设置。

#### Scenario: continuation success enables destination and applies target model

- **WHEN** Provider 续接成功并打开目标会话（例如 DeepSeek → Minimax-m3）
- **THEN** 系统 MUST 将 L1 `claude.current`（或对应引擎 current）设为目标 provider，使配置页显示「使用中」
- **AND** MUST NOT 盖写 `~/.claude/settings.json`
- **AND** MUST 记忆目标 provider 供后续新建
- **AND** MUST 将续接目标 model/effort 应用到新会话 composer 选择，避免仍显示来源会话模型

### Requirement: Switching Active Session MUST Adapt UI To Session Creation Provider

切换/打开已有 native 会话时，UI 启动配置与模型目录 MUST 适配该会话 **创建时** 绑定的 provider；发送 MUST 仍使用该会话的 `providerProfileId`。

#### Scenario: switch between old claude sessions with different providers

- **WHEN** 用户从绑定 Minimax-m3 的 Claude 会话切到绑定 kimi-k3 的 Claude 会话
- **THEN** 系统 MUST 将 L1 current / 模型映射 / model catalog 切到 kimi-k3 对应配置
- **AND** 发送消息 MUST 仍使用 kimi-k3 的 thread.providerProfileId（创建时绑定）
- **AND** 再切回 Minimax 会话时 MUST 重新适配 Minimax 的映射与 catalog
- **AND** MUST NOT 因适配 L1 而改写任一会话已持久化的 providerProfileId

#### Scenario: composer channel chip follows session provider not stale override

- **WHEN** 用户切换到绑定 managed provider P 的 native Claude 会话
- **THEN** 模型选择器底栏渠道芯片 MUST 显示 P 的名称（如 Minimax-m3 / kimi-k3）
- **AND** MUST NOT 因上一会话的渠道预览覆盖（profileOverrides）或 catalog 首项回退而显示错误供应商名（如 DeepSeek）

> **Note**：Shared Session 渠道→模型切换见同 change 下 `shared-execution-target` delta（`selectedNextTarget` 路径，非 thread L2 binding）。

## MODIFIED Requirements

### Requirement: Parallel Sessions With Different Providers MUST Be Isolated

同一 workspace 下，绑定不同供应商的会话 MUST 并行运行且互不影响。  
（保持既有 scenario；补充 create-menu 入口不得破坏该隔离。）

#### Scenario: two Claude threads with different providers

- **WHEN** 同一 workspace 下同时存在绑定 managed provider A 的 Claude 会话与绑定 managed provider B（或本地配置）的 Claude 会话
- **THEN** 两个会话各自的 turn 进程 MUST 仅注入各自绑定对应的供应商配置
- **AND** 任一会话的发送 MUST NOT 修改全局 `~/.claude/settings.json`

#### Scenario: create-menu binding preserves isolation

- **WHEN** 用户通过新建会话菜单先后为同一 engine 创建绑定 A 与绑定 B 的两个 native 会话
- **THEN** 两会话的 thread binding MUST 分别记录 A 与 B
- **AND** 后续全局设置页 switch 到 C MUST NOT 改写 A/B 已记录的 managed binding
