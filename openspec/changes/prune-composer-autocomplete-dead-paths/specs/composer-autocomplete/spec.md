## ADDED Requirements

### Requirement: Composer-layer autocomplete state MUST be a trigger-context detector only

Composer 层的 autocomplete state hook MUST 只暴露补全 trigger 上下文检测与文本/光标变更透传；补全候选项的计算、打分与渲染 MUST 由 ChatInputBox completion providers 唯一承担。

#### Scenario: hook exposes only consumed outputs

- **WHEN** `Composer.tsx` 调用 `useComposerAutocompleteState`
- **THEN** hook MUST 仅返回 `isAutocompleteOpen`、`handleTextChange`、`handleSelectionChange`
- **AND** hook MUST NOT 发起 project memory / note card 的补全 IPC 查询
- **AND** hook MUST NOT 对 workspace 文件列表做候选打分

#### Scenario: trigger context detection covers all completion triggers

- **WHEN** 光标前文本处于 `/`、`$`、`@`、`@@`、`@#` 任一 trigger 上下文（trigger 前为行首、空白或 `"'` `(` `[` `{` 之一，且 query 不含空白）
- **THEN** `isAutocompleteOpen` MUST 为 true
- **AND** 当光标移出 trigger 上下文时 MUST 为 false

#### Scenario: visible completion behavior is unchanged

- **WHEN** 用户在输入框键入任一补全 trigger
- **THEN** ChatInputBox completion dropdown MUST 照常弹出、过滤与插入
- **AND** 补全下拉打开期间 ↑/↓ MUST NOT 触发输入历史导航

### Requirement: Removed ComposerInput implementation MUST NOT leave misleading references

已删除的 `ComposerInput` 旧实现 MUST NOT 在存活代码的注释、测试命名中以「仍存在被替换对象」的语义出现。

#### Scenario: adapter comment describes current responsibility

- **WHEN** 阅读 `ChatInputBoxAdapter.tsx` 头部注释
- **THEN** 注释 MUST 描述其当前职责（Composer props → ChatInputBox props 翻译）
- **AND** MUST NOT 提及替换某个已不存在的组件
