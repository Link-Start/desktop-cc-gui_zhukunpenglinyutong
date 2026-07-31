# 同 CLI 多供应商并行 + 新建会话启动绑定（实现指导）

> **日期**：2026-07-31（实现指导修订 v3）  
> **文档用途**：**给 AI / 工程师可直接开干** 的实现说明，不是空讨论  
> **产品决策（已拍板）**  
> 1. **同 CLI、不同供应商** 必须可并行（会话级独立配置，不互相盖盘）  
> 2. **当前 UI 外观不改**（布局、按钮形态、文案风格、菜单结构保持现状）  
> 3. **补上创建会话时供应商启动漏点**（右侧选了哪家，建出来的会话就必须按这家启动）  
> 4. **复用已有隔离代码**，禁止从零重做「CLI 独立供应商并行会话」  
> **上游设计**：[`docs/research/mossx-multi-cli-provider-session-foundation-design.md`](../research/mossx-multi-cli-provider-session-foundation-design.md) §17.2  
> **背景归档**：本文 §附录 A/B（git 追溯、L1/L2、沟通判断）

---

## 0. AI 开干前必读（30 秒）

| 项 | 内容 |
|----|------|
| **要做什么** | 接上并验通 **已有** 会话级供应商能力；补新建菜单 → 创建 → 首发绑定漏点 |
| **怎么做** | **借鉴 / 复用** 7/26–27 已落地代码与路径，**审计 + 接线 + 测**，不是重写一套并行框架 |
| **不能做什么** | 改 UI 外观；从零重做 isolation；**删** backend 已有 isolation |
| **主路径** | **L2 会话 binding**（thread.providerProfileId → 已有 launch env / 独立 home / `--settings`） |
| **「菜单选供应商」产品语义** | **= 用这家来启动（建）会话**（用户心智同设置页点「启用/启动」） |
| **「菜单选供应商」技术实现** | **走会话绑定启动**（已有 L2）；**不是** 无脑调用 Claude 的盖盘 API 当唯一手段 |
| **成功标准** | 同 workspace 两 Claude 会话（Minimax / DeepSeek）并行不串 env；菜单选 B 后创建+首发均为 B |

---

## 0.1 铁律：复用已有代码，禁止重做并行栈

> **下次开干先看本节。** 本轮是 **接线 / 补漏 / 回归**，不是 greenfield 开发「同 CLI 多供应商并行」。

### 已可用（必须借鉴，禁止重写）

| 能力 | 已有落点（优先读这些） | 开干动作 |
|------|------------------------|----------|
| Claude 按 profile 取 env | `src-tauri/src/engine/claude/provider_profile.rs`（`81c62b0da` 起） | **复用** `resolve_claude_provider_launch_profile` |
| Claude runtime 分桶 | 同上 `claude_runtime_key` + `manager.rs` | **复用**；只在分桶失效时修 |
| managed 不被主盘 settings 盖 env | `claude.rs` `ClaudeProviderSettingsOverride` + `--settings`（`099391845`） | **复用**；确认 send 路径仍走到 |
| 创建时 binding 归一化 | `sessionLifecycleController.ts` `providerBindingFromSelectedProfile` | **复用**；有 bug 再改 |
| startThread 写入 binding | `useThreadActionsSessionRuntime.ts` | **审计透传**，不重写启动器 |
| 发送带 profile | `useThreadMessaging.ts` + `getThreadProviderProfileId` | **审计不丢** |
| Codex 独立 home | `codex/provider_profile.rs` materialize | **复用** |
| 菜单已传 profile 到 create | `useSidebarMenus.ts` 左侧 `runAddAgent(..., { providerProfileId })` | **补全/统一** 右侧记忆与端到端，不新造菜单协议 |

### 本轮允许写的代码类型

```text
✅ 审计端到端，修「丢 providerProfileId」的分支
✅ 抽小函数统一「菜单选 profile」记忆，避免某 engine 漏记
✅ 补单测 / 回归测 / 手工矩阵
✅ 极少量注释（L1 盖盘 vs L2 会话）
❌ 新写一套 provider runtime / 新 spawn 架构 / 新配置目录方案
❌ 复制粘贴再实现一遍「并行会话隔离」
❌ 以「重构 isolation」为名大改 claude.rs 生命周期
```

### 推荐工作流（给 AI）

```text
1. 读 §5 数据流 + 上表「已可用」文件，对照 HEAD 是否仍调用
2. 从菜单 onSelect 打到 engine_send_message，标出断点
3. 只修断点；优先最小 diff
4. 用 §6 验收；并行靠已有 runtime_key / --settings / codex home 证明，不新造机制
```

---

## 0.2 「菜单选供应商」= 启用启动？怎么理解

### 产品语义（你的理解 — **正确，以此为准**）

```text
设置页点「启用 / 启动」某供应商
  ≈ 选定「用这家配置去跑」

新建菜单右侧点某供应商
  ≈ 选定「接下来创建的会话用这家配置去跑」
```

用户心智上 **就是启用这家来启动会话**。漏点就是：现在只「打勾 + 记忆」，**没有完整变成「创建/首发真用这家」**（或链路某处丢了）。

### 技术实现（必须拆两层，避免误读）

| | 产品要的效果 | 错误实现 | 正确实现（复用已有） |
|--|--------------|----------|---------------------|
| **启用启动** | 选了 P → 新会话按 P 的 env/配置跑 | 菜单里调 `switchClaudeProvider(P)` **盖** `~/.claude/settings.json`，靠主盘当唯一真相 | 创建时 **L2 绑定** `providerProfileId=P`，spawn/send 走 **已有** launch profile + `--settings` / Codex home |
| **配置页「使用中」** | 全局 default 标记（可保留） | 每次菜单选择都盖盘，毁掉并行 | 配置页按钮继续管 L1；**会话启动不依赖 L1 盖盘成功** |
| **并行** | A 会话 Minimax、B 会话 DeepSeek 同时跑 | 全局只能有一个「盖进磁盘的 current」 | 各会话各自 L2 binding（**已有代码**） |

### 文档里这句该怎么读

> ~~旧表述易误解~~：「菜单右侧选供应商不会去调 Claude 盖盘 switch」

**正确表述：**

1. **产品上**：菜单选供应商 **就是**「启用这家来启动（建）会话」——效果上要对齐设置页「启动」的意图。  
2. **技术上**：实现这个意图时，**主路径必须是会话级 binding（已有隔离栈）**，**禁止**把「等于设置页启用」理解成「必须调用会 `apply_provider_to_claude_settings` 的那条 Claude switch」。  
3. **原因**：Claude 设置页「启用」在代码里 = 改 `claude.current` **并 merge 写用户主盘 settings**。若菜单也走这条，同 CLI 多供应商并行会退化成「磁盘上只能有一家」。  
4. **Codex 等**：`switchCodexProvider` 多半只改 app 内 current、不盖用户主 `~/.codex`；与 Claude **不是同一副作用**。实现时按引擎看，**仍以 L2 binding 为会话真相**。

### 若产品还要求「菜单选完，配置页也显示使用中」

| 做法 | 是否本轮 | 说明 |
|------|----------|------|
| 仅 L2 绑定，配置页「使用中」可不同步 | **默认推荐** | 并行最干净；菜单 = 启动本会话 |
| 菜单选后更新 app `*.current` **且 Claude 不写盘** | follow-up | 需拆 switch API（set-current-only），本轮非必须 |
| 菜单选后完整 `switchClaudeProvider`（盖盘） | **禁止** 作为并行主路径 | 与 G1 冲突 |

---

## 1. 目标 / 非目标

### 1.1 目标（In Scope）

| ID | 目标 | 用户可感知结果 |
|----|------|----------------|
| **G0** | **复用已有并行/隔离实现** | 不重写栈；行为建立在 7/26–27 已有路径上 |
| **G1** | **同 CLI 多供应商能力可用** | 同一引擎可多会话、各绑不同 managed provider，互不影响 |
| **G2** | **创建启动漏点闭环** | 菜单右侧选供应商 **= 启用这家启动会话**；创建+首发配置 = 该供应商 |
| **G3** | **UI 外观冻结** | 配置页「使用中/启用」、新建菜单 **不重做视觉**；只修行为与数据契约 |
| **G4** | **回归可测** | 单测 + 手工清单覆盖绑定链路与并行隔离 |

### 1.2 非目标（Out of Scope）

| 禁止 | 说明 |
|------|------|
| **从零重做「独立供应商并行会话」** | 已有 provider_profile / runtime_key / `--settings` / Codex home；只接线与测 |
| 重做供应商设置面板视觉 / 去掉「启用」按钮 | 外观保留 |
| 新建菜单改成一步点击即创建 | 保持「右侧选 → 左侧建」，但选 = 启动绑定 |
| 为 managed Claude 物化独立 `CLAUDE_CONFIG_DIR` | 已否决；继续用已有 env + `--settings` |
| Shared Session V2 大改 | 不在本轮 |
| 用 Claude **盖盘** `switchClaudeProvider` 充当菜单「启用启动」的唯一实现 | 破坏并行；见 §0.2 |

---

## 2. 能力定义（必须体现的产品行为）

### 2.1 同 CLI × 多供应商（G1）

```text
Workspace W
  ├─ Thread T1  engine=claude  providerProfileId=minimax-xxx
  └─ Thread T2  engine=claude  providerProfileId=deepseek-xxx

用户可同时在 T1 / T2 发消息：
  · env / base URL / token 互不串
  · interrupt / approval 不打到错误 provider runtime
  · 配置页再点「启用」另一家，不改变 T1/T2 已绑定 profile
```

**体现方式（无新 UI）**：

- 数据：thread 持久化 `providerProfileId` / `providerProfileName` / `providerProfileSource`
- 运行：Claude `claude::{ws}::{profile}` + launch profile env + `--settings`；Codex 独立 home
- 侧栏会话行若已有供应商展示则保持；**本轮不新增装饰**，以「能并行跑通」为准

### 2.2 创建启动绑定（G2）

```text
打开「新建会话」
  → 右侧勾选 Provider P（keepMenuOpen）
  → 左侧点击 Engine E
  → 创建 Thread：
       engine = E
       providerProfileId = P.id   （managed）
       或 local/disk sentinel 规则见 §4.2
  → 首条消息 send 必须带同一 providerProfileId
```

**漏点定义（当前）**：

| 步骤 | 现状 | 问题 |
|------|------|------|
| 右侧 onSelect | 只 `writeLastProviderProfileId` + React state + toast | 用户以为「已启动配置」 |
| 左侧 onSelect | 已传 `providerProfileId` + `providerProfile` | 主路径大体有，但需 **端到端验收 + 缺口修补** |
| 创建后 pending thread | `ensureThread` 写入 binding | 需确认所有引擎一致 |
| 首发 | `getThreadProviderProfileId` → `engine_send_message` | 需确认无丢、无 fallback 到「全局 current」 |

实现时 **以契约验收为准**，不要假设「看起来传了就一定对」。

---

## 3. 架构原则（实现铁律）

### 3.1 L1 vs L2（禁止混用）

```text
L1 全局 default（配置页「使用中 / 启用」）
  · app config: claude.current / codex.current / …
  · Claude managed 启用 → apply_provider_to_claude_settings（盖 ~/.claude/settings.json）
  · 本轮：外观与配置页逻辑保留；新建菜单 **不** 调用 Claude 盖盘 switch

L2 会话 binding（并行主路径）
  · thread.providerProfileId
  · 发送 / spawn 只信 L2
  · managed 不依赖「主盘当前是谁」
```

| 操作 | 应改 L1？ | 应改 L2？ |
|------|-----------|-----------|
| 配置页点「启用」 | 是（现状） | 否（不得改写已有会话 binding） |
| 新建菜单右侧选供应商 | **否**（本轮） | 写 **pending 记忆**（localStorage + state） |
| 新建菜单左侧创建 | 可选更新「上次创建记忆」 | **必须** 写入 thread L2 |
| 会话内发送 | 否 | 读 thread L2 |

### 3.2 已有 backend 资产（复用，禁止重写）

| 资产 | 路径 | 用途 |
|------|------|------|
| Claude launch profile | `src-tauri/src/engine/claude/provider_profile.rs` | 按 id 取 managed env |
| Claude runtime key | 同上 `claude_runtime_key` | 同 ws 多 provider 分桶 |
| Claude `--settings` 覆盖 | `src-tauri/src/engine/claude.rs` `ClaudeProviderSettingsOverride` | managed 不被主盘 settings 盖 env |
| Codex 独立 home | `src-tauri/src/codex/provider_profile.rs` materialize | Codex 并行隔离 |
| 前端 binding 工具 | `sessionLifecycleController.ts` `providerBindingFromSelectedProfile` | create 时归一化 |
| 发送带 profile | `useThreadMessaging.ts` `getThreadProviderProfileId` | 首发/续发 |

### 3.3 Git 事实（防止再踩坑）

| 时间 | 事实 |
|------|------|
| 7/26–27 | 会话级 env、去设置页「启用」、「新会话可选」、`--settings` isolation 已落地（chenxiangning） |
| 7/30 | 供应商面板重做 **加回启用按钮**（zhukunpenglinyutong）；**backend isolation 未删** |
| 本轮 | **不** 再改外观去对齐 7/27 文案；**行为** 对齐 7/26–27 的 L2 隔离目标 |

---

## 4. 实现点拆解（按优先级）

> 实现顺序建议：**I1 → I2 → I3 → I4**。每项有「改哪里 / 怎么验 / 禁止项」。

### I1 — 创建会话启动漏点（P0，必须）

**意图（产品）**：菜单右侧选供应商 **= 启用这家来启动会话**（见 §0.2）。  
**意图（技术）**：右侧选中的 P → 新建 thread 的 L2 binding → 首发 launch profile（**复用已有** resolve / --settings / home，不新造）。

#### 4.1.1 行为契约

1. `buildSessionMenuGroup` 内右侧 `onSelect`：  
   - **必须** 完成「启动选用」：`writeLastProviderProfileId` + `set*SelectedProfileId`（+ notice 可保留）  
   - 语义：选定 P 作为 **接下来创建会话的启用供应商**  
   - **禁止** 用 Claude `switchClaudeProvider` / `apply_provider_to_claude_settings` 当唯一实现（盖盘，见 §0.2）  
2. 左侧 `onSelect` / `runAddAgent`：  
   - **必须** 传入当前选中 profile 的 `providerProfileId` + `providerProfile`（含 source/name/availability）  
   - 若 profile `availability === "unavailable"` → 不创建（现状保留）  
3. `startThreadForWorkspace` → **已有** `providerBindingFromSelectedProfile` → `ensureThread`：  
   - managed：写入 `providerProfileId` / `source` / `name` / `availability`  
   - local/disk sentinel：沿用 **已有** 函数规则，不重写  
4. Claude/Kimi/Grok/OpenCode pending 创建路径：`ensureThread` **必须** 带上 `...selectedProviderBinding`（核对各分支是否漏 spread）  
5. 首发：`getThreadProviderProfileId` 非空（managed）时，`engine_send_message` **禁止** 改用全局 current；backend 走 **已有** launch profile  

#### 4.1.2 建议改动文件（接线，非重写）

| 文件 | 动作 |
|------|------|
| `src/features/app/hooks/useSidebarMenus.ts` | 审计/统一「选 P = 启动选用」记忆；左侧 create 必带 profile；**不**新写启动协议 |
| `src/features/app/hooks/useSidebarMenus.test.tsx` | 选 managed → create 带 id；菜单路径 **不** 触发 Claude 盖盘 switch（mock 断言） |
| `src/features/app/hooks/useWorkspaceActions.ts` | 确认 options 透传，不剥 profile |
| `src/features/threads/hooks/useThreadActionsSessionRuntime.ts` | **审计** 各 engine 分支 binding 不丢 |
| `src/features/threads/hooks/sessionLifecycleController.ts` | 仅 bugfix；加单测 |
| `src/features/threads/hooks/useThreadMessaging.ts` | **审计** 首发读 thread profile |

#### 4.1.3 验收（I1）

```text
[ ] 单测：claude/codex/kimi/grok/opencode 各至少 1 条「选 managed → create 带正确 providerProfileId」
[ ] 单测：选 local/disk 后 create 符合已有 providerBindingFromSelectedProfile 契约
[ ] 单测：菜单「启用启动」路径不调用会盖盘的 switchClaudeProvider
[ ] 手工：菜单选 Minimax → 建 Claude → metadata/debug 含 minimax；首条消息成功（= 启用启动生效）
[ ] 手工：该会话不依赖配置页事先点过「启用」也能跑 managed（体现 L2，非 L1 盖盘）
```

#### 4.1.4 禁止（I1）

- 禁止从零实现「选供应商启动」而绕过已有 launch profile / send 路径  
- 禁止创建时丢 profile 再「发送时读全局 current」兜底  
- 禁止把「产品上的启用启动」误实现成「Claude 盖盘 switch」  

---

### I2 — 同 CLI 多供应商并行可用（P0，必须）

**意图**：G1 在运行时成立；**建立在已有 isolation 上**，优先测、少改。

#### 4.2.1 行为契约

1. 同 workspace、同 engine、不同 `providerProfileId` 的两个 thread：  
   - 各自 **已有** `runtime_key` 分桶  
   - managed Claude：各自 env + 各自 turn **已有** `--settings`  
   - managed Codex：各自 **已有** home  
2. 对 thread A 的 interrupt/send **不得** 误路由到 thread B 的 provider runtime  
3. 配置页对 provider X 点「启用」（L1 盖盘）**不得** 改变 thread A/B 已存的 `providerProfileId`  
4. 删除某 managed provider 后：已绑该 id 的会话 fail-closed——若现状已有则加测；无则最小补错误，**不**做自动迁移、**不**新架构  

#### 4.2.2 建议改动文件

| 文件 | 动作 |
|------|------|
| `src-tauri/src/engine/claude.rs` / `provider_profile.rs` / `manager.rs` | **优先加测试证明已有能力**；仅 regression 时微修 |
| `src-tauri/src/engine/commands.rs` | 审计 send 仍走 resolve + launch profile |
| `src-tauri/src/codex/provider_profile.rs` | 复用已有 materialize 测 |
| 前端 thread list / debug | metadata 丢失才修透出，**不改样式** |

#### 4.2.3 验收（I2）

```text
[ ] 手工矩阵（同 workspace）：
    Claude + ProviderA 会话 / Claude + ProviderB 会话 同时发 1 条
    确认请求打到不同 base/token（可用日志 providerRuntimeKey / 不含 secret 的 endpoint 标签）
[ ] 配置页启用 ProviderC 后，A/B 会话 metadata 不变，续发仍走 A/B
[ ] 已有或新增 rust/前端测：双 provider runtime key 不同
```

#### 4.2.4 禁止（I2）

- 禁止用「先 switch 再 start」串行模拟并行  
- 禁止为并行去改配置页去掉启用（外观冻结）  

---

### I3 — UI 外观冻结下的「能力体现」（P1）

**意图**：用户能 **用** 到同 CLI 多供应商，而不是看懂一篇设计。

#### 4.3.1 允许的「体现」

| 允许 | 说明 |
|------|------|
| 行为可用 | 新建菜单多供应商创建 + 并行会话（主交付） |
| 已有展示 | 会话行/continuation 若已有 provider 名则保持正确数据 |
| 文案微调（可选） | **仅当** 现有 tip 误导「必须先启用配置页」时，改 **一句** i18n 语义；**不改布局/颜色/组件** |

#### 4.3.2 禁止的「体现」

| 禁止 |
|------|
| 新面板、新 badge 样式体系、重排供应商表 |
| 把「启用」改成「新会话可选」的 7/27 视觉方案（本轮明确不做） |
| 为能力演示加引导页 / onboarding 弹窗 |

#### 4.3.3 建议

- **默认零视觉 diff**：`git diff` 中 CSS / 大块 JSX 结构应接近 0  
- 能力体现靠 **手工矩阵 + 数据正确** 验收  

---

### I4 — 配置页 L1 与 L2 边界说明（P2，文档/注释级优先）

**意图**：避免后续 AI/作者再把「启用」当成并行主路径。

#### 4.4.1 最小动作

1. 在 `useProviderManagement.ts` / `vendor_switch_claude_provider` 附近加 **简短中文注释**：  
   - L1 启用会写盘；并行会话以 thread.providerProfileId 为准  
2. 可选：在 `openspec` 或本文件链接处记一条 contract（不必本轮大改 OpenSpec，除非已有 change）  

#### 4.4.2 本轮不做

- 不删除 `switchClaudeProvider`  
- 不改启用按钮  
- 不做 set-current-only 后端拆分（可列为 follow-up）  

---

## 5. 端到端数据流（实现对照图）

```text
[新建菜单右侧] profile P
      │
      ├─ writeLastProviderProfileId(engine, P.id)     // 记忆
      └─ setSelectedProfileId(P.id)                   // 菜单勾选
              │
              ▼
[新建菜单左侧] engine E
      │
      └─ onAddAgent(ws, E, { providerProfileId, providerProfile })
              │
              ▼
[useWorkspaceActions] creationOptions
              │
              ▼
[startThreadForWorkspace]
      │  providerBindingFromSelectedProfile(...)
      ├─ ensureThread({ engine, ...binding })         // L2 落库/内存
      └─ (codex managed: 真实 start_thread 带 profile)
              │
              ▼
[用户首条消息]
      │  getThreadProviderProfileId(ws, threadId)
      └─ engine_send_message(..., providerProfileId)
              │
              ▼
[Backend]
      Claude: resolve_claude_provider_launch_profile
            + ClaudeProviderSettingsOverride (--settings)
            + runtime_key = claude::ws::profile
      Codex:  materialize home + codex::ws::profile
```

**漏点检查表**（实现时逐段打勾）：

| 段 | 检查 |
|----|------|
| 菜单 → onAddAgent | profile id 非空（managed） |
| onAddAgent → startThread | options 未剥掉 providerProfile |
| startThread → ensureThread | binding 字段齐全 |
| ensureThread → 首发 | getThreadProviderProfileId 可读 |
| 首发 → backend | 未替换为 null / global current |
| backend → child | managed 使用 profile env，非仅主盘 |

---

## 6. 测试与验收清单

### 6.1 自动化（实现者必须跑）

```bash
# 菜单绑定（按仓库习惯；命令以 package.json 为准）
pnpm vitest run src/features/app/hooks/useSidebarMenus.test.tsx
pnpm vitest run src/features/threads/hooks/sessionLifecycleController.test.ts

# 若改动 session runtime / messaging，补跑对应 test 文件
# Claude provider isolation（若有）
# cargo test -p ... provider 相关（按现有测试命名检索）
```

**新增用例建议名**：

- `remembers provider and creates session with binding for each engine`  
- `provider submenu select does not call switch*Provider`  
- `create then first-send uses thread providerProfileId`（若可测 messaging）  

### 6.2 手工矩阵（产品验收）

| # | 步骤 | 期望 |
|---|------|------|
| H1 | 配置页不点启用；新建菜单选 Claude+ProviderA 创建 | 会话带 A；可发消息 |
| H2 | 再建 Claude+ProviderB | 会话带 B；可与 A 同时进行 |
| H3 | 配置页「启用」ProviderC | A/B 会话 binding 不变；续发仍 A/B |
| H4 | 新建菜单选「本地配置/跟随全局」创建 | 走 local 路径；不注入 managed env |
| H5 | Codex 重复 H1–H2 | 双 provider 独立 home 行为正常 |
| H6 | UI 截图对比设置页/新建菜单 | **无外观回归**（像素级不要求，结构一致即可） |

### 6.3 回归红线

| 红线 | 说明 |
|------|------|
| 并行串 env | 两会话 token/base 交叉 → **失败** |
| 创建丢 binding | metadata 无 providerProfileId（managed）→ **失败** |
| 菜单选调 Claude switch 盖盘 | 代码审查发现 → **失败** |
| 大面积 CSS/结构 diff | 违反外观冻结 → **失败** |

---

## 7. 任务顺序（给 AI 的执行剧本）

```text
Step 1  只读 + 复用清单（§0.1）
  · 打开「已可用」文件表，确认 HEAD 仍调用 launch profile / --settings / binding 工具
  · 跟 §5 数据流，标「丢 binding」断点；禁止规划「重写并行栈」

Step 2  I1 创建漏点（菜单选 = 启用启动，L2 实现）
  · 修透传 / ensureThread / 单测
  · 跑 useSidebarMenus + sessionLifecycle 相关测

Step 3  I2 并行（证明已有能力）
  · 以测试与手工矩阵为主；backend 仅 regression 微修
  · 确认 --settings / runtime_key / codex home 仍被 send 调用

Step 4  I3 外观
  · git diff --stat：无 CSS/大结构 UI 改动

Step 5  I4 注释
  · L1 盖盘 vs L2 会话启用启动 注释 2–5 行

Step 6  交付说明
  · 写清：复用了哪些已有路径、修了哪些断点、未重做 isolation
  · 附手工矩阵 H1–H6 结果
```

**Commit 建议**（中文 Conventional）：

```text
fix(session): 补齐新建菜单供应商绑定并保障同CLI多供应商并行
```

---

## 8. 决策记录（实现时不得重新争论）

| 议题 | 决定 |
|------|------|
| 并行 vs 盖盘 | **并行（L2）优先**；Claude 盖盘仅 L1 配置页遗留 |
| 菜单选供应商产品语义 | **= 启用这家启动会话**（同设置页「启动」意图） |
| 菜单选供应商技术实现 | **L2 binding + 已有 launch 栈**；**禁止** 用 Claude 盖盘 switch 当唯一手段 |
| 是否从零重做并行 | **否**；复用 7/26–27 已有代码，审计接线 |
| UI 是否改回「新会话可选」 | **否**（外观冻结） |
| 是否一步创建 | **否**（保持右选左建） |
| 谁对（历史） | 产品并行 + 会话启用启动对齐 7/26–27 设计；7/30 启用按钮是 L1 UI；backend isolation 仍在 |

---

## 9. 源码索引（开干入口）

| 主题 | 路径 |
|------|------|
| 新建菜单 | `src/features/app/hooks/useSidebarMenus.ts` |
| 菜单测 | `src/features/app/hooks/useSidebarMenus.test.tsx` |
| 创建 flow | `src/features/app/hooks/useWorkspaceActions.ts` |
| startThread + binding | `src/features/threads/hooks/useThreadActionsSessionRuntime.ts` |
| binding 工具 | `src/features/threads/hooks/sessionLifecycleController.ts` |
| 发送 profile | `src/features/threads/hooks/useThreadMessaging.ts` |
| getThreadProviderProfileId | `src/features/threads/hooks/useThreads.ts` |
| Claude launch | `src-tauri/src/engine/claude/provider_profile.rs` |
| Claude spawn / --settings | `src-tauri/src/engine/claude.rs` |
| engine send | `src-tauri/src/engine/commands.rs` |
| Claude 盖盘 switch | `src-tauri/src/vendors/commands.rs` |
| 配置页启用 UI | `src/features/vendors/components/ProviderList.tsx`（**只读，勿改外观**） |
| 并行设计 | `docs/research/mossx-multi-cli-provider-session-foundation-design.md` §17.2 |

---

## 附录 A — Git 追溯（背景）

| 日期 | Commit | 作者 | 内容 |
|------|--------|------|------|
| 2026-07-26 | `81c62b0da` | chenxiangning | 会话级供应商 env |
| 2026-07-27 | `dcebf6a1a` | chenxiangning | 隔离基础；UI 去启用 →「新会话可选」 |
| 2026-07-27 | `099391845` | chenxiangning | `--settings` 私有覆盖 |
| 2026-07-30 | `d7a657f5a` | zhukunpenglinyutong | 面板重做；**加回启用/onSwitch** |

```bash
git show 81c62b0da --stat
git show dcebf6a1a -- src/features/vendors/components/ProviderList.tsx
git show 099391845 --stat
git show d7a657f5a -- src/features/vendors/components/ProviderList.tsx \
  src/features/vendors/hooks/useProviderManagement.ts
```

**精确结论**：独立启动链路 **未被整段删除**；设置页「禁止全局启用」契约被 7/30 **UI 回退**。本轮用 L2 行为对齐隔离目标，**不** 用 UI 回滚复刻 7/27。

---

## 附录 B — L1/L2 与历史沟通（背景）

| 层 | 并行？ | 盖主盘？ |
|----|--------|----------|
| L1 全局 current / 启用 | 否 | Claude managed 启用会 |
| L2 thread.providerProfileId | 是（目标） | managed 不应依赖 |

| 角色 | 观点 |
|------|------|
| 产品 | 客户端独立配置，并行多供应商 |
| 作者 | 先保持覆盖；并行可选 |
| 工程结论 | 覆盖是 L1 现状；并行是已写设计 + 部分代码；本轮实现 L2 闭环且冻结 UI |

---

## 附录 C — 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-31 | 初稿：问题识别、判断、git 追溯 |
| 2026-07-31 | 实现指导：G1/G2/G3、I1–I4、验收剧本 |
| 2026-07-31 | **v3**：§0.1 铁律复用已有隔离代码禁止重做；§0.2 菜单选=产品启用启动 vs 技术盖盘 switch 拆分；I1/I2/决策表对齐 |
