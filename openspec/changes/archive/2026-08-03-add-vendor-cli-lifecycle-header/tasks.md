## 1. OpenSpec / Contract

- [x] 1.1 创建 proposal / design / tasks / spec delta
- [x] 1.2 扩展 `cli-one-click-installer` 主 spec 行为（实现后 sync）

## 2. Backend

- [x] 2.1 实现 `cli_version_status`：local `--version` + 白名单 `npm view` + semver outdated
- [x] 2.2 注册 command / capabilities / daemon parity（如需要）
- [x] 2.3 Rust 单测：解析、outdated、未知 package/engine 边界

## 3. Frontend shared lifecycle

- [x] 3.1 抽取 `useCliInstallLifecycle`（plan 确认 + 实时日志）
- [x] 3.2 CodexSection 回流到共享 hook，保持现有行为

## 4. VendorSettings header

- [x] 4.1 实现 `useCliVersionStatus` + `CliLifecycleHeaderActions`
- [x] 4.2 接到 Claude / Codex / Kimi `CliBrandHeader` actions
- [x] 4.3 i18n + brand-actions 样式

## 5. Verify

- [x] 5.1 按钮可见性矩阵测试 / CodexSection 回流测试
- [ ] 5.2 手工：未安装 / 最新 / outdated / npm view 失败 / 安装后刷新
