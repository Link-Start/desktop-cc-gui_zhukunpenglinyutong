## 1. Backend

- [x] 1.1 为 Claude 增加 `officialNative` / `cliSelfUpdate` 有效策略解析
- [x] 1.2 install/update/uninstall command preview 与执行白名单对齐官方文档
- [x] 1.3 Claude install plan 不再把 Node/npm 缺失当作 blocker
- [x] 1.4 更新 Rust unit tests

## 2. Frontend / Spec

- [x] 2.1 扩展 `CliInstallStrategy` 类型并在 lifecycle hook 传入正确 strategy
- [x] 2.2 更新 `openspec/specs/cli-one-click-installer/spec.md`
- [x] 2.3 更新错误提示文案中过时的 Claude npm install hint（至少 en/zh）
