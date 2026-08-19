## MODIFIED Requirements

### Requirement: Shared sidebar hides owned subagent pups

工作区**侧栏会话列表** MUST 隐藏 Shared-owned 子代理会话（下崽）。判定依据为 parent-id 匹配：parent 为 `shared:*`，或 parent 命中 Shared hidden native owner 的 **identity 变体**。

Identity 变体 MUST 覆盖：

- raw session id 与已知 engine 前缀（`claude:` / `codex:` / `kimi:` / `grok:` / `opencode:` / `pi:`）
- Codex canonical UUID 与可见 rollout filename alias（`rollout-YYYY-MM-DDTHH-MM-SS-{uuid}`）

系统 MUST NOT 把任意 `:` 当成 engine 前缀。Windows 盘符路径（`S:\…`、`S:/…`）、extended path（`\\?\C:\…`）、UNC，以及 macOS / Linux POSIX 绝对路径（`/Users/…`、`/home/…`）MUST 视为路径形 id：不得剥前缀、不得补 `engine:` hide 键。

系统 MUST NOT 仅靠改挂嵌套来冒充清洁——侧栏 MUST NOT 展示这些崽子为顶层根，也 MUST NOT 在展开 Shared 时展示为可见子行。隐藏动作 MUST 限于侧栏树投影。系统 MUST NOT 因此从 threads store 删除子会话摘要。系统 MUST NOT 放宽无 parent 时按标题推断的禁令。

#### Scenario: shared codex pups hidden from sidebar by parent id

- **WHEN** Shared Codex 的 hidden native owner 为 `codex:{uuid}`（或 raw uuid）
- **AND** 子会话 parent 为对端形态或已对齐为 `shared:…`
- **THEN** 侧栏 MUST NOT 展示该子会话（含顶层与 Shared 展开子行）
- **AND** threads store MAY 仍保留该子会话摘要

#### Scenario: windows live rollout alias matches canonical hide identity

- **WHEN** Shared binding / hide set 持有 canonical `{uuid}` 或 `codex:{uuid}`
- **AND** Windows live list 或 child `parentThreadId` 为 `rollout-YYYY-MM-DDTHH-MM-SS-{uuid}`
- **THEN** 侧栏 MUST 隐藏该子会话
- **AND** 该 rollout stem 作为 ordinary native owner 行出现时 MUST 被 Shared hide strip 掉
- **AND** 系统 MUST NOT 发明未观测到的 rollout 时间戳

#### Scenario: macos and linux rollout alias uses the same identity rule

- **WHEN** macOS 或 Linux 上出现同一对 `{uuid}` 与 `rollout-*-{uuid}`
- **THEN** hide / pup 判定 MUST 与 Windows 使用同一 identity 规则并得到同一隐藏结果
- **AND** 实现 MUST NOT 依赖 `process.platform` 才能认 alias

#### Scenario: windows drive and unc paths are not engine prefixes

- **WHEN** 候选 id 为 `S:\AIWorker\proj`、`S:/AIWorker/proj`、`\\?\C:\AIWorker\proj` 或 UNC
- **THEN** hide expand / lookup / pup 判定 MUST NOT 将其剥成 `\AIWorker\proj` 或 `C:\AIWorker\proj`
- **AND** MUST NOT 仅为该路径补 `codex:` / `claude:` 等 hide 键

#### Scenario: posix absolute paths are not engine-prefixed hide keys

- **WHEN** 候选 id 为 macOS `/Users/…` 或 Linux `/home/…` 绝对路径
- **THEN** hide expand MUST NOT 写入 `codex:/Users/…` 或 `codex:/home/…` 这类键
- **AND** MUST NOT 把该路径当成 Codex uuid / rollout alias

#### Scenario: native subagent tree stays visible

- **WHEN** 子会话 parent 指向普通可见 native 父会话（非 Shared owner）
- **THEN** 侧栏 MUST 继续在该 native 父下展示子会话
- **AND** 该行为在 Windows / macOS / Linux 的 id 形态下 MUST 一致

#### Scenario: canvas subagent rules unchanged by sidebar hide

- **WHEN** 侧栏隐藏 Shared 下崽
- **THEN** 幕布内既有 subAgent tool / persona 展示规则 MUST NOT 因本隐藏而改写

#### Scenario: missing parent metadata is not inferred

- **WHEN** 子会话没有 authoritative parent 元数据
- **THEN** 系统 MUST NOT 仅凭标题、昵称推断为 Shared 下崽并隐藏
