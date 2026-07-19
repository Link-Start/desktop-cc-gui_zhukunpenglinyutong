# Command Errors

## [ERR-20260715-001] focused_vitest_via_batched_wrapper

**Logged**: 2026-07-15T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary

`npm run test -- --run <file>` cannot run a focused suite because the repository batch wrapper accepts only `--include-heavy`.

### Error

```text
Error: Unknown argument: --run
```

### Context

- Attempted focused verification for `useWorkspaceDropZone.test.ts`.
- `scripts/test-batched.mjs` owns the `npm test` entry and rejects Vitest passthrough arguments.

### Suggested Fix

Use `npx vitest run <test-file>` for focused suites; reserve `npm test` for the repository batch runner.

### Metadata

- Reproducible: yes
- Related Files: scripts/test-batched.mjs, package.json

### Resolution

- **Resolved**: 2026-07-15T00:00:00+08:00
- **Notes**: Switched focused verification to the repository's direct `vitest run` pattern.

---

## [ERR-20260719-001] multi_file_apply_patch_anchor_mismatch

**Logged**: 2026-07-19T16:40:00+08:00
**Priority**: low
**Status**: resolved
**Area**: backend

### Summary

跨 desktop/daemon 相似分支的一次 multi-file patch 因错误假设两处 timeout 代码完全一致而被整体拒绝。

### Error

```text
apply_patch verification failed: Failed to find expected lines in
src-tauri/src/bin/cc_gui_daemon/daemon_state.rs
```

### Context

- 同时修改 Kimi async/sync send identity contract。
- Desktop 使用 `Duration::from_secs`，daemon sync 使用 `std::time::Duration::from_secs`。

### Suggested Fix

修改影子实现前先读取每个目标分支的精确上下文，并将跨文件 patch 拆成独立小块。

### Metadata

- Reproducible: yes
- Related Files: src-tauri/src/engine/commands.rs, src-tauri/src/bin/cc_gui_daemon/daemon_state.rs

### Resolution

- **Resolved**: 2026-07-19T16:41:00+08:00
- **Notes**: 重新读取 daemon sync 分支并拆分 patch。

---
