## Decisions

### Legacy façade and canonical core

`MessagesProps` 继续兼容现有 flat callers。`adaptLegacyMessagesProps` 纯函数负责构造 fallback
`ConversationState`、scope match、canonical precedence 与 grouped props；`MessagesCore` 不读取 legacy alias。

### Scope safety

只有 canonical `meta.workspaceId/threadId` 与 caller scope 匹配时才采用 canonical state。任一显式 scope
不匹配时使用 legacy fallback，避免 tab switch/deferred state 把旧 conversation items、plan 或 input queue
注入当前 canvas。空字符串仅作为缺失 metadata，不覆盖 caller 的 non-empty scope。

### Responsibility groups

`conversation` 持有 canonical state 与 workspace path；`runtime` 持有 loading/processing/approval/task state；
`interactions` 持有 callbacks；`presentation` 持有 UI policy、open targets、profile 与 lightweight controls。
所有字段复用 `MessagesProps` 的 concrete types，不引入 `unknown`。

### Mechanical core extraction

先建立 adapter tests，再把现有 component body 机械移动到 `MessagesCore.tsx`。除输入解构外不重排 hooks、
effects 或 streaming data flow，降低 2700+ 行热路径的行为风险。

## Risks / Mitigations

- grouped mapping 漏字段：用 exhaustive concrete groups、typecheck 与 full messages suite 验证。
- scope precedence drift：adapter unit tests + existing conversation-state integration tests 双层锁定。
- large-file rename 被判 new file：保持 git rename detection，并记录 hard gate baseline。
