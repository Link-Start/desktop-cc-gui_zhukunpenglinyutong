# Design

## #7 prompt enhancer

### 本地化 system prompt

`buildPromptEnhancerInstruction(originalPrompt, engine, locale)`：

- `locale` 取自 i18n 当前语言（`i18n.language`，`zh` / `zh-TW` 前缀匹配 → 中文指令，其余 → 英文指令）。
- 中文指令与英文指令保持同一结构（角色、要求列表、"用户草稿"段），claude 附加约束同步翻译。
- hook 内通过 `useTranslation` 取 `i18n.language`，经 ref 读取避免 callback 失稳（批次 2 已验证的教训）。

### 结果缓存

模块级 LRU：

```ts
const ENHANCER_CACHE_MAX = 20;
const enhancerCache = new Map<string, string>(); // insertion-ordered LRU
function enhancerCacheKey(text, engine, model, locale): string
```

- 键：`${locale}|${engine}|${model ?? ""}|${text}`（text 已 trim；不引入 hash 库，文本本身即键，20 条上限控制内存）。
- 命中：跳过 `requestEnhancedPrompt`，直接 `setEnhancedPrompt(cached)` + `canUseEnhancedPrompt=true`。
- 写入：仅在成功且非空时写入；fallback 成功同样写入（以实际生效 engine 计）。
- 失败/超时/空结果不缓存。
- `handleEnhancerEngineChange` / `handleEnhancerModelChange` 不清缓存（键已含 engine/model，天然隔离）。

### 结构化错误

```ts
type PromptEnhancerErrorKind = "timeout" | "workspace" | "empty" | "engine";
class PromptEnhancerError extends Error {
  readonly kind: PromptEnhancerErrorKind;
  readonly retryable: boolean;
}
```

- `withTimeout` reject `PromptEnhancerError("timeout", retryable: true)`，替代 `Error(message)`。
- workspace 未就绪：kind `workspace`，retryable false（不触发 fallback）。
- 空结果：kind `empty`，retryable true（允许 fallback 引擎再试）。
- 引擎 invoke 错误：`classifyPromptEnhancerError(error)` 集中归类 → kind `engine`，retryable 由集中式 `isRetryableEngineErrorMessage` 判定（现状子串规则原样迁入并单测覆盖；规则日后变更只动这一个函数）。
- fallback 决策：`error instanceof PromptEnhancerError && error.retryable && engine === "claude"` → codex fallback；不再直接 `message.includes`。
- UI 展示：`resolveEnhancerFailureCopy(t, error)` → kind 映射 i18n key（`timeout` / `workspace` / `empty` / `generic`），engine kind 附原始 message。

### i18n

`promptEnhancer` 模块新增 key（10 locale）：

- `failedTimeout`（含 `{{seconds}}`）
- `failedWorkspace`
- `failedEmpty`
- `failedGeneric`

## #8 curated-skills 事件化

### Rust

`set_curated_skill_enabled` 成功路径末尾（update_app_settings_core 成功、且无 rollback）：

```rust
let _ = window.app_handle().emit("curated-skills-changed", ());
```

kill-switch 早退路径不 emit（设置未变）。

### 前端

- `src/features/curated-skills/utils/curatedSkillsEvents.ts`：`subscribeCuratedSkillsChanged(listener)`（直接封装 `@tauri-apps/api/event` listen）。不放 `services/events.ts`：该文件已处 large-files gate 阈值上限（800 行），事件域归属 curated-skills feature 内聚。
- `CuratedSkillIndicator`：初始 `tick()` + 事件订阅 tick + `setVisibilityGatedInterval(tick, 60_000)` 兜底；删除 `POLL_INTERVAL_MS = 2000` 与"Why a poll?"注释块（改写为事件驱动说明）。

### 路线 B 后续拆除清单（本批次不做，仅记录）

1. bundled skill 元数据退化为 `src/features/curated-skills/` 下静态常量 + 资源文件，移除锁文件与 build.rs 校验。
2. 注入管线并入 Skills Hub（skills_hub.rs）统一入口。
3. `curated_skills.rs` 仅保留 enabled-ids 读写，或整体并入 settings。

## 测试

- enhancer：cache 命中/未命中、LRU 上限、locale 指令选择、classifier kind 映射、fallback 决策基于 kind。
- indicator：事件触发刷新、无 2s 轮询（fake timers 断言 2s 处无 IPC）、60s 兜底触发。
- Rust：现有 curated_skills 测试保持通过（emit 为 best-effort 无返回值断言）。
