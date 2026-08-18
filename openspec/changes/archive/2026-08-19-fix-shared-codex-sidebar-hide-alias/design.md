## Context

Shared hide 契约：

```text
nativeThreadIds / visibility hide ids
  → expandHiddenSharedBindingIds
  → hiddenSharedBindingIds / hiddenParentKeys
  → strip owner  +  isSharedSidebarHiddenPup
```

`enhance-shared-subagent-parent-id-attach` 已覆盖 `uuid` ↔ `codex:uuid`。缺口是第三种 Codex identity：

| 平台现象 | live / parent id | binding / Index |
|----------|------------------|-----------------|
| **Windows（主现场）** | 文件 stem `rollout-YYYY-MM-DDTHH-MM-SS-{uuid}`（Codex / VS Code 会话文件名） | canonical uuid |
| **macOS** | 常见 uuid；若走 app-server/VS Code 历史也可能是 stem | 同左 |
| **Linux** | 同 macOS；路径为 `/home/…`，无盘符冒号 | 同左 |

Rust `merge_unified_codex_thread_entries` 保留 live stem，并把 child `parentSessionId` remap 成可见 stem。FE hide 只 exact + 见冒号就剥 → Win 必漏；Mac/Linux 在 stem 路径上同构漏。

另一条平台裂缝：`indexOf(":")` / `includes(":")` 把 Windows `S:\…` 当 engine 前缀。POSIX `/Users` `/home` 无冒号，旧逻辑会给路径补 `codex:/Users/…` 噪声键。

## Goals / Non-Goals

**Goals**

- 单一 identity helper：已知 engine 前缀 / Codex rollout stem / 路径形 id。
- hide expand、owner lookup、pup hide、owner strip 共用。
- 测试按 Win / Mac / Linux 分组，平台差异显式、bounded。

**Non-Goals**

- 不发明 rollout 时间戳。
- 不改 Rust aliases 下发。
- 不按标题藏。
- 不修 visibility lock。

## Decisions

### D1 抽 canonical uuid，不枚举 stem

`extractCodexCanonicalSessionId`：

1. 去掉已知 engine 前缀（`claude|codex|kimi|grok|opencode|pi`），**不是**任意 `:`。
2. 若已是 UUID → 小写返回。
3. 若匹配 `rollout-YYYY-MM-DDTHH-MM-SS-{suffix}` 且 suffix 是 UUID → 返回该 uuid。
4. 否则 null（含 `rollout-…-session-alpha` 非 uuid stem）。

`expand` 在抽到 uuid 时写入 `uuid` + `codex:uuid` + 原 id。lookup / pup / strip 对 candidate 做同样抽取后查 set。

备选：把 aliases 打进 Shared list — IPC 面大，本轮不做。

### D2 路径形 id 按平台识别，禁止当 engine

`isSharedHideFilesystemPathId`：

| 平台 | 识别 |
|------|------|
| Windows | `^[A-Za-z]:[\\/]`、`\\` UNC、`\\?\` / `//?/` extended |
| macOS / Linux | 以 `/` 开头且不含 `://` 的绝对路径 |
| 三端 | 命中后 **只保留原字符串**，不剥 `:`，不补 `engine:` |

这是 bounded 平台分支：只服务 hide identity，不扩散到 path join / spawn。

### D3 四条路径共用 helper

| 调用点 | 用法 |
|--------|------|
| `expandHiddenSharedBindingIds` | 每条 native id 并入 identity keys；路径跳过 engine 补全 |
| `lookupSharedOwnerByNativeParent` | 对 parent 的 identity keys 查 map |
| `isSharedSidebarHiddenPup` | parent identity ∩ hiddenParentKeys |
| `threadIdInHiddenSharedBindingSet` | 同上，修 owner stem 漏 strip |

不新增并行 hide 管线。

### D4 测试按平台分组，不写 OS-only fixture 路径

Vitest 用 **id 字符串形态** 模拟三端，不依赖本机 `process.platform`，避免 CI 只跑 Darwin 就假绿。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 非 uuid 的 rollout stem 仍对不上 | 契约：只能抽 uuid；无 uuid 不猜 |
| 两个会话碰巧同一 uuid（不应发生） | 与现 hide 先写先得一致 |
| POSIX 路径不再补 `engine:` | 路径不是 session id；单测锁住 |
| 小写 uuid 与原串大小写并存 | 同时写入原串 + 小写 uuid |

## Migration Plan

- 纯 FE；无存储迁移。
- 回滚：还原 helper 接入，四函数回到 exact / 任意冒号剥除。

## Open Questions

无。
