## Context

现有 `SearchPalette` 已处理 leaf-local input、150ms root query commit、IME、keyboard selection、scope/filter 和 grouped rendering；`useUnifiedSearch` 负责 provider limits、ranking、stale token 与 perf evidence。空 query 在 `useAppShellSearchRadarSection` 和 `SearchPalette` 被主动截断。文件 provider 仅使用 `indexOf`。

App action 的真实副作用已经分散存在于 `useAppShellQuickSwitcherSection`、layout/settings/session handlers 和 shortcut metadata 中。Quick Switcher 已维护 recent sessions/files；search recency store 已记录打开过的 result。CodeMirror 依赖中已存在 `selectParentSyntax`，但 default keymap 使用 `Mod-i`，没有 mossx 的 shared shortcut metadata。

约束：不得恢复 AppShell per-keystroke render，不引入新的 runtime package，不复制 action 业务逻辑；跨平台 shortcut 必须经过 shared parser/formatter，并保护普通 editable target。现有 transitive package `@codemirror/commands` 需要声明为 direct dependency，避免依赖上游 package 的内部依赖树。

## Goals / Non-Goals

**Goals:**

- 让同一个 global search 同时发现并执行 app action。
- 提供可测试、确定性的 fuzzy score 和跨类型优先级。
- 空 query 复用现有 recent file/session 来源，并增加有界 recent action store。
- 通过 CodeMirror editor extension 实现可配置的 expand selection。

**Non-Goals:**

- 不创建通用 command bus 或重写全部 AppShell action wiring。
- 不让 Quick Switcher 变成 search；它继续保留非搜索 recent activity 定位。
- 不让空 query 启动 message/history provider 或 workspace hydration。
- 不处理 semantic code navigation。

## Decisions

### 1. 使用 declarative action descriptor + existing callbacks

新增轻量 `SearchActionDescriptor`：稳定 `id`、i18n title/keywords、可选 shortcut label 和 `execute`。descriptor 在持有真实 handler 的 AppShell composition boundary 中构造；provider 只将 metadata 投影为 `SearchResult(kind: "action", actionId)`，选中时按 `actionId` 调用同一个 descriptor callback。

不建立新的全局 command bus。当前 action 数量有限，引入 command bus 会扩大迁移面并制造第二套业务入口。descriptor 只做 discovery/dispatch adapter，具体副作用仍由 settings、layout、quick switcher、session 和 zoom 的现有 handler 所有。

首批 action 覆盖设置、终端、Git、新建会话、最近活动、放大/缩小/重置界面；可在相同 registry 中安全补充已有稳定 action，但不为“未来可能”预建层级、权限或插件 API。

### 2. 提取纯函数 fuzzy matcher，不增加 dependency

从 Composer autocomplete 的 subsequence 思路提取/复用小型纯函数。score 顺序为：exact < prefix < contiguous substring < compact subsequence；额外惩罚首个命中位置、字符间 gap 和过长候选。query/title/keywords 统一 lowercase，原始 title 不变。

所有文本型 provider 分批迁移风险过大。本变更至少覆盖 action 与 file；统一 comparator 保证未迁移 provider 仍可共存。`fvp` 对 file path/basename 可命中 `FileViewPanel`。

### 3. 排序使用 kind priority 作为第一关键字

`compareSearchResults` 先比较固定 kind priority，再比较 provider score、recent bonus、updatedAt 和 title。优先级为 action → file → thread/session/navigation content → API/kanban/skill/command → message/history。这样 message 高相关度也不会淹没直接导航结果。

section rendering 使用同一 kind order，heading 继续不进入 selectable index。

### 4. 空 query 使用独立 recent projection

空 query 不调用全文 provider。由一个纯 projection 合并：

- Quick Switcher recent files（现有 bounded client store）；
- `quickSwitcherSessionGroups` 中按 `updatedAt` 排序的 sessions；
- 新增 recent action store，只保存最多 20 个 `{ actionId, executedAt }`。

结果在 palette 打开时读取，action 执行时异步/非阻塞写入。禁止保存 query text、message、file content。损坏或未知 action id 被忽略。当前 workspace scope 过滤 recent file/session；global scope 可跨 workspace。

### 5. 保持搜索热路径 local-first

`SearchPalette.inputValue` 和现有 debounce 保持不变。action fuzzy compute 是小型同步纯函数；recent projection 只在 palette open、scope 或来源变化时计算。不得在 input `onChange` 中写 storage，也不得增加 root-level query mirror。

### 6. Expand Selection 作为 editor-scoped CodeMirror keymap

在 `FileCodeMirrorEditorImpl` 的显式 keymap 中调用已安装 CodeMirror command `selectParentSyntax`。shortcut 值来自 shared `AppSettings`，经 shared parser 转换为 CodeMirror 可识别平台组合；默认值采用 `ctrl+w`，限定 editor scope，不注册 window-level handler，因此不会关闭 session 或删除普通 input 文本。

macOS 上 `Cmd+W` 已用于关闭会话，默认仍为 `Ctrl+W`；Windows/Linux 的 `Ctrl+W` 只在 CodeMirror focus 内拦截。用户清空 setting 后不注册该 binding。Settings metadata、frontend default、Rust nullable persistence 同步更新。

替代方案是直接覆盖 CodeMirror `Mod-i`：改动更小，但不可发现、不可配置，且不能满足用户指定 `Ctrl+W`。

## Data Flow

1. Palette 打开：读取 recent action ids，复用 recent file/session snapshot，生成 empty-query results。
2. 用户输入：leaf-local input 更新；debounce 后把 query 交给 unified compute。
3. Unified compute：action/file fuzzy providers 与原 providers 产出 typed results；shared comparator 排序并截断。
4. 用户 Enter：`handleSelectSearchResult` 对 action 查表执行 existing callback，记录 action recency，然后关闭 palette；其他 kind 保持原路径。
5. Editor 创建/shortcut setting 变化：重建小型 keymap extension；`Ctrl+W` 仅在 editor 中调用 `selectParentSyntax`。

## Error Handling

- storage 不可用、payload 损坏或版本不兼容：返回空 recent actions，不阻断 palette。
- action registry 缺少 result 对应 id：安全 no-op 并关闭/保持 palette 的行为由 focused test 固定，不抛 render exception。
- action callback 自身错误沿用原 handler 的错误处理；adapter 不吞异常、不产生第二份 toast。
- invalid/cleared shortcut：不安装 key binding。

## Risks / Trade-offs

- [Risk] AppShell callback boundary 继续扩大 → 只传入本批 action 所需的现有 handler；不创建全能 service locator。
- [Risk] kind priority 可能压低非常精确的 message result → 这是用户明确要求；同 kind 内仍按相关度排序，并保留 content filter。
- [Risk] subsequence 对大文件索引增加 CPU → 使用已有 provider limit/source index，matcher 为 O(query × candidate length)，并保留现有 debounce 与 evidence test。
- [Risk] `Ctrl+W` 与平台/编辑器默认行为冲突 → editor scope、shared configurable setting、macOS `Cmd+W` 保持关闭会话，focused collision tests。
- [Risk] recent data来源不同步 → 文件继续以 Quick Switcher store 为 single source；session 继续由现有 projection 提供；只新增 action store。

## Migration Plan

1. 添加 types、fuzzy matcher、action/recent providers 和 focused unit tests。
2. 扩展 SearchPalette kind/filter/presentation，并保持空 query selectable。
3. 在 AppShell composition 中接入 existing action callbacks 和 recent projections。
4. 添加 expand-selection setting 与 CodeMirror binding，并验证 frontend/Rust round-trip 的受影响测试。
5. 只运行 touched Vitest suites、相关 TypeScript check 和必要的单个 Rust settings test。

回滚时可分别移除 action/recent projection 和 editor binding；原 unified search、Quick Switcher、已有 shortcuts 与 CodeMirror default behavior 均保持可用，无数据迁移要求。未知 recent action store 可留存并被旧版本忽略。

## Open Questions

- 首批 action 的最终中文/英文关键词以现有 i18n 术语为准；实现时优先复用已有 translation keys，缺少时只增加 action-specific keys。
- 如果 Rust settings 使用 `serde(default)` 的集中默认结构，expand-selection 字段遵循现有 nullable shortcut 模式，不另建迁移版本。
