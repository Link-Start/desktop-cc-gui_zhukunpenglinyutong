# git-file-preview-affordance Specification

## Purpose

Define explicit Git changed-file preview affordances so users can open inline or modal diff previews without relying only on ambiguous row click or double-click gestures.
## Requirements
### Requirement: Main git panel file rows MUST expose explicit preview actions

右侧主 Git 面板的 changed file row MUST 在行尾 action 区显式暴露 preview actions，而不是只依赖 row 单击 / 双击手势。

#### Scenario: preview actions are visible in both flat and tree list views

- **WHEN** 用户在右侧主 Git 面板查看 changed file list
- **THEN** 每个 file row MUST 在行尾 action 区显示两个 preview action buttons
- **AND** 该 requirement MUST 同时适用于 `flat` 与 `tree` 两种列表模式

#### Scenario: preview actions appear before mutation actions

- **WHEN** file row 同时显示 preview actions 与 `stage / unstage / discard` actions
- **THEN** preview action buttons MUST 出现在 `+ / - / 回退` 之前
- **AND** MUST NOT 移除或替代原有 mutation actions

### Requirement: Explicit preview actions MUST preserve existing preview semantics

显式 preview action buttons MUST 复用现有 preview 行为，而不是引入新的 preview 模式或破坏旧手势语义。

#### Scenario: inline preview action matches single-click behavior

- **WHEN** 用户点击 file row 的 inline preview button
- **THEN** 系统 MUST 执行与“单击 file row”一致的中间区域 diff 预览行为

#### Scenario: modal preview action matches double-click behavior

- **WHEN** 用户点击 file row 的 modal preview button
- **THEN** 系统 MUST 执行与“双击 file row”一致的 modal diff 预览行为

#### Scenario: row click and double-click remain available

- **WHEN** 新的 preview action buttons 已显示
- **THEN** 现有 row 单击与双击手势 MUST 继续可用
- **AND** preview action button click MUST NOT 冒泡成额外的 row click / double-click 重复触发

### Requirement: Git Modal Preview MUST Accept External Path Requests

Git diff surface MUST 接受带唯一 request identity 的外部 path request，并基于当前 staged/unstaged file model 打开既有 modal diff preview。

#### Scenario: current unstaged file opens existing modal

- **WHEN** 外部 request path 匹配当前 unstaged file
- **THEN** Git panel MUST 打开现有 `.git-history-diff-modal`
- **AND** request 指定 `maximized=true` 时 modal MUST 初始包含 maximized state
- **AND** modal MUST 使用已有 diff entry 与 editable review lifecycle

#### Scenario: native Git row preview keeps default size

- **WHEN** 用户从右侧 Git 文件行自身的 modal preview affordance 打开文件
- **THEN** modal MUST 保持既有普通尺寸默认值
- **AND** summary external request 的 maximized preference MUST NOT 污染该入口

#### Scenario: current staged file opens existing modal

- **WHEN** 外部 request path 匹配当前 staged file
- **THEN** Git panel MUST 以 staged section context 打开现有 modal

#### Scenario: same path can be requested repeatedly

- **WHEN** 相同 path 以新的 request identity 再次到达
- **THEN** Git panel MUST 将其作为新的 activation 处理

#### Scenario: path is absent from current working tree

- **WHEN** request path 不匹配任何当前 staged/unstaged file
- **THEN** Git panel MUST 保持稳定 no-op
- **AND** MUST NOT 打开空 modal、切换 center Surface 或抛出错误

#### Scenario: Git file list arrives after request

- **WHEN** external request 先于 matching staged/unstaged file model 到达
- **THEN** Git panel MUST NOT 提前把该 request 标记为已消费
- **AND** matching file 随后出现时 MUST 打开请求的最大化 modal

#### Scenario: conversation path is workspace absolute

- **WHEN** summary request path 为 active workspace 下的 absolute path
- **THEN** AppShell MUST 使用当前 Git available paths 将其解析为 repo-relative path
- **AND** Git panel MUST 使用解析后的 canonical path 定位 modal file
