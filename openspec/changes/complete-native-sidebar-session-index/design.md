# Design: complete-native-sidebar-session-index

## Context

前序 `rewrite-sidebar-session-index` 定了 2 层：

```text
磁盘 / CLI 家目录  --后台周期 + 游标-->  session_index.sqlite  --侧栏唯一读取-->  左侧列表
```

0.9.1 骨架还在，但投影没闭环。现场证据见 `docs/analysis/sidebar-session-list-fetch-0.8.9-vs-current-2026-08-18.md` §7。

当前断裂点：

| 点 | 代码事实 | 用户看到 |
|---|---|---|
| 读钥匙是精确字符串 | `list_slice_for_workspace_engine`：`workspace_path = ?1 OR cwd = ?1` | Windows `C:\` / `c:\` / `\\?\C:\` 写成三把钥匙 |
| `paths_equivalent` 只在整页为空启用 | `list_for_workspace_path` | Claude 在新钥匙下有行 → Grok 旧行蒸发 |
| `normalize_path_key` 只折斜杠 | `store.rs` | 不收 `\\?\`、不折盘符大小写 |
| async writer 3s timeout → 空数组 `commit_engine_rows` | `commands.rs` + `writers.rs` | 超时被记成「这个 workspace 刚扫过、0 行」 |
| hide 未就绪只画 PI | `useThreadActions.ts` | Claude/Grok 闪没 |
| DSH 不在 `INDEX_LIST_ENGINES` | `store.rs` | 写了等于没写给侧栏 |
| first-paint 仍探针 DSH/PI | `useThreadActions.ts` | 热路径扫盘；PI 靠这根拐杖少蒸发 |
| 拉 20 画 5 | `useThreadActions.threadList.ts` | 更老的 Grok「看起来像没了」 |

Grok / PI 中招是因为磁盘身份是 `sessions/<url-encoded-cwd>/`。Claude / Codex / Kimi 用项目 hash / 日分区 / index 文件，不靠 cwd 字符串。

## Goals / Non-Goals

**Goals:**

1. 同一 workspace 的路径变体命中同一把 list 钥匙。
2. 写超时 / 扫失败不得把「没扫到」写成「这个引擎没行」。
3. hide 未就绪不得抹已入账 native。
4. 每个会写入 Index 的 native 引擎都能被 list / keyset 翻到（含 DSH）。
5. 侧栏热路径零磁盘 list。
6. 露出条数 = 首页拉取条数；「更多」先消耗已拉页。

**Non-Goals:**

- Shared 折进 Index。
- 侧栏搜索 / 按引擎过滤。
- OpenCode 历史 cursor。
- fs watch。
- 改 transcript loader / Session 管理 catalog 权威。

## Decisions

### D1. 路径钥匙：写读同一把 canonical key，list 始终等价合并

**选定**：加强 `normalize_path_key`，写、读都走它；list **即使整页非空** 也把 `paths_equivalent` 行并进来。

`normalize_path_key` 必做：

1. trim
2. 去掉 Windows long-path 前缀 `\\?\` / `//?/`
3. `\` → `/`
4. 去掉尾斜杠（根盘符除外）
5. Windows 风格路径（含盘符或 UNC）做 ASCII case-fold

**不** resolve junction / subst / `GetFinalPathNameByHandle`。那会把两个真实不同的盘符合并，越权。

list 算法：

1. 用 canonical key 做现有 per-engine exact SQL（快路径）
2. **无论 1 是否为空**，再对近期窗做 `paths_equivalent` 过滤，按 `(engine, session_id)` 去重并入
3. 不在 list 路径改写 sqlite 行（避免读带写）。旧变体行靠下一次成功 sync 用 canonical key upsert 自然收敛

**否决**：

- 只加长 Grok timeout：不修钥匙，Claude 新钥匙仍短路 fallback。
- 只在 writer 端扩 encoded-cwd 变体：读层仍精确匹配，A/B 两把钥匙问题还在。

### D2. 超时空提交：partial 不得冒充成功扫空

**选定**：Gemini / Grok / PI / DSH（及未来同类 async writer）在 timeout 或 list error 时：

- **不** `upsert_rows([])`
- **不** `mark_source_synced(..., row_count=0)` 以致 `engine_source_is_fresh == true`
- 返回 `partial_source`（现有 `grok-sync-timeout` 等）
- 已有 `session_index` 行保持不动

`engine_source_is_fresh` 在上次 commit 为 partial 时 MUST 返回 false，让后台下一拍再试。

真·空（list 成功且 0 行）仍可标记 synced，避免对无 Grok 项目每 90s 空转。

**否决**：超时后删该 workspace 该引擎的行。那是主动蒸发。

### D3. hide 未就绪：last-good / 全显，禁止 PI-only

**选定**：hide projection 在 busy timeout 内不可用时：

1. 优先用上次成功的 hide set（last-good）
2. 没有 last-good 则全显 Index native
3. **删除**「只画 PI」分支

Shared hide 语义不变：Shared 行仍靠独立 `listSharedSessions` + visibility，本 change 不改 Shared 数据源。

**否决**：hide 超时就空列表。比闪没更糟。

### D4. DSH 进 `INDEX_LIST_ENGINES`

**选定**：白名单改为 `claude, codex, gemini, grok, kimi, opencode, pi, dsh`。DSH 走同一 per-engine budget 与 `session-index::` keyset。

必须排在拆 first-paint DSH 探针之前，否则无 DSH 行的项目删探针后永远看不到 DSH。

### D5. 热路径零扫盘，且必须排在 D1–D4 之后

**选定**：

- 删除 first-paint `listDshSessions` / `listPiSessions` 探针
- `includeEngineDiskLists` 侧栏入口硬关或删除
- `schedulePostFirstPaintFullCatalog` 改名为 Index soft re-sync（行为保持：`syncIfNeeded` + 可选 `forceSync`，**不**跑 `list_workspace_sessions`）
- 切项目 / focus-refresh / 日常 refresh 强制 first-paint（只读 Index）

**顺序硬约束**：D1 + D2 未落地前不得删 PI 探针。否则 PI 立刻复制 Grok 蒸发链。

### D6. 分页：露出 N = 拉取 N，可见上限按页递增

**选定**：默认 `visibleThreadRootCount` 与 `SESSION_INDEX_PAGE_SIZE` 对齐（当前 12）。侧栏只保留一个「更多 / 收起」入口：

1. first-paint 露出 12、拉取 12
2. 点「更多」把可见上限提高到 `page * pageSize`（12 → 24 → 36 → 48…）
3. 若 store 里未露出的已拉 root > 0 → 只提高露出上限，不发 IPC
4. 已拉页耗尽 → 再发一次固定 page size（12）的 `session-index::` keyset
5. 「收起」把 page 重置为 1（回到 12）
6. 删除独立「加载更早的」link；folder 内层列表不画分页 chrome

DSH 不再走探针 limit 50。

**否决**：保持画 5 拉 20。产品上就是「列表丢了 15 条」。也否决点「更多」把内存里全部 root dump 出来。DOM 成本用现有列表虚拟化/折叠承担，不在本 change 新做虚拟列表。

### D7. 引擎表 CI 哨兵

**选定**：可执行检查（Rust test 或 repo script，接入现有 CI）断言每个 native writer 引擎同时出现在：

1. sync 调度
2. backfill 调度，或显式 `SKIP_BACKFILL` 名单（仅 OpenCode）
3. `INDEX_LIST_ENGINES`
4. 若该引擎走 async list，则遵守 D2 超时契约

encoded-cwd 引擎（Grok / PI）必须带 Windows 路径变体单测。

### D8. 抽出 native list 编排

**选定**：从 `useThreadActions.ts` 抽出 native `listThreadsForWorkspace`（对齐 0.8.9 后续线文件边界）。行为单测不减。不借机重构 Shared merge。

排在 P3，不挡 P0。

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| case-fold 把两个真实不同路径合成一把钥匙 | 只 fold Windows 风格路径；不 resolve junction / subst |
| 等价合并扫近期窗变慢 | 窗保持现有 `limit*20`（min 100）；per-engine budget 不变 |
| 超时不标 fresh → 后台更勤扫 Grok | 扫盘仍在 90s importer，不上热路径；可接受 |
| 露出 12/24/36 条增加侧栏 DOM | 不新做虚拟列表；若 Win 低端机回退，另 change |
| 拆探针后 Index 空窗期看不到全新 PI | 后台 45s 首拍会补；禁止用热路径扫盘换首屏完整 |
| list 读路径误写 sqlite | D1 明确禁止读带写 |

## Migration Plan

1. 先落地 D1 + D2 + D3（止蒸发），无需 schema migration。
2. 再 D4（DSH 白名单），再 D5（拆探针 / 改名 / 硬关 disk list）。
3. D6 分页数字、D7 CI、D8 抽文件。
4. 回滚：各刀可独立 revert。D1 的 `normalize_path_key` 加强是纯函数，回滚后旧行仍可读（只是又会蒸发）。
5. 不改 `session_index` DDL；PRIMARY KEY 仍是 `(engine, session_id)`。

## Open Questions

无。Shared 维持 B、不选 A，已在分析回合拍板。Windows Grok 手测是实现后 verify 项，不是设计未决。
