## Why

当前 session catalog 主要解决读取和 UI projection，runtime handle、控制命令和恢复 cursor 没有统一 owner。handoff、后台 drain 和跨 engine 恢复若直接依赖 UI catalog，会出现 stale handle、deadlock 和重复执行。

## 目标与边界

- 建立可执行 session registry，关联 logical/native identity、engine adapter 和 active runtime handle。
- session control API 与 event handler 分离。
- 引入 append-only state transition 与 durable cursor contract。
- drain 由事件驱动，不增加 root hook 或秒级 polling。

## What Changes

- registry 提供 register/rebind/resolve/control/release。
- durable record 只保存 plain data 和 cursor，不序列化 live handle。
- recovery 重放必须幂等，并能识别 replaced/settled session。
- control command 不允许在处理同一 bus event 时同步等待自身回执。

## 方案比较与取舍

- 方案 A：扩展现有 frontend workspace session catalog。离 UI 最近，但无法拥有 backend process handle，拒绝。
- 方案 B：backend executable registry + frontend read projection。采用；控制面与展示面清晰分离。

## Capabilities

### New Capabilities

- `executable-session-registry`: 定义 session runtime ownership、control API、durable cursor 与 recovery。

### Modified Capabilities

无；既有 `workspace-session-catalog-projection` 保持 read projection，由本 capability 提供新的执行事实源。

## 验收标准

- stale/replaced handle 调用 fail-fast。
- restart 后可从 durable cursor 恢复且不重复执行 settled work。
- event handler/control API 无自等待 deadlock。
- session registry 更新不触发 AppShell root 高频渲染。

## 非目标

- 不实现云同步或跨设备 session。
- 不实现完整 orchestration job scheduler。
- 不替换 workspace session 的 UI filtering/organization contract。

## Impact

- Rust runtime/session manager、persistence schema、Tauri commands。
- Frontend session projection adapter、diagnostics 和 recovery tests。
