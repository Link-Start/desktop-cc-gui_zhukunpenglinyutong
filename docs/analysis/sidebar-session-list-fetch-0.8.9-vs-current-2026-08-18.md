---
type: analysis
status: historical
created: 2026-08-18
product_line: 0.9.1
compare_baseline: bump-version-0.8.9@71b42b1b7
current_tip: 687cfd0c3
---

# 左侧 Session 加载主线：0.8.9 → 0.9.1

> **Lifecycle**: historical。对照证据，不是 OpenSpec 合同。
>
> 本轮合同：[`openspec/changes/complete-native-sidebar-session-index`](../../openspec/changes/complete-native-sidebar-session-index/proposal.md)。
>
> 0.8.9 对照线：`bump-version-0.8.9@71b42b1`（`rewrite-sidebar-session-index` 收口后，不是发布 tag 瞬间）。
> 当前：`0.9.1` HEAD。

## 0. 先回答你问的四件事

| 问题 | 答案 |
|---|---|
| 0.8.9 重构后几层？ | **2 层**：读 = SQLite；写 = 后台扫盘回写。 |
| 0.9.1 现在几层？ | **设计仍是 2 层**。多出来的不是新层，是读层漏口 + **投影不稳**。 |
| 0.9.1 游标没了吗？ | **没丢。** 查询分页 cursor 和扫盘 backfill cursor 都在，周期也一样（45s 首拍 / 90s）。 |
| 左侧读源已经唯一 SQLite 了吗？ | **还没有。** Shared 另拉；DSH 能写入但 list 白名单查不到，first-paint 再扫盘补。 |

目标主线只有一句：

```text
磁盘 / CLI 家目录  --后台周期 + 游标-->  session_index.sqlite  --侧栏唯一读取-->  左侧列表
```

扫盘不得上切项目 / first-paint 热路径。

**上一版漏补的产品不变量（本轮重构就是为这个）：**

```text
native 行一旦写入 session_index，不得因路径键漂移、写超时空提交、
hide 未就绪、露出条数 < 拉取条数，从侧栏蒸发。
磁盘文件还在、账本行还在、画面却没了 = 2 层架构没闭环。
```

Windows 上 native Grok 经常消失，就是这条不变量的现场。PI 同族、风险次之。不是「P0 做完再看的边角」，是 2 层读必须找得到自己写过的行。

---

## 1. 两层是什么（0.8.9 定的，0.9.1 没换骨架）

0.8.9 那轮重构把侧栏从「每次切项目扫会话宇宙」收成：

| 层 | 唯一职责 | 大白话 | 含义 | 取舍 |
|---|---|---|---|---|
| **读层** | `list_session_index_for_workspace` | 侧栏只问本地账本 | list 行与磁盘解耦；**已入账的 native 行必须还能被这把钥匙找到** | 账本落后时，新会话等写层；**旧会话不得蒸发** |
| **写层** | importer：近期 sync + 历史 cursor backfill | 全局扫盘，不挡画面 | 扫盘成本离开点击热路径；超时/失败不得把「没扫到」写成「这个 workspace 没这引擎」 | 首屏可以不完整，靠后续补 |

两条**不是侧栏拉取**的路，两边都还在，也不该并进来：

- 打开一篇对话 = transcript loader（正文）
- 会话管理 / 强制刷新 = `list_workspace_sessions` catalog（归属权威）

| | 0.8.9 后续线 | 当前 0.9.1 |
|---|---|---|
| 设计层数 | 读 1 + 写 1 | 同左 |
| 写层周期 | 45s 首次 / 90s 一拍 / 每拍 sync+backfill | **相同** |
| 侧栏是否只读 SQLite | 基本是（first-paint 已关 catalog / 磁盘 list） | **还不是**（见 §3） |

---

## 2. 游标：两套，0.9.1 都在

不要把「翻页书签」和「扫盘进度」混成一个东西。

| 游标 | 干什么 | 存在位置 | 0.8.9 | 0.9.1 |
|---|---|---|---|---|
| **查询分页** | 用户点「更多」，只翻账本 | `session-index::{updatedAt,sessionId}` | 有 | **有** |
| **扫盘回填** | 后台按引擎把历史一截截写入账本 | `session_index_backfill.cursor` | 有 | **有，同周期** |

写层每拍做什么（`importer.rs`）：

1. `sync_session_index_core` — 近期行；8s 内 fingerprint 没变就跳过
2. `backfill_session_index_core` — 按引擎 cursor 再补一截历史

所以「0.9.1 没有游标」是误判。缺的是读层还没收成「只问 SQLite」，以及问到了也要用同一把钥匙找到已入账的行。

---

## 3. Shared + 每个 Native 引擎（规则必须同一套）

统一四问，漏一问就算没对齐：

1. **读**：侧栏能否只靠 SQLite 画出它？
2. **写·近期**：后台 sync 会不会写入账本？
3. **写·历史**：有没有 cursor，能否跨拍补全？
4. **投影稳**：进过账本的行，换一种 Windows 路径写法 / 写超时 / hide 未就绪，还能被读层找到吗？

| 来源 | 读 SQLite | 写·近期 | 写·历史 cursor | 大白话 | 含义 / 取舍 |
|---|---|---|---|---|---|
| **Shared** | **否**。first-paint 在 Index 早画之后仍 `await listSharedSessions` | 不进 `session_index` 表 | 无 | 另一套身份，不是 native 行 | 不进账本就无法「唯一 SQLite」。hide 也靠这次另拉。进账本必须带 visibility，否则和 native 重影 |
| Claude | 是 | 有 | 有（项目目录文件 offset） | 账本主力 | 历史 JSONL 贵，只能后台分页 |
| Codex | 是 | 有 | 有（按日分区） | 账本主力 | 同左 |
| Kimi | 是 | 有 | 有（index 行 offset） | 账本主力 | 同左 |
| Gemini | 是 | 有（8s fresh） | 有（async covered count） | 账本有，新会话靠写层 | 前端默认不再扫盘 |
| Grok | 名义上是 | 有，但 **3s timeout → 空 commit** | 有 | **不是** Gemini 同类。磁盘是 `~/.grok/sessions/<url-encoded-cwd>/` | Windows 路径变体 + 超时空提交 + 读层精确字符串匹配 = **账本行还在，侧栏蒸发**。无 first-paint 磁盘救援 |
| OpenCode | 是 | 有（软失败，不挡侧栏） | **刻意无** | 有 CLI 才有近期行 | 无稳定磁盘索引。不为此开 exhaustive CLI |
| PI | 名义上是；hide 未就绪时 **只敢画 PI** | 有，**同样 3s timeout → 空 commit** | 有 | 磁盘是 `~/.pi/agent/sessions/<encoded-cwd>/`，与 Grok 同族 | 同 Grok 的路径键风险；**比 Grok 少蒸发**，因为 first-paint 还有 `listPiSessions` 探针，hide 降级也只保 PI |
| **DSH** | **能写入，list 白名单查不到** | 有 | 有（与 PI 同类 async cursor） | 0.9 新家人，写了等于没写给侧栏 | 前端用 first-paint 探针补洞。这是读层破口 |
| Catalog 宇宙 | 管理页 / force | — | — | 不是侧栏日常 | 动到切项目热路径 = 0.8 卡死复现 |
| sidebarSnapshot | 冷启第一帧贴纸 | — | — | 先贴上次样子 | 不是数据源，是缓存皮 |

`INDEX_LIST_ENGINES` 当前原文：`claude, codex, gemini, grok, kimi, opencode, pi`。

**没有 `dsh`，没有 `shared`。**

0.9.1 first-paint 实际顺序（这才是读层漏口长什么样）：

```text
1. 问 SQLite（2.5s；超时再暖读 800ms）
2. hide 可用 → 立刻画出 Index 行
   hide 不可用 → 只画 PI（特例）
3. 再等 titles + listSharedSessions     ← Shared 不是后台
4. Index 里没有 DSH / PI 行 → 再扫盘探针  ← 热路径扫盘
```

Gemini / Grok / Kimi / OpenCode 默认磁盘 list 已关（`includeEngineDiskLists` 默认 false）。漏的是 Shared 必拉、DSH/PI 条件探针。

---

## 4. 查询分页：有什么、漏什么

| 能力 | 0.8.9 后续线 | 0.9.1 | 是否遗漏 | 大白话 |
|---|---|---|---|---|
| 首页从 Index 取一页 | `max(可见×4, 20)`，默认 20 | 同左 | 否 | 账本先给一页 |
| 「更多」keyset | `session-index::` + `limit+1` 探页 | 同左 | 否 | 用最老一行当书签；翻页关 writer |
| 画面默认露出 | 5 条 unpinned root | 同左 | 产品未对齐 | 拉 20、画 5。store 里睡着 15 条 |
| 未展开时点「更多」 | 继续 IPC 翻账本 | 同左 | **语义漏** | 应先露出已拉的 20，还是继续问 SQLite？没定 |
| catalog cursor 回落 | 仅当现 cursor 已是 `catalog::` | 同左 | 保留口子 | 日常不该再走到这里 |
| Shared 分页 | 无，一次 list | 无 | **漏**（不进账本就会永远漏） | Shared 多了只能全量另拉 |
| DSH 分页 | — | 探针 limit 50，不进 keyset | **漏** | 「更多」翻不到只活在探针里的 DSH |
| 搜索 / 按引擎过滤 | 非本轮合同 | 无侧栏级 Index query API | 未做，不是回退 | 现在只有时间倒序混排 |

---

## 5. Native 优化范围

本轮只优化 **native session**。Shared 维持现状（独立 list + Index 带 hide），不进任务。

目标两句，缺一句就不叫本次重构：

1. 侧栏 native 只读 SQLite；扫盘只在后台按周期 + 游标回写。
2. **进过账本的 native 行不得从侧栏蒸发。**

| 优化点 | 现状 | 要变成 | 不做什么 |
|---|---|---|---|
| **N0 投影不蒸发** | Windows Grok 已入账却经常从侧栏消失；PI 同族、被探针/hide 特例挡住一部分 | 同一 workspace 的路径变体必须命中同一把钥匙；写超时不得空提交冒充「这个引擎没行」；hide 未就绪不得抹掉已画出的 native | 不靠 first-paint 再扫 Grok/PI 盘来「救」列表 |
| **N1 写→读闭合** | DSH 能 sync/backfill，但不在 `INDEX_LIST_ENGINES` | DSH 与 PI/Gemini 同一套：写入即可被 list / keyset 翻到 | 不改 Shared 白名单 |
| **N2 热路径零扫盘** | first-paint 在 Index 无行时仍探针 DSH/PI | first-paint / 切项目 / focus-refresh 零 `listDshSessions` / `listPiSessions` / 各引擎 disk list | 不删会话管理页的 catalog |
| **N3 死路径收口** | `includeEngineDiskLists` 默认关，代码还在；`*FullCatalog*` 名是假的 | 侧栏不再接受 disk-list 开关；改名为 Index soft re-sync | 不把 catalog 搬回切项目 |
| **N4 分页语义** | 拉 20 画 5；DSH 探针不进 keyset | 露出 N = 首页拉取 N；「更多」先消耗已拉页，再 keyset；DSH 走同一 cursor | 不做搜索 / 按引擎过滤 |
| **N5 引擎表防再漏** | 新引擎只加 writer 就会再出现 DSH 这种洞 | CI：sync + backfill（或显式 skip）+ `INDEX_LIST_ENGINES` + 前端投影 + **路径键 / 超时提交契约**必须齐 | OpenCode 历史 cursor 保持「刻意无」 |
| **N6 编排可拆** | `listThreadsForWorkspace` 再次内联进大 hook | 抽出 native list 编排，行为单测不减 | 不借机重构 Shared merge |

不做什么：不选 Shared A；不复活 rail；不用 timeout 冒充列表 ready；**不把「Grok 消失」当成引擎特例补丁——它是 N0 的现场。**

---

## 6. 任务拆分（只做 native）

### P0 — 进账本的行必须还能被读到（先做，对应用户现场）

| ID | 优化点 | 任务 | 验收 |
|---|---|---|---|
| P0-0 | N0 | 读层 workspace 钥匙稳定：`normalize_path_key` 收 `\\?\` / 盘符大小写；list SQL 不得只在「整页为空」才走 `paths_equivalent` | 同一 Windows 项目用 `C:\` / `c:\` / `\\?\C:\` 打开，已入账的 Grok/PI 行都在侧栏 |
| P0-1 | N0 | 写超时 / 扫空不得空 commit：Grok/PI/Gemini/DSH 的 3s timeout 只标 `partial`，**不**用空数组覆盖「这个 workspace 刚扫过」的语义；已有行保留 | 人为让 `list_grok_sessions` 超时，侧栏已有 Grok 行不消失 |
| P0-2 | N0 | hide 未就绪不得抹 native：去掉「只画 PI」；hide 超时用 last-good / 全显，等投影回来再滤 | hide store 200ms busy 时 Claude/Grok 不闪没 |
| P0-3 | N1 | DSH 加入 `INDEX_LIST_ENGINES` | 冷启 / 「更多」能翻到只存在于 Index 的 DSH 行 |
| P0-4 | N2 | 删除 first-paint DSH/PI 磁盘探针 | `startupHydrationMode=first-paint` 下零 `listDshSessions` / `listPiSessions`。**必须排在 P0-0/P0-1 之后**，否则 PI 会立刻变成第二个 Grok |

顺序：`P0-0 → P0-1 → P0-2 → P0-3 → P0-4`。

删探针是收口，不是救命。先把钥匙和超时写契约修好，再拆 PI 的磁盘拐杖。

### P1 — 封 native 读层

| ID | 优化点 | 任务 | 验收 |
|---|---|---|---|
| P1-1 | N0/N2/N3 | 立 OpenSpec：侧栏 **native** 读源 = Session Index only；**已入账行不得蒸发** | catalog 仅管理页 / 显式 force；Shared 写明「本 change 不改」；Grok/PI Windows 路径变体写进验收 |
| P1-2 | N2 | 切项目 / focus-refresh / 日常 refresh 强制 first-paint（只读 Index） | 不再因 focus 触发 catalog 或 disk list |
| P1-3 | N3 | 删除或硬关 `includeEngineDiskLists` 侧栏入口 | Gemini/Grok/Kimi/OpenCode 侧栏路径不再扫盘；管理页除外 |
| P1-4 | N3 | `schedulePostFirstPaintFullCatalog` 改名为 Index soft re-sync | 行为不变；hydration 单测绿；代码搜索不再暗示日常满仓 |

### P2 — 分页与产品数字

| ID | 优化点 | 任务 | 验收 |
|---|---|---|---|
| P2-1 | N4 | 定「露出 N」=「首页拉取 N」 | 未展开点「更多」：先画完已拉页，不够再 keyset。避免「其实在 store 里，看起来像消失」 |
| P2-2 | N4 | DSH 走同一 `session-index::` keyset | 探针 50 条这条路不存在；「更多」能翻到更老的 DSH |
| P2-3 | N5 | OpenCode「无历史 cursor」写进 spec | 不为此加 exhaustive CLI |

### P3 — 防再犯（可与 P1 并行）

| ID | 优化点 | 任务 | 验收 |
|---|---|---|---|
| P3-1 | N5 | 引擎表 CI 哨兵 | 新引擎必须同时出现在 sync、backfill（或显式 skip）、`INDEX_LIST_ENGINES`、前端投影；encoded-cwd 引擎必须带路径变体单测 |
| P3-2 | N6 | 抽出 native `listThreadsForWorkspace` | 与 0.8.9 后续线文件边界对齐；行为单测不减 |

建议开工：先 P0-0 / P0-1 / P0-2（蒸发），再 P0-3 / P0-4（白名单 + 拆探针）。P1-1 可并行写 spec。P2 等 P0 合上再动数字。

---

## 7. 为什么主要是 Grok，PI 次之，其他 native 几乎没有

不是 Grok 引擎「特别容易坏」。是 **2 层投影钥匙 + 写超时契约** 只打中一类磁盘布局。

### 7.1 引擎怎么落盘（决定会不会踩路径键）

| 引擎 | 磁盘身份 | 写层 3s timeout | first-paint 磁盘救援 | hide 未就绪还画吗 |
|---|---|---|---|---|
| Claude | `~/.claude/projects/<hash>/`，项目哈希稳 | 否（同步 writer） | 否 | 否 |
| Codex | 日分区 + `sessions.jsonl` | 否 | 否 | 否 |
| Kimi | index 文件 offset | 否 | 否 | 否 |
| Gemini | `~/.gemini` home fingerprint | 是 | 否（disk list 已关） | 否 |
| **Grok** | `~/.grok/sessions/<url-encoded-cwd>/<id>/` | **是 → 空 commit** | **否** | **否** |
| **PI** | `~/.pi/agent/sessions/<encoded-cwd>/` | **是 → 空 commit** | **有** `listPiSessions` | **只画 PI** |
| OpenCode | CLI 现拉，无历史 cursor | 是（软失败） | 否 | 否 |
| DSH | 与 PI 同类 async | 是 | 有探针 | 否 |

Claude / Codex / Kimi 不靠「把 cwd 编进目录名」找历史，Windows 路径写法换了，家目录索引还在。Grok / PI 必须先 urlencode 当前 workspace 字符串，再去对目录名——**路径变体直接变成「扫不到」**。

### 7.2 蒸发链（Grok 现场，PI 同构）

```text
1. 某次 sync 成功：Grok 行写入 workspace_path = 变体 A（例如 C:\Work\app）
2. 下次打开项目：前端拿到变体 B（c:\work\app / \\?\C:\Work\app / 斜杠混用）
3. Claude/Codex 在钥匙 B 下很快写出新行 → 整页不为空
4. Grok 扫 encoded-cwd 变体 > 3s → grok-sync-timeout，commit 空数组
   （旧行没删，但 source 被标成「B 刚扫过、0 行」）
5. list SQL：workspace_path = B OR cwd = B，精确匹配
   paths_equivalent 只在「整页为空」才启用 → 被步骤 3 短路
6. A 上的 Grok 行还在 sqlite，侧栏看不见
7. Grok 没有 first-paint 磁盘探针 → 无人救援
```

PI 走同一条链，但步骤 7 被两根拐杖挡住：Index 里没有 PI 行时会 `listPiSessions`；hide 未就绪时还专门保 PI。所以「好像只有 Grok 会丢」。**拆探针（原 P0-2）而不先修钥匙，PI 会立刻变成第二个 Grok。**

Gemini 也有 3s timeout，但不是 encoded-cwd 家目录，Windows 上超时概率低一个数量级；真超时也会踩空 commit，所以 P0-1 必须覆盖所有 async writer，不是只给 Grok 打补丁。

拉 20 画 5 会让更老的 Grok「看起来像没了」，那是 N4，不是这条主因。主因是钥匙 + 超时。

### 7.3 和「只读 SQLite」的关系

上一版把优化收成「DSH 进白名单 + 删探针」，等于只补了「写了查不到的新引擎」，没补「写过但钥匙对不上的老引擎」。

2 层成立的条件是：

| 条件 | 上一版 | 这一版必须有 |
|---|---|---|
| 侧栏不扫盘 | 有（N2） | 有 |
| 每个引擎都能写入 | 有（N1 DSH） | 有 |
| 写入用的路径键 = 读出用的路径键 | **无** | **N0 / P0-0** |
| 写失败 ≠ 这个 workspace 没有该引擎 | **无** | **N0 / P0-1** |
| hide / 露出条数不得假装行不存在 | 弱（只当分页） | **N0 / P0-2 + N4** |

所以：本次重构若不收 N0，Windows Grok 消失不会好；若只收 N1–N3，还可能在拆 PI 探针后让 PI 一起蒸发。

---

## 8. 事实源

| 点 | 路径 |
|---|---|
| 0.8.9 层定义 | `openspec/changes/rewrite-sidebar-session-index/design.md` |
| 后台周期 + 双核心 | `src-tauri/src/session_index/importer.rs`（45s / 90s；`sync` + `backfill`） |
| 历史 cursor | `session_index_backfill`；Claude/Codex/Kimi + Gemini/Grok/PI/DSH async |
| 查询 keyset | `list_session_index_for_workspace` + `useThreadActionsLoadOlder.ts` |
| list 白名单 | `store.rs` `INDEX_LIST_ENGINES` |
| 路径键 / 整页为空才 fallback | `store.rs` `normalize_path_key` / `paths_equivalent` / `list_for_workspace_path` |
| 3s 超时空 commit | `commands.rs` `ASYNC_ENGINE_LIST_TIMEOUT` + `commit_engine_rows` |
| Grok 落盘 | `engine/grok_history.rs`：`sessions/<url-encoded-cwd>/` |
| PI 落盘 | `engine/pi_history.rs`：`sessions/<encoded-cwd>/` |
| 侧栏编排漏口 | `useThreadActions.ts`：Shared 必拉；first-paint DSH/PI 探针；hide 未就绪只画 PI |
| 对照提交 | 0.8.9 `71b42b1b7` / 当前 `687cfd0c3` |
