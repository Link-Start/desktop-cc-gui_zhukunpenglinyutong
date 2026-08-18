# Design: restore-sidebar-background-scan-sqlite

## Context

2 层侧栏（0.8.9 定、0.9.1 没换骨架）：

```text
磁盘 / CLI 家目录  --后台周期 + 游标-->  session_index.sqlite  --侧栏唯一读取-->  左侧列表
```

写层已经在：`spawn_session_index_importer` 45s 首拍 / 90s 一拍，每拍 `sync_session_index_core(force=false)` + `backfill_session_index_core`；upserted>0 发 `session-index-imported`；hydration 监听后 `first-paint` + `mergeExistingThreads`。

现场「升级后最近 2h 不见」不是删盘。静态扫描到的断裂：

| 点 | 代码事实 | 用户看到 |
|---|---|---|
| first-paint 只读 Index | `startupHydrationMode=first-paint`，`includeEngineDiskLists` 已关 | 账本落后就先画旧列表 |
| last-good 只在整表空 / 无权威空证明时启用 | `useThreadActions.ts` ~1772–1816 | Index **非空但缺新行** 时，last-good 里更新的行直接丢掉 |
| last-good 空回落会丢掉 snapshot 候选 | `lastGoodSnapshotCandidates = null` | 空 Index + 旧 snapshot 画出来后，不再用这次结果更新记忆 |
| importer 首拍 45s 且 `force=false` | `importer.rs` | 升级后最多空等 45s，还可能被 8s fingerprint skip |
| freshness 只比 source 文件 mtime+len | `SOURCE_FRESH_MAX_AGE_MS=8000` | 目录 mtime 没动、子会话已写时跳过 |
| encoded-cwd 漏扫 | 前序 change 修钥匙，本 change 不重做 | Grok/PI 仍可能写不进当前钥匙 |

用户口径：对话不能丢，后台必须扫盘补 SQLite。前序 change 禁止热路径扫盘，本设计只加强写层与并集投影。

## Goals / Non-Goals

**Goals:**

1. 磁盘上还在的 native 会话，升级 / 冷启 / 杀进程后由后台 writer 写入 SQLite。
2. 升级后第一拍不得被 freshness skip 挡掉。
3. last-good 做 floor：补 Index 缺的更新行；不做 ceiling：不得盖住 Index 里更新的行。
4. importer 事件后当前 workspace 立刻重读账本。
5. 热路径继续只读 Index。

**Non-Goals:**

- 重做路径钥匙 / 超时空提交 / DSH 白名单。
- first-paint 恢复 disk list。
- Shared 进 `session_index`。
- fs watch。
- 模型 picker。

## Decisions

### D1. 升级 / 冷启首拍强制 sync

**选定**：importer 进程生命周期内第一拍对每个 workspace 走 `sync_session_index_core(..., force=true)`。后续 90s 拍保持 `force=false`。

实现：`ImportTickGuard` 旁加 `AtomicBool first_tick`，或 `run_import_tick(force_sync: bool)`。杀进程再开也算新生命周期，会再 force 一次——可接受，writer 本就是 upsert。

**否决**：

- 缩短 45s 到 0 且仍 `force=false`：启动风暴 + 仍可能 skip。
- 每个 90s 都 force：扫盘成本回到接近 catalog。

首拍仍可留短延迟（例如 2–5s）避开启动点击冻结，但不得空转到 45s 才第一次有机会补账。45s 常量留给非 force 的稳态拍，或把 `IMPORT_INITIAL_DELAY` 降到启动安全窗之后的秒级。

### D2. freshness 不得挡住「磁盘比账本新」

**选定**：`source_is_fresh` 在 fingerprint 命中且未超时之外，再加一闸：该 source 对应 workspace+engine 在 `session_index` 的 `max(updated_at)`（或 writer 已知的最新会话 mtime）若明显落后于本次磁盘探测到的最新会话 mtime，MUST 视为不 fresh，继续 sync。

最小实现：fingerprint 仍用根/index 文件；对 Gemini/Grok/PI/DSH 这类「会话是子目录、根 mtime 不涨」的引擎，fresh skip 前 peek 候选最新 mtime。Claude/Codex/Kimi 已有 history / session_index.jsonl fingerprint，保持原逻辑，只在 skip 前核对账本 max。

**否决**：删掉 freshness（每 90s 全量 walk）。

### D3. last-good 是 union floor，不是 replace

**选定** 投影规则：

```text
visible = Index 本页
        ∪ { last-good 行 | 比 Index 本页最新 updatedAt 更新，或 Index 完全没有该 (engine, session_id) }
Index 行若比同 id 的 last-good 新，以 Index 为准
禁止：Index 非空就丢弃全部 last-good
禁止：空 Index 时用更旧 last-good 覆盖后来到达的更新 Index（generation / sequence 已有，保持）
```

空 Index + 无权威空证明：仍可用 last-good 避免闪空，但 `lastGoodSnapshotCandidates` MUST 保留「Index 空」这一事实，不得把旧 snapshot 写成新的权威 last-good。

权威空证明（catalog/sourceStatuses 证明该引擎就是 0 行）时，不得用 last-good 把已确认不存在的行补回。tombstone / 用户删除仍优先。

### D4. imported 事件必须重读，且 merge 按 D3

**选定**：现有 `session-index-imported` 监听保留。补两条：

1. 当前 active workspace 在 payload 里时，`mergeExistingThreads: true` 走 D3，不得 `preserveState` 到「只留旧 snapshot」。
2. `upserted === 0` 但本拍是 force 首拍且诊断为 partial：不要把画面打成权威空。

### D5. 不把 Shared 和热路径扫盘拉进来

Shared 仍独立 list。本 change 零 Shared writer。热路径继续禁止 `listDshSessions` / `listPiSessions` / 各引擎 disk list。

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| 冷启 force 首拍抢 CPU | 延迟 2–5s + 后台线程；不上 first-paint |
| last-good union 把已删会话补回 | tombstone / deleted filter 先于 union；权威空证明不补 |
| 子目录 peek 增加 writer 成本 | 只在 freshness 即将 skip 时 peek 最新 mtime，不 walk 全文 |
| 与 `complete-native-sidebar-session-index` 6.2 手测重叠 | 本 change 不改钥匙；Windows 手测清单分开写 |

## Migration Plan

1. D3 投影（FE）可先落地，立刻减轻「Index 非空丢新行」。
2. D1 force 首拍 + D2 freshness 闸（Rust）。
3. D4 事件重读对齐 D3。
4. 无 DDL。回滚：各刀独立 revert；force 首拍回滚后只是恢复 45s+skip。

## Open Questions

无。Shared 不进 Index、热路径不扫盘已拍板。
