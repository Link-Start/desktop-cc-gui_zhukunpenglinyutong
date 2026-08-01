## Context

`FileViewPanel` 当前持有两条异步 side channel：`useFileGitBlame` 只在用户点击 toolbar toggle 后请求；Git changed-line markers 则在检测到 `gitStatusFiles` 后立即请求 `getGitFileFullDiff`。marker request 把 `workspaceId + path + documentSnapshot.snapshotVersion` 作为 stale guard，但 effect 并不依赖 snapshot version。initial document read 若先完成，diff result 会被丢弃且不重试，形成时序相关 UI。

本变更把 markers 纳入已经存在的 Git Blame inspection intent。文件内容仍是 foreground；Blame gutter 与 markers 都是点击后启动的 optional side channel。

## Goals / Non-Goals

**Goals:**

- ordinary file open 不启动 full-diff request。
- Git Blame 启用时才加载 workspace Git-derived markers，关闭时立即隐藏。
- Blame 与 diff 独立并发、独立容错。
- file/snapshot switch 后不提交 stale marker result。
- 保留 existing CodeMirror marker extension、parser、service 与 multi-repository path mapping。

**Non-Goals:**

- 不把 `Git Blame` response 扩展成 diff payload。
- 不引入新的 UI toggle、persistent preference 或 backend command。
- 不改变 diff panel、file history、editable diff review surface。
- 不改变上游显式 `highlightMarkers` 的展示优先级。

## Decisions

### Decision 1: Git Blame toggle owns marker visibility intent

`FileViewPanel` 的 marker effect 仅在 `gitBlame.enabled`、workspace text file、非 deleted status、initial read settled 时运行。disable 时清空 markers。

Alternative：继续 eager load，仅修复 race。拒绝，因为它保留每次 file open 的 Git/IPC 开销，与用户确认的 lazy behavior 冲突。

### Decision 2: Blame 与 full diff 在点击后独立并发

`useFileGitBlame` 继续管理 Blame；marker effect 独立调用 existing `getGitFileFullDiff`。两者没有 data dependency，不串行等待。Blame failure 不清 marker，diff failure 不清 Blame。

Alternative：等待 Blame 成功后再请求 diff。拒绝，因为新增/未跟踪文件可能无法 Blame，却仍有 full diff；串行也增加 marker latency。

### Decision 3: 保留 snapshot guard，但让 effect 对 settled snapshot 有完整依赖

marker request 在 initial `isLoading` 结束后启动，并把 `currentFileRenderToken` 纳入 effect identity。token 变化时 cleanup 旧 request 并为当前 snapshot 重跑，避免“guard 变化但 effect 不重跑”的半套状态机。

用户产生 dirty editor snapshot 时不重复请求 diff；existing CodeMirror decorations 随 transaction 映射，Blame 保持 stale 语义。clean external snapshot replacement 才触发 guarded refresh。

Alternative：删除 snapshot guard，仅依赖 path cleanup。拒绝，因为同一文件发生 clean external snapshot replacement 时，旧 diff 仍可能落入新内容。

### Decision 4: 不从 Blame hunks 推导 marker kind

Blame 的 zero OID 只能表达 `Uncommitted` range，无法可靠区分 `added` 与 `modified`；新增文件也可能 Blame 失败。继续使用 `parseLineMarkersFromDiff` 保持现有颜色语义。

## Data Flow

1. ordinary open：`readWorkspaceFile` → document snapshot → first useful viewport；markers 保持 empty。
2. user toggles Git Blame：`gitBlame.enabled = true`。
3. `useFileGitBlame` 请求 blame；marker effect 同时请求 canonical full diff。
4. 每条请求仅提交属于当前 file/snapshot identity 的结果。
5. toggle off / tab switch / unmount：effect cleanup；markers reset，Blame hook 关闭或切换 scope。

## Risks / Trade-offs

- [用户不点 Git Blame 时不再看到 changed-line background] → 这是已确认的新 product contract；Git changed-file list 与 Diff panel 仍提供默认变更可见性。
- [snapshotVersion 变化会再次请求 diff] → 仅在 Git Blame enabled 时发生；用现有 status/path gate 限定范围，不增加 ordinary open 成本。
- [Blame 与 diff 同时执行仍有瞬时 Git work] → 两者由明确 user intent 触发且独立并发，优先降低交互等待；不将其中一个重复塞入另一个 payload。
- [diff request 失败时 markers 为空] → fail safe，不影响 editor/Blame；existing surface 没有 marker error UI，本变更不扩大 UI。

## Migration Plan

1. 更新 focused tests 锁定 lazy contract。
2. 调整 `FileViewPanel` marker effect gate/dependencies。
3. 运行 target Vitest、typecheck、lint 与 strict OpenSpec validation。

Rollback：恢复 eager effect gate 并回退 delta spec；无持久化数据或 API migration。

## Open Questions

无。用户已确认 marker visibility 与 Git Blame toggle 绑定；请求在点击后允许独立并发。
