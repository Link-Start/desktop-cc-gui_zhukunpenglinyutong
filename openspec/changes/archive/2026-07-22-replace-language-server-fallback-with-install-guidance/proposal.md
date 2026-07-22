## Why

当前 `provider-unavailable` 状态先显示 generic fallback 提示，再在下方追加安装命令，导致用户第一眼看不到可执行的恢复动作。该状态应直接呈现安装指引，把故障原因、命令与重新检测收敛到同一提示框。

## 目标与边界

- 调整 file editor navigation panel 的 `provider-unavailable` 展示层级与单结果生命周期。
- Java/macOS 直接显示 `brew install jdtls`、复制入口与“安装完成，重新检测”。
- retry 必须继续清理 frontend navigation cache，并重新请求 backend。
- timeout、provider crash、invalid response 等非安装问题继续显示既有故障提示。
- 修复提交前 review 发现的 provider launch `PATH` 空项与跨 workspace/provider 初始化阻塞。

## 非目标

- 不自动执行安装命令，不修改系统 `PATH` 或 shell profile。
- 不改变 semantic provider discovery priority、fast-search scanner 或 IPC contract。
- 不新增 polling、全局状态或依赖。

## What Changes

- `provider-unavailable` 时用安装指引替换 generic fallback note，而不是追加第二块内容。
- 安装提示首行明确显示 missing language server 与 language。
- 保留 fallback mode/status、fallback results、copy command 与 explicit retry。
- 单结果 fallback 在 missing provider 场景先保留为可点击结果，避免自动跳转立即销毁安装提示。
- bare provider executable 不得向 child `PATH` 注入 empty entry；session 初始化按 `(provider, workspace)` 隔离，global session lock 不跨 process spawn/kill await。
- 增加 focused component test，锁定旧提示消失、Java/macOS command 可见、retry 可达。

## 方案对比

1. **替换 generic note（采用）**：单一恢复信息层，命令第一眼可见，最小修改既有 component。
2. 保留 generic note 并强化安装区样式：仍重复表达同一故障，红框首屏继续被旧提示占用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `file-view-code-intelligence-navigation`: `provider-unavailable` 的 fallback note 必须直接呈现 installation guidance，不能同时显示 generic unavailable copy。
- `semantic-code-navigation-provider`: provider launch `PATH` 必须排除 empty executable parent，session initialization coordination 必须按 `(provider, workspace)` 隔离且不持有 global registry lock 跨 process await。

## Impact

- Frontend：`FileViewNavigationPanel`、localized copy、focused component test、对应 footer style。
- Backend：`app_server_cli` PATH seed sanitization、semantic session initialization/eviction lock scope 与 focused Rust tests。
- API/dependencies：无变更。

## 验收标准

- Java/macOS `provider-unavailable` 的红框直接显示“未检测到语言服务 · Java”和 `brew install jdtls`。
- 同一状态不显示“语言服务当前不可用，已改用快速搜索……”旧提示。
- 点击“安装完成，重新检测”调用既有 retry；hook 继续清除旧 cache 后重新请求 backend。
- 单结果 `provider-unavailable` 必须保持提示可见，fallback result 仍可由用户点击跳转。
- timeout、provider crash 等非安装问题不显示 installation command。
- bare executable 不产生 empty `PATH` component；不同 provider/workspace 的 initialization 不被 global session lock 串行阻塞。
- focused Vitest、focused Rust tests、targeted lint、TypeScript typecheck、runtime contract 与 strict OpenSpec validation 通过；不构建 App，不运行全量测试。
