## ADDED Requirements

### Requirement: Sidebar native hydration MUST NOT probe engine disks

workspace sidebar 的 native hydration MUST 把 Session Index 当作唯一 native 行来源。first-paint、切项目与 focus-refresh MUST NOT 在 Index 缺某引擎行时回落到 `listDshSessions` / `listPiSessions` / 其他 engine disk list。

`includeEngineDiskLists` MUST NOT 再作为侧栏日常路径的开关；Session 管理页不受本条约束。

#### Scenario: Missing DSH rows do not start a disk probe

- **WHEN** first-paint 的 Session Index 页里没有 DSH 行
- **THEN** 系统 MUST NOT 调用 `listDshSessions` 补洞
- **AND** 侧栏 MUST 继续使用已返回的 Index 行进入可交互状态

#### Scenario: Missing PI rows do not start a disk probe

- **WHEN** first-paint 的 Session Index 页里没有 PI 行
- **THEN** 系统 MUST NOT 调用 `listPiSessions` 补洞
- **AND** PI 行的补齐 MUST 等待后台 Session Index writer

### Requirement: Hide unreadiness MUST NOT strip indexed natives

当 Shared hide / visibility 投影尚未就绪或超过 busy timeout 时，系统 MUST NOT 把 native 列表降级成「只画 PI」。系统 MUST 使用上次成功的 hide set（last-good）；若没有 last-good，MUST 先全显 Index native，等投影返回后再过滤。

#### Scenario: Hide busy keeps Claude and Grok visible

- **GIVEN** Session Index 返回了 Claude 与 Grok 行
- **AND** hide store 在配置的 busy timeout 内不可用
- **WHEN** 侧栏绘制 first-paint native 列表
- **THEN** Claude 与 Grok 行 MUST 保持可见
- **AND** 系统 MUST NOT 只渲染 PI 行

#### Scenario: Last-good hide applies when available

- **GIVEN** 上次成功的 hide set 标记某条 native 为隐藏
- **AND** 当前 hide 投影暂时不可用
- **WHEN** 侧栏绘制 native 列表
- **THEN** 系统 MUST 继续隐藏那条 last-good 记录
- **AND** MUST NOT 因此丢掉 hide set 之外的其他 native 行
