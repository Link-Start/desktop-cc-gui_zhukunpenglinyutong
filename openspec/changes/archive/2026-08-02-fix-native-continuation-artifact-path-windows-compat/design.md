## Context

`prepare()` 在 source history 读取成功后依次调用：

```text
write_typed_artifact(root, workspace_id, &source.session_id, ...)
write_artifact(root, workspace_id, &source.session_id, ...)
```

`source.session_id` 对 Claude/Kimi 是 `engine:<nativeSessionId>`（由
`validate_provider_continuation_shape` 强制）。`artifact_store::artifact_dir`
将其直接 join 进目录：

```text
{app_data}/shared-context-artifacts/{workspace_hash}/{claude:<uuid>}/
```

Windows `CreateDirectoryW` 对含 `:` 的目录名返回 `ERROR_DIRECTORY (267)`
（中文文案「目录名称无效」），Rust std 透传为 `os error 267`；macOS 允许 `:`
作为路径段，因此平台行为分叉。`safe_segment` 只拦截 `/` 与 `\`，未覆盖
Windows 保留字符集；保留设备名（`CON` 等）同样返回 267。

## Goals / Non-Goals

**Goals:**

- 任何 `session_id`（含 `engine:` 前缀、任意合法 logical id）都不能直接进入
  filesystem path segment。
- 修复后 Windows prepare 可写 artifact；macOS 既有功能与旧布局 artifact 读取不变。
- 路径 key 确定性、可复现（同 session 幂等），避免重复写产生新目录。
- 改动收敛在 `artifact_store.rs` 一个文件，无 IPC / DTO / frontend 变化。

**Non-Goals:**

- 不做旧布局迁移（避免启动期 rename 与崩溃恢复风险）。
- 不改变 artifact JSON record 的字段与 checksum 语义。
- 不改 `scan_orphan_artifacts` 的判定依据（按 record 内容引用，与路径无关）。

## Decisions

### 1. 路径 key：`sha256(session_id)` 前 16 个 hex 字符

```rust
fn session_path_key(session_id: &str) -> String {
    Sha256::digest(session_id.as_bytes())
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect()
}
```

- 与 `workspace_hash`（同一文件内已有）同源同风格，只截短为 8 bytes。
- 16 hex 字符碰撞概率对单 workspace 的 artifact 规模可忽略；若未来需要可升级为
  更长前缀而不破坏布局兼容（路径 key 只影响新写入）。
- `artifact_dir` 不再对 `session_id` 调用 `safe_segment`（key 是 hex，天然安全）。

### 2. 读取 legacy fallback

`read_artifact` / `read_typed_artifact` 的路径解析：

```text
candidate = {root}/shared-context-artifacts/{workspace_hash}/{session_path_key}/
if candidate artifact file 不存在:
    legacy    = {root}/shared-context-artifacts/{workspace_hash}/{session_id}/
    if legacy artifact file 存在:
        使用 legacy 路径
```

- 仅读取时 fallback；写入始终只写新 key，保证新平台不再产生非法目录。
- legacy 路径构造绕过加固后的 `safe_segment`（否则 mac 旧目录名中的 `:` 会被
  拒绝，导致旧 artifact 不可读）。
- 写入 dedupe 分支（`destination.exists()`）使用新 key；旧 key 下已存在的同内容
  artifact 不会命中 dedupe，而是幂等重写一份到新 key（checksum 一致，无副作用）。
- `quarantine_invalid_artifact` 与 `scan_orphan_artifacts` 均按既有逻辑工作：
  孤儿判定基于 record 内容（`session_id` + `package_id` 与 delivery events 匹配），
  与路径布局无关，旧布局被引用 artifact 不会被误删。

### 3. `safe_segment` 加固

继续应用于仍作为裸 path segment 的字段（`artifact_id`），拒绝：

```text
空 / "." / ".."
保留字符: \ / < > : " | ? *
控制字符
尾随 '.' 或 ' '（Windows 会静默 trim，造成路径歧义）
Windows 保留设备名: CON PRN AUX NUL COM1-9 LPT1-9（含 ".ext" 变体，大小写不敏感）
```

`artifact_id` 是 sha256 hex，不受影响；该加固是防御性护栏，防止未来字段复用同一
路径构造时再次踩 Windows 坑。

## Risks / Mitigations

| 风险 | 缓解 |
|---|---|
| mac 旧布局 artifact 读不到 | read fallback 到 legacy 路径，仅读不写 |
| 旧 artifact 被孤儿扫描误删 | 孤儿判定按 record 引用，与路径无关；被引用则保留 |
| 重复写产生两份 artifact | content-addressed + checksum 一致，scan 按引用去重，无功能影响 |
| 加固后 `:` 拒绝导致 mac 写入失败 | `artifact_dir` 不再对 `session_id` 调 `safe_segment`；legacy 路径构造绕过加固 |
| key 碰撞（理论） | 8 bytes 对单 workspace 规模足够；升级路径为加长前缀 |

## Verification

- Rust unit tests（`artifact_store` 模块内）：
  1. `claude:<uuid>` / `kimi:<uuid>` round-trip，断言目录名不含 `:`。
  2. legacy 布局手工构造后 read 成功。
  3. `safe_segment` 加固矩阵（非法字符、控制字符、保留名、尾随点空格）。
  4. 现有 tamper / 并发 / orphan 测试保持通过。
- `cargo test -p cc-gui shared_context`。
- `openspec validate fix-native-continuation-artifact-path-windows-compat --strict --no-interactive`。
