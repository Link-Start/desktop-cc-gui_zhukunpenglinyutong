## REMOVED Requirements

### Requirement: OpenCode MUST Be Unreachable From Production Interaction Entry Points

**Reason**: 产品策略反转——OpenCode 恢复为常驻启用的 active engine（见 `restore-opencode-engine` proposal）。legacy `opencodeEnabled: false` 持久化值不再强制生效，OpenCode 恢复出现在 settings、engine selection、composer 与 workspace 入口。

### Requirement: Retired OpenCode UI MUST Not Remain In The Root Runtime Chain

**Reason**: 退役边界移除后该约束失去对象。旧控制面板形态（OpenCodeControlPanel / useOpenCodeSelection / useOpenCodeThreadBinding / opencode-panel.css）保持删除不回滚，AppShell 根链维持不挂 OpenCode-specific hook——该约束由 `app-shell-runtime-boundaries` 等现行 spec 继续覆盖，无需退役专用条款。

### Requirement: OpenCode Compatibility Paths MUST Fail Closed For Execution

**Reason**: 执行入口恢复——`opencode_*` commands 与 `engine_send_message` 的 OpenCode 臂不再 fail-closed，runtime policy 不再返回 retirement diagnostic。

### Requirement: Normal Session Hydration MUST Not Probe Retired OpenCode

**Reason**: OpenCode 历史会话恢复接入统一 session catalog，`opencode_session_list` 恢复为正常 startup ownership 与历史水合的一部分。
