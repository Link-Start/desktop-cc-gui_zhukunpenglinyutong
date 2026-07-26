# Verification — unify-per-session-provider-selection

## 结论

实现与 proposal、design、delta specs 一致。8 条 Requirement、31 个 Scenario 均有实现或定向测试证据；未发现阻断归档的缺口。

本次遵循任务约束，仅运行受影响的 incremental tests，不运行全量测试。

## 自动验证证据

### Rust targeted tests

- `engine_provider_binding`：3 passed
- `provider_profile`：14 passed
- `provider_env`：2 passed
- `kimi_sessions_are_reused_per_runtime_and_isolated_between_providers`：1 passed
- daemon `provider_profile`：9 passed

合计：29 passed，0 failed。

### Frontend targeted Vitest

- Sidebar、menu、session lifecycle、fork：112 passed
- messaging 当前 thread binding：2 passed
- Kimi identity、provider label、catalog hydration：9 passed
- Tauri request mapping：1 passed

合计：124 passed，0 failed。

### Contract 与 hygiene

- `pnpm tsc --noEmit`：passed
- `pnpm check:runtime-contracts`：passed
- `openspec validate unify-per-session-provider-selection --strict`：passed
- `git diff --check`：passed

## 独立 review

- Desktop 与 daemon 的 Claude/Kimi send path 都按 `request > durable binding > default` 解析，并在创建或复用 runtime 前校验 provider。
- Managed provider 被删除或配置非法时，resolver 显式返回包含 provider id 的错误；不会静默回退。
- Kimi runtime key 包含 workspace 与 provider；interrupt、remove、shutdown 遍历 workspace 下全部 matching runtime。
- Kimi cleanup 仅移除成功停止的 runtime；失败 owner 保留，错误向上游传播。
- pending → canonical、catalog hydration、fork/continue 均保留 provider metadata。
- 未增加根 hook 高频 `setState`、数组追加型 root state 或秒级 polling；未绕过 `liveAssistantTextChannel`。

## 人工验收清单

- [ ] Claude 新建菜单可选择 `Local settings.json` 与 managed provider；选择只影响下一条新会话。
- [ ] Kimi 新建菜单可选择 `Local config.toml` 与 managed provider；选择只影响下一条新会话。
- [ ] 同一 workspace 新建两个 Claude 会话并选择不同 provider；交替发送后各自保持原 provider。
- [ ] 同一 workspace 新建两个 Kimi 会话并选择不同 provider；交替发送后各自保持原 provider。
- [ ] 重启客户端后打开上述会话继续发送；provider binding 仍保持。
- [ ] 切换全局 Claude/Kimi provider；managed-bound 会话不变，local/default 会话跟随全局配置。
- [ ] 删除某个已绑定 managed provider 后再次发送；界面显示可诊断错误，不自动切到其他 provider。
- [ ] Fork Claude 会话；子会话继承父会话 provider label 与实际路由。
- [ ] Kimi 首次发送完成 pending → canonical 收敛；侧边栏只保留一行且 provider label 不丢失。
- [ ] 多 provider Kimi 会话运行时执行中断、关闭 workspace、退出应用；所有 child process 均被控制。
- [ ] local/default 会话不显示为 managed isolation label。
- [ ] 连续流式发送时消息幕布、Markdown 渲染与滚动行为无新增卡顿或闪烁。
