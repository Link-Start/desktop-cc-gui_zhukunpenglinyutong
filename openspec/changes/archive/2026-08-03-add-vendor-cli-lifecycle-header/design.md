## Context

- VendorSettings `CliBrandHeader` 已预留 `actions` 槽位。
- `cli_install_plan` / `cli_install_run` 与 CLI 验证面板已覆盖受控安装 / 更新 / 卸载。
- 当前缺少只读 outdated 探测：CLI 验证对已安装引擎一律提供「更新最新版」，本需求要求仅 outdated 时显示升级。

## Decisions

1. **新增只读 `cli_version_status` command**  
   返回 `installed` / `localVersion` / `latestVersion` / `updateAvailable` / `nodeOk` / `details`。本机版用 binary `--version`；最新版用白名单 `npm view <pkg> version`。禁止任意命令。

2. **升级可见性**  
   仅当两侧均可解析为 semver 且 latest > local 时 `updateAvailable=true`。任一侧失败 → 不显示升级。

3. **共享 lifecycle hook**  
   从 `CodexSection` 抽取 `useCliInstallLifecycle`（plan → confirm → progress logs），CLI 验证与 VendorSettings header 共用，避免双源。

4. **刷新策略**  
   mount / engine 切换 / install finished 时按需拉取；禁止秒级轮询，不挂 AppShell 根链。

5. **绿点语义不变**  
   左侧 emerald 圆点继续表示 hasConfig。

## Risks

- `npm view` 需联网与超时控制；失败路径必须降级为“无升级按钮”。
- 版本字符串常带前缀/噪声，需 robust 提取再比较。
- CodexSection 回流抽取可能引入 regression；保留现有 section 测试覆盖。
