# restore-opencode-engine design

## Context

OpenCode 的 runtime adapter（`engine/opencode.rs` ~1800 行）与 17 个 `opencode_*` commands 在退役后完整保留，且经实测与本地 opencode 1.4.6 的 `run --format json` 输出兼容。因此本 change 的设计问题不是"如何接入"，而是"如何干净地反转退役边界 + 把缺口补到 Kimi/Grok 同级"。

## Decisions

### D1: 常驻启用，无 enable 开关

`engine_enabled_in_settings(OpenCode) => true`，与 Kimi/Grok 对齐。`AppSettings.opencode_enabled` 字段保留（serde 兼容 legacy 配置）但不再参与 gate；`sanitize_engine_gates` 不再改写它；`default_opencode_enabled() -> true`。

取舍：保留开关意味着 settings UI、sanitize、daemon 影子副本都要维护一条 kimi/grok 没有的分支——这正是当年维护成本抱怨的来源之一。常驻启用删掉分支。

### D2: 删除 retirement check，而不是改写

`scripts/check-opencode-retirement.mjs` 的存在意义是 fail-closed 守护退役边界；边界本身被本 change 移除后，保留一个"检查退役不存在"的脚本没有价值。直接删脚本 + package.json 条目 + 受它保护的测试同步反转。

### D3: 模型始终显式 `--model`

实测本机 opencode 默认 model 配置损坏（`Model not found: xaio/XAIO-C-4-5-Sonnet`），且 headless 下 CLI 不会自愈。GUI 发送路径必须始终携带用户在 composer 选中的 model；模型列表以 `load_opencode_models`（`opencode models` stdout 逐行 `provider/model`）动态探测为准，`generatedModelCatalog.json` opencode roster 仅作 CLI 不在时的 fallback。doctor 增加默认 model 可用性检查项，提前暴露该配置问题。

### D4: vendor provider 经 `OPENCODE_CONFIG_CONTENT` 注入，不动用户磁盘配置

kimi/grok 的 vendor 切换会物化到 CLI 自己的配置文件（`~/.grok/config.toml`）。opencode 提供 `OPENCODE_CONFIG_CONTENT`（内联整个 opencode.json）与 `OPENCODE_PERMISSION` env，可以在 spawn 时注入：

```json
{
  "provider": {
    "ccgui": {
      "npm": "@ai-sdk/openai-compatible",
      "options": { "baseURL": "<base_url>", "apiKey": "<api_key>" },
      "models": { "<model>": {} }
    }
  }
}
```

发送时 `--model ccgui/<model>`（provider key 固定为 `ccgui`，session 隔离靠 runtime key 而非 provider key）。好处：不写用户 `~/.opencode/opencode.json`，无需备份/回滚逻辑，provider 切换即 spawn 参数变化。runtime key 沿用 kimi 模式 `opencode::{ws}::{profile}` 隔离 session 复用；launch profile 自包含解析 ccgui config.json（与 kimi/grok 同构），保证无 vendors 模块的 daemon crate 同样可编译。

风险：非 openai-compatible 的 provider（如 anthropic 原生）需要不同 `npm` 包；首版只支持 openai-compatible 中转站（与 kimi/grok vendor 面板的实际用法一致），其余在 dialog 中标注 unsupported。

实测补充（1.4.6）：一旦经 env 声明自定义 npm provider，本次进程内 CLI 自带 provider 的 auth 解析会被干扰（zen 返回 401）；空 `{}` 文档无此问题。因此 managed profile 的模型 catalog **只暴露 profile 自己的 models**，不 merge public roster（与 kimi/grok 的 merge 策略不同，是有意为之）。自定义 npm provider 首次使用需安装 `@ai-sdk/openai-compatible`（一次性，可能 >30s）。

### D5: 历史水合与启动注册恢复默认

`useThreadActions` 的 `includeOpenCodeSessions` 默认恢复 true、`startupOwners` 恢复 `opencode_session_list` 注册，使 opencode 历史会话与 kimi/grok 一样出现在统一 session catalog。`session_management_catalog_projection.rs` 的 `opencode_disabled` 特判分支删除。

### D6: 不恢复旧控制面板形态

2026-07 退役时删除的 `OpenCodeControlPanel` / `useOpenCodeSelection` / `useOpenCodeThreadBinding` / `opencode-panel.css` 是 opencode 独有的控制面板 UX。恢复走现行标准 engine 链路（composer provider 切换 + 统一消息渲染 + 设置页 tab），不回滚那些删除——避免重新引入根链 hook 与专用 CSS 的维护负担。

## Risks

- opencode `run --format json` 无 token 级 delta（块级事件），流式观感依赖现有 `OPENCODE_SYNTHETIC_STREAM_*`；接受现状。
- opencode 输出格式无官方稳定性承诺（已知 regression issue 见调研）；doctor 与 get_engine_models 对版本做探测，事件解析保持逐行容错（单行 parse 失败不中断 turn）。
- daemon 影子副本（`cc_gui_daemon/engine_bridge.rs`）必须与主库 policy 同步，否则 remote workspace 行为分叉；`cargo check` 双 target 验证。
