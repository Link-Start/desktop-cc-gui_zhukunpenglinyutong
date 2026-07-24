## Why

当前 Usage UI 将主限额标题写死为 `5h limit`，当 Codex runtime 返回 `Weekly limit` 或其他窗口时，标题会与真实 `windowDurationMins` 不一致。现有 `RateLimitSnapshot` 已携带窗口时长，因此应由该动态数据派生展示文案，避免 UI 与上游限额策略漂移。

## What Changes

- 新增 shared pure formatter，根据 `windowDurationMins` 生成 `5h limit`、`Weekly limit`、`2d limit`、`90m limit` 等标题。
- Usage popover 的 primary / secondary 标题均由各自窗口时长派生，不再依赖固定位置语义。
- 本地 `/status` fallback 使用同一 formatter，确保文本状态与 UI 一致。
- 缺失或非法窗口时长时显示稳定 fallback `Rate limit`。
- 不修改 Codex app-server payload、刷新逻辑、百分比或 reset 展示。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `codex-chat-canvas-usage-overview`: Usage panel 与本地 `/status` 的限额标题由 runtime 提供的窗口时长动态派生。

## Impact

- Affected code: Composer Usage popover、`ConfigSelect` legacy/shadcn render paths、本地 `/status` formatter、相关 frontend tests。
- APIs: 无新增或破坏性 API；复用现有 `RateLimitWindow.windowDurationMins`。
- Dependencies: 无新增依赖。
- Compatibility: 缺失时长的旧 payload 使用 `Rate limit` fallback；百分比与 reset 行为保持不变。

## 目标与边界

- 目标：任何现有限额窗口都按其动态 `windowDurationMins` 命名，消除 `5h limit` hardcode。
- 边界：仅调整 presentation mapping；不扩展 Spark 等多限额列表，不修改 IPC、backend 或 polling。

## 非目标

- 不解析或展示 `limitName` / `limitId` 等尚未进入当前 frontend contract 的新字段。
- 不改变用量百分比、重置时间、刷新按钮及 panel layout。
- 不新增 i18n 范围；保持现有 Usage panel 的 English limit label contract。

## 方案取舍

1. **选择：由 `windowDurationMins` 通过 shared formatter 派生。** 复用现有 normalized field，改动小，所有展示入口保持一致。
2. **不选择：扩展 protocol 接收 runtime 的 `limitName`。** 这会扩大到 app-server compatibility 与多限额模型，不符合本次仅修正文案的边界。

## 验收标准

- `300` 分钟显示 `5h limit`，`10080` 分钟显示 `Weekly limit`。
- 其他完整小时、天、分钟窗口分别显示 `Nh limit`、`Nd limit`、`Nm limit`。
- 无效或缺失窗口时长显示 `Rate limit`，UI 不抛错。
- Usage popover 的所有现有 render paths 与本地 `/status` 使用相同映射。
- focused Vitest、`npm run lint`、`npm run typecheck` 与 OpenSpec strict validation 通过。
