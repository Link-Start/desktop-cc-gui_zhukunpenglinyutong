## Why

Claude model mapping 仍同时写一个 canonical key 和两个 legacy key，load/save/switch/delete 多条错误路径被压成 `null`、`false` 或静默失败。用户无法确认配置是否真正生效，legacy migration 也永远无法结束。

## 目标与边界

- localStorage 只保留 canonical write owner。
- legacy read-migrate-delete 幂等且不覆盖较新的 canonical value。
- provider actions 返回 typed result/error。
- UI 对配置失败提供可诊断反馈。

## What Changes

- 统一 `STORAGE_KEYS` 与 migration owner，停止 triple-write。
- 定义 canonical-vs-legacy 冲突解决和兼容窗口。
- load/save/switch/delete 失败显式传播并保留 backend cause。
- 补齐 malformed storage、backend failure 和 rollback tests。

## 方案比较与取舍

- 方案 A：继续 triple-write，增加一致性检查。只会永久保留三份状态，拒绝。
- 方案 B：canonical-only write + idempotent migration。采用；可渐进退出 legacy，同时不破坏旧数据。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `claude-provider-management`: 增加 canonical storage migration 与 typed error visibility contract。

## 验收标准

- 新写入只触达 canonical key。
- migration 重复执行不改变新值，legacy cleanup 失败可诊断。
- load/save/switch/delete 的 backend/malformed/storage failure 用户可见。
- existing reorder 与 provider activation behavior 不回退。

## 非目标

- 不重做 Claude provider UI。
- 不改变 provider JSON schema 的业务字段。
- 不修改 Claude CLI 安装流程。

## Impact

- Vendor constants、provider management hook、settings UI。
- localStorage migration、Tauri error mapping、Vitest failure matrix。
