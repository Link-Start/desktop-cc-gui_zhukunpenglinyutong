## ADDED Requirements

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
