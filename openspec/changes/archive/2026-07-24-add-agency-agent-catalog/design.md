## Context

mossx 已有两条可复用链路：

1. `src-tauri/src/agents.rs` + `~/.ccgui/agent.json` 提供 user-owned Agent CRUD、导入导出；
2. Composer `#` completion、`useSelectedAgentSession` 与 `useThreadMessaging` 提供会话级 Agent Chip 和 Prompt injection。

当前缺口不是 Agent Runtime，而是 bundled Agent Catalog、可发现性控制和本地化展示。`agency-agents` 仓库是 Markdown Prompt collection，不是可执行 runtime；其 `install.sh` / `convert.sh` 只面向外部 CLI home，不能直接表达 mossx 的 Provider-scoped runtime 与用户资产边界。

本变更跨越 Tauri resources、Rust catalog loader、AppSettings、frontend Settings、Composer provider 和 send path。约束包括：

- 默认关闭，enable 只允许进入 `#`，不得等价于运行时注入；
- Settings 可浏览完整 metadata，但不能批量把 3.36MB Prompt body 送入 renderer；
- Composer 高频链不得增加轮询或 AppShell root 高频 state；
- 中文 locale 必须能通过名称、描述和分组理解用途，原始 Prompt body 保持上游英文；
- 自定义 Agent 数据与既有会话选择必须向后兼容。

## Goals / Non-Goals

**Goals:**

- 建立最小、可扩展的 bundled Agent Catalog contract，并内置固定 revision 的 Agency Agents provider。
- 以独立 Enable Registry 控制内置 Agent discoverability。
- 复用现有 `#` 与 Agent Chip 交互，新增 send-time fail-closed validation。
- metadata/body 分离加载，中文 metadata 完整覆盖，非中文稳定 fallback。
- 提供 deterministic generator、hash、license 和完整性检查，保证 release reproducibility。

**Non-Goals:**

- 不实现自动 Agent Router、多 Agent composition、Playbook execution 或 Provider-native subagent。
- 不翻译 Prompt body，不根据上游 `tools` 字段提升权限。
- 不运行时访问 GitHub，不提供 Catalog 在线更新。
- 不改变 Curated Skill 的 always-on 语义，也不复用其 enabled ids。

## Decisions

### 1. Catalog 采用 provider package，而不是导入 `agent.json`

资源布局：

```text
src-tauri/resources/agent-catalogs/
  agency-agents/
    manifest.json
    agents.json
    prompts/
      <stable-id>.md
    LICENSE
```

`manifest.json` 描述 provider、revision、license、division order 与总数；`agents.json` 只保存列表所需 metadata、localized display fields、prompt relative path 与 SHA-256；`prompts/` 保存原始执行 body。Stable ID 使用 `agency-agents:<division>/<source-stem>`。

选择该结构而不是单个超大 JSON，是为了让 Settings/`#` 只读取 metadata，Prompt body 仅在选中或 send-time resolution 时读取。相比直接 vendor 整个上游仓库，该 package 去除 examples/scripts/playbooks 等 runtime 无关内容，并能通过 manifest/hash 形成可验证 release asset。

### 2. 使用 deterministic sync script 生成 package

新增 repo-owned sync script，从明确的 Agency Agents checkout 读取：

- `divisions.json`
- 17 个 division 下的 248 个 Agent Markdown
- `scripts/i18n/agent-names-zh.json`
- `LICENSE`

脚本使用真实 YAML parser 读取 frontmatter，补入 repo-owned `zh-CN` overrides，按 source relative path 排序，生成 metadata/body package 与 SHA-256。生成器必须拒绝：

- 缺失或重复 ID/name；
- 未知 division；
- 不安全 relative path；
- 中文名称或描述缺失；
- 计数不是 17/248；
- Prompt body 为空。

运行时不依赖源 checkout；source checkout 只用于维护者显式刷新 bundled snapshot。

### 3. Backend 提供 Catalog boundary，frontend 不直接 import 大资源

新增 `agent_catalog` Rust module 和四类 Tauri command：

```text
list_built_in_agents(locale) -> metadata + enabled
set_built_in_agent_enabled(agent_id, enabled) -> AppSettings
set_built_in_agent_division_enabled(division_id, enabled) -> AppSettings
resolve_enabled_built_in_agent(agent_id) -> prompt + provenance
```

loader 只接受 manifest 内声明的 safe relative path，并校验 ID、division、license allowlist 与 Prompt hash。列表命令不返回 Prompt body；resolve 命令必须先验证 `AppSettings.enabled_builtin_agent_ids`，再读取单个 body。

替代方案是 frontend dynamic import Catalog JSON，但这会把完整 Prompt 资产打入 JS chunk、弱化 path/hash 校验，并让 send-time enable validation依赖 renderer cache，因此不采用。

### 4. Enable Registry 使用独立 AppSettings 字段

新增：

```rust
enabled_builtin_agent_ids: Vec<String>
```

frontend 映射为 `enabledBuiltInAgentIds`。默认空数组，跨 workspace 共享。settings normalization 对其执行 trim、dedupe、稳定排序并丢弃无效格式；Catalog command 进一步拒绝 unknown ID。

不复用 `enabled_curated_skill_ids`。Curated Skill 是 per-user always-on system instruction；Built-in Agent enable 只是 Composer discoverability gate，两者生命周期与安全语义不同。

Settings toggle 是低频事件，通过现有 AppSettings update path 和 domain refresh 完成，不增加秒级 polling。关闭一个 ID 时立即刷新 Agent provider cache。

### 5. 三态模型：Available、Enabled、Active

```text
Available: manifest 中存在，可在 Settings 浏览
Enabled: AppSettings 中存在，可进入 #
Active: 用户通过 # 选中，当前 thread 存在 Agent Chip
```

`Enabled` 绝不直接注入 Prompt。Composer provider 合并：

- existing custom Agent；
- enabled built-in Agent metadata。

内置 Agent 的 `SelectedAgentOption` 保存 source、catalog ID、localized display metadata 和 provenance，不在 selection storage 中持久化 Prompt body。用户选中内置 Agent 时只形成 Chip；发送时 `useThreadMessaging` 调用 `resolve_enabled_built_in_agent`：

1. backend 重新验证 ID 仍 Enabled；
2. 校验 Prompt hash；
3. 返回 body；
4. 复用现有 `## Agent Role and Instructions` 注入。

若关闭、ID 失效或读取失败，send path fail-closed：不注入该 Agent，并清除/失效当前 selection，返回可理解错误；不得回退到 client store 中的旧 Prompt。

Custom Agent 保持当前 prompt snapshot 路径。OpenCode 继续遵循现有“不注入 selected custom agent”的 engine contract，本 MVP 不扩张其 runtime 语义。

### 6. Settings 与 `#` 使用同一 Division view model

设置页在现有 Agent tab 内增加二级视图：

```text
我的智能体 | 内置智能体
```

内置视图包含：

- `全部 / 17 divisions` 导航；
- `enabled / total` 计数；
- 可点击的 upstream source attribution，使用 Catalog `sourceUrl` 在外部浏览器打开；
- 搜索、全部/仅已开启过滤；
- 单项 Switch；
- division 级全开/全关；
- detail dialog；
- 复制到我的智能体。

`#` 无查询时按“我的智能体”与 division 分组；有查询时跨组匹配，并始终显示 division badge 与 localized description。未 Enabled 项在 provider 数据源阶段过滤，而不是仅在 UI 隐藏。

分组 view model 从 Catalog 返回，Settings 和 Composer 不各自硬编码 division label/count。
`#` 分组标题使用 non-selectable compact header，展示 group icon、localized label、当前可见数量与分隔层级；标题不进入 keyboard selectable index。Catalog 与 Agent provider 的异步刷新使用 request generation guard，旧 locale/request settlement 不得覆盖较新的 enable 或 locale 状态。

### 7. i18n 分成 UI locale 与 Catalog locale

- 用户可见 UI copy 进入现有 `settings` / Composer i18next chunks，10 个 locale 均有 key。
- Catalog metadata 只承诺 `en` 与 `zh-CN`：
  - `zh` 使用 `zh-CN`；
  - `zh-TW` 的 UI 使用繁中，但 Catalog MVP fallback 到 `zh-CN`；
  - 其他 locale fallback 到 `en`。
- Agent 原始 Prompt body 不翻译。
- 搜索索引同时覆盖 active locale name/description、English name/description 与 division labels，保证中文用户可用英文技术词搜索。

### 8. 自定义复制与名称上限

“复制到我的智能体”调用现有 add Agent command，写入 user-owned snapshot。复制后与 Catalog 生命周期解耦，内置项关闭不影响复制项。

现有 20 字符名称限制不足以覆盖上游最长 42 字符名称。frontend 与 Rust validation 一致提升到 64，Prompt 100,000 字符限制保持不变；导入导出格式不变，属于向后兼容扩容。

### 9. 完整性与性能验证

- generator test：17 divisions、248 Agents、localized coverage、stable ordering、hash。
- Rust tests：safe path、unknown ID、default off、toggle normalization、division bulk toggle、disabled resolve rejection、hash mismatch。
- frontend tests：Settings grouping/filter/toggle；`#` 只显示 enabled；localized fallback；selected built-in 不携带 body；send-time resolve 后注入；关闭/失败不注入。
- Catalog metadata 在首次打开相关 surface 时按需 IPC 加载并 module-cache；不在 AppShell mount 时预加载，不增加 polling。

## Risks / Trade-offs

- [Risk] 248 个 Prompt 资产增加安装包体积 → 只 vendor Agent body 与必要 metadata，排除 examples/scripts/playbooks，并记录 package size。
- [Risk] 上游新增/删除 Agent 导致中文映射漂移 → generator 强制 17/248 与 100% localization gate；revision 升级必须显式更新 expectation。
- [Risk] Settings toggle 与 thread selection 存在短暂 renderer race → send-time backend validation 是最终 authority，任何 stale Chip 都不能绕过。
- [Risk] `zh-TW` 暂无独立 Catalog 翻译 → UI 使用繁中，Catalog 明确 fallback 到简中；未来通过 locale map 扩展，不改变 schema。
- [Risk] AppSettings 保存未知旧 ID → normalization 保留格式合法值以支持先读 settings 后载入资源，Catalog list/resolve 负责过滤与拒绝 unknown ID。
- [Risk] 分组全开产生较长 `#` 列表 → provider 维持 search-first、grouped rendering 与 bounded dropdown viewport，不预加载 Prompt。
- [Trade-off] MVP 保留 OpenCode 不注入行为 → 避免未经验证地改变 engine contract；Claude/Codex/Gemini 沿用现有 selected-agent path。

## Migration Plan

1. 增加 Catalog resources、loader 与 build/runtime validation；默认 enabled set 为空，因此发布后无 Prompt 行为变化。
2. 扩展 AppSettings schema，旧 settings 通过 serde default 自动迁移。
3. 接入 Settings 浏览/启用；验证 enable 只改变 discoverability。
4. 接入 Composer metadata provider 和 send-time resolver。
5. 扩展名称长度上限及复制路径。
6. 执行 focused tests、typecheck、Rust tests、Catalog integrity check 和 strict OpenSpec validation。

Rollback：

- UI 可停止暴露 bundled provider，`enabled_builtin_agent_ids` 保留为兼容字段；
- send path 在 resolver 不可用时 fail-closed，不影响 custom Agent；
- 删除 packaged provider 不会修改或删除 `~/.ccgui/agent.json`；
- 本变更不提交 Git，由用户在工作区审阅后决定后续处置。

## Open Questions

无阻塞问题。Remote Catalog、`zh-TW` 独立翻译、Provider-native Agent 与自动 Router 均明确留待后续独立 OpenSpec change。
