# Data Storage Guidelines（文件存储与一致性）

> 当前项目核心是 file-based persistence，不是传统 SQL-first 架构。

## 现有模式（必须复用）

- 原子写：`write_string_atomically(...)`
- 文件锁：`acquire_storage_lock(...)` / `with_storage_lock(...)`
- stale lock 处理：按超时策略清理
- JSON 序列化：`serde_json`（必要时 `rename_all = "camelCase"`）

## Scenario: 持久化 workspace / settings / client store / project memory

### 1. Scope / Trigger

- Trigger：修改 `storage.rs`、`client_storage.rs`、`project_memory.rs`、任何 file-based persistence。
- 目标：避免并发写覆盖、半写入、锁泄漏、旧数据不兼容。

### 2. Signatures

- lock acquisition：`acquire_storage_lock(...)` / `with_storage_lock(...)`
- atomic write：`write_string_atomically(...)`
- 调用方 contract：先准备完整 payload，再进入 lock + write path

### 3. Contracts

- 关键 JSON 文件写入必须遵循 `lock -> serialize -> temp write -> rename`
- 多线程/多进程都可能竞争同一路径，不能假设单写者
- serialization 字段名与 frontend mapping 保持兼容；变更字段时优先 backward compatibility

### 4. Validation & Error Matrix

| 场景 | 正确处理 | 禁止处理 |
|---|---|---|
| 并发写 | 加 lock 后写入 | 无锁直接覆盖 |
| stale lock | 清理过期 lock 后继续 | 永久阻塞 |
| Windows rename | 先移除旧文件再 rename（按现有实现） | 直接假设 Unix 行为 |
| JSON 损坏 | 返回 parse error / fallback default | 写入空对象掩盖问题 |

### 5. Good / Base / Bad Cases

- Good：复用 `with_storage_lock` + `write_string_atomically`
- Base：不存在的 settings 文件返回 default
- Bad：`std::fs::write(path, payload)` 直接覆盖关键状态文件

### 6. Tests Required

- 并发写入不会生成损坏文件
- stale lock 被正确清理
- Windows / rename 兼容逻辑至少有行为说明或测试覆盖
- 旧版 JSON 结构读取后仍能 fallback

### 7. Wrong vs Correct

#### Wrong

```rust
let data = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
std::fs::write(path, data).map_err(|e| e.to_string())?;
```

#### Correct

```rust
with_storage_lock(path, || {
    let data = serde_json::to_string_pretty(&settings)
        .map_err(|error| format!("failed to serialize settings: {error}"))?;
    write_string_atomically(path, &data)
})?;
```

## 写入规则

- 先写 temp file，再 rename 覆盖（atomic replace）。
- 任何可并发写入路径必须加锁。
- 不允许直接 `std::fs::write` 覆盖关键状态文件。

## 一致性规则

- 读写 key/字段命名与 frontend mapping 保持一致。
- 数据迁移必须兼容旧结构（backward compatibility）。
- 默认值逻辑要集中，避免多处分叉 fallback。

## Scenario: Versioned settings defaults migration

### 1. Scope / Trigger

- Trigger：新增一个默认开启的 persisted setting，但旧版 `settings.json` 已经显式写入旧字段值，单纯修改 serde default 无法覆盖 existing install。
- 目标：默认值只迁移一次，同时保留 migration 后的用户 opt-out。

### 2. Signatures

- persisted marker：`AppSettings.<domain>_defaults_version`
- startup upgrader：`AppSettings::upgrade_<domain>_defaults_for_startup(&mut self)`
- read owner：`storage::read_settings(path: &PathBuf) -> Result<AppSettings, String>`
- frontend mirror：`AppSettings.<domain>DefaultsVersion`

### 3. Contracts

- fresh `AppSettings::default()` MUST 使用 current marker version 与 current defaults。
- legacy JSON 缺 marker 时 MUST deserialize 为 `0`，由 `read_settings()` 调用 startup upgrader；禁止让 serde default 直接返回 current version，否则无法识别 legacy data。
- upgrader MUST 是 idempotent；marker 已达到 current version 时不得改写用户值。
- `undefined`/missing legacy field、legacy explicit value 与 explicit empty collection MUST 分别定义迁移语义。
- migration 只更新 startup memory snapshot；下次正常 settings write 原子持久化 marker。若用户在 migration 后 opt out，该 write MUST 同时保留 current marker，后续启动不得重新开启。
- Rust serde field、TypeScript `AppSettings` field、frontend default snapshot 与 OpenSpec behavior contract MUST 同步。

### 4. Validation & Error Matrix

| Persisted state | Startup result | Later restart |
|---|---|---|
| file missing | current defaults + current marker | 保持 current defaults |
| legacy non-empty value + marker missing | 执行一次 additive migration + marker current | 用户未修改时可重复 idempotent migration |
| legacy explicit empty collection + marker missing | 保持 empty + marker current | 不静默加入 defaults |
| current marker + user opt-out | 保持 opt-out | 禁止重新开启 |
| malformed JSON | 返回 parse error | 禁止覆盖原文件 |

### 5. Good / Base / Bad Cases

- Good：`curatedSkillDefaultsVersion=1`；旧 `["lazy-senior-dev"]` 补入 `caveman`，旧 `[]` 保持空，用户之后关闭 Caveman 并保存后仍保持关闭。
- Base：新安装直接从 `AppSettings::default()` 得到完整 defaults，不执行 legacy branch。
- Bad：只修改 `#[serde(default = "default_enabled_...")]`；旧 JSON 已有字段，所以新增 default 永远不会应用。
- Bad：每次启动发现某 id 缺失就补回；用户无法永久关闭该默认项。

### 6. Tests Required

- Rust storage test MUST 覆盖：legacy non-empty migration、legacy explicit empty、migration 后 opt-out write + reread。
- frontend test MUST 覆盖 missing payload fallback 与 explicit empty collection 的差异。
- typecheck MUST 证明 Rust camelCase payload 对应的 TypeScript marker field 已更新。

### 7. Wrong vs Correct

#### Wrong

```rust
#[serde(default = "default_enabled_items")]
enabled_items: Vec<String>,

// Re-adds the item forever, including after a user disables it.
if !settings.enabled_items.contains(&new_default) {
    settings.enabled_items.push(new_default);
}
```

#### Correct

```rust
#[serde(default)]
defaults_version: u8,

if settings.defaults_version < CURRENT_DEFAULTS_VERSION {
    migrate_legacy_values(&mut settings);
    settings.defaults_version = CURRENT_DEFAULTS_VERSION;
}
```

## 性能规则

- CPU/IO 重任务使用 `tokio::task::spawn_blocking`。
- 不在锁内做重计算或外部命令调用。

## 测试建议

- 覆盖并发写、锁冲突、stale lock、损坏 JSON、fallback default 场景。
