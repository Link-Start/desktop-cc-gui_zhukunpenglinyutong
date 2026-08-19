## Why

用户侧栏被 Shared CLI 续跑产生的 native jsonl 和其子代理灌满（「继续」「Base directory…」「Socrates」）。根因不是幕布，而是 **Session Index 用 `history.jsonl` 友好标题盖掉 `MOSSX_*` 协议包**，且 hide set 只认当前 binding UUID，不认每次续跑新写的文件 sessionId。现有 parent-id 藏崽闸因此失效：parent 是文件 UUID，keys 里只有 binding。

## 目标与边界

### 目标

| ID | 目标 | 可测定义 |
|----|------|----------|
| G1 | Shared 协议 owner 不进侧栏 | 首条真实 user 为 `MOSSX_CONTEXT_PACKAGE` / `MOSSX_SHARED_CONTEXT_V1` / `MOSSX_NATIVE_CONTEXT_V1` 的 Claude jsonl，即使 `history.jsonl` 标题是「继续」，Index 与侧栏根列表 MUST NOT 出现该行 |
| G2 | 历史文件 UUID 进 hide set | 正文声明 `session:{sharedId}` 的 native 文件 sessionId MUST 进入 protocol hide，不只当前 binding |
| G3 | Shared 崽子不进侧栏树 | Claude `subagent:{fileUuid}:…` / Codex `source.subagent.thread_spawn.parent_thread_id` 指向 Shared-owned parent 时，侧栏 MUST NOT 将其升为根；store / 幕布 / Strip 仍可保留 |
| G4 | Native Codex 树零误伤 | 本机 TUI/Desktop 亲儿子（Socrates parent=`01a00d6c-…`、Singer parent=`019fc7da-…`）MUST 继续可见并挂在用户 parent 下 |
| G5 | 不改幕布 | 禁止改 canvas / Strip / `childSubagentThreads` 渲染规则 |

### 边界

- 侧栏 membership：Session Index Claude writer、visibility protocol hide、`useThreadRows` / ingest hide。
- Codex 崽子身份只认 `session_meta.source.subagent.thread_spawn.parent_thread_id`（canonical uuid），经既有 `sharedHideIdentity` 对齐 rollout-stem。
- 碰撞测试：用户 Claude dump 正例 + 本机 Codex Socrates/Singer 负例。

## 非目标

| 项 | 原因 |
|----|------|
| 按「Base directory」/希腊名裸标题藏行 | 无 Shared 所有权证据时宁漏勿误伤 |
| 用 `originator=ccgui\|mossx` 藏行 | 那是 Native mossx Codex，不是 Shared 包 |
| 藏全部 `thread_spawn` 子代理 | 会干掉用户自己的 Codex 树 |
| 改幕布 / Strip / inspector 合成 | 用户明确禁止 |
| 清理磁盘 orphan jsonl | 用户可手动删；本波只藏列表 |
| 用 child `session_id` 当自己的 id | Codex child.meta.session_id 是 **父** id |

## What Changes

- Claude Index writer：首条真实 user 命中 MOSSX 协议 → **整行不入库**，`history.jsonl` 友好标题不得覆盖。
- protocol hide：把协议声明的 **文件 sessionId**（非仅 binding）并入 `protocolHiddenNativeIds`。
- 侧栏 hide：parent 命中 Shared-owned 文件 UUID / binding / `shared:` → 不进侧栏树；store 保留。
- Codex：仅当 parent ∈ Shared hide set 时藏崽；TUI/Desktop 亲儿子不变。
- 碰撞测试覆盖 Claude dump 正例与本机 Socrates/Singer 负例。

## 技术方案对比与取舍

| 方案 | 说明 | 取舍 |
|------|------|------|
| A. 按标题「继续 / Base directory / Socrates」藏 | 误伤用户会话与 Native Codex 树 | **拒绝** |
| B. 只扩 hide set 到当前 binding 别名 | 续跑新文件 UUID 仍漏；Index 仍用 history 标题入库 | **拒绝** |
| **C. transcript 所有权 + parent∈Shared-owned 藏崽（采用）** | Index 以正文协议为准；hide set 含文件 UUID；幕布不动 | **采用** |

## Capabilities

### New Capabilities

- `shared-spawn-sidebar-ownership`：侧栏 membership 以 transcript / parent 的 Shared 所有权为准；Index 不得用友好标题覆盖协议 owner；Shared 崽子不进侧栏树，Native Codex 树不误伤。

### Modified Capabilities

- `shared-session-thread`：Hidden Native Binding 必须覆盖协议拥有的历史文件 sessionId，不只当前 binding。
- `subagent-session-tree-navigation`：parent 为 Shared-owned 时侧栏 MUST 隐藏 child 根行；parent 为用户 Native 时树形展示不变。

## Impact

| 层 | 触点 |
|----|------|
| Rust | `session_index/writers.rs` Claude peek/omit；`shared_visibility.rs` protocol hide |
| Frontend | `useThreadRows` / `isSharedSidebarHiddenPup` / Index early-paint ingest |
| Tests | writer / visibility / useThreadRows / hide identity 碰撞测 |
| Specs | 新 capability + 两条 delta |
| 无 | 幕布渲染、Shared V2 send、binding materialize |

## 验收标准

1. Claude dump 中带 `MOSSX_SHARED_CONTEXT_V1` 的顶层 jsonl 不出现在侧栏根（标题「继续」也不行）。
2. 其 `subagents/agent-*.jsonl` 不升为侧栏根。
3. 本机 Socrates (`01a00d8f-…` → parent `01a00d6c-…`) 与 Singer (`019fc810-…` → parent `019fc7da-…`) 仍可见。
4. 无 Shared 所有权的 Native 会话不因 sdk-cli / originator 被藏。
5. 幕布 / Strip 数据源不因本变更删 store 行。
6. `openspec validate hide-shared-spawned-sidebar-sessions --strict` + focused 测试通过。
7. **不自动 commit**。
