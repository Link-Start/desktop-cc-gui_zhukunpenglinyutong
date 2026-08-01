## Why

Codex runtime `model/list` 已提供逐模型 reasoning capability，但当前 degraded fallback 将同一组 `low/medium/high/xhigh` 注入所有 built-in models，并把 `gpt-5.6-sol` 默认值写成 `medium`。在 cold startup、runtime 尚未连接或 metadata 缺失时，Composer 因此展示错误的思考强度。

## 目标与边界

- 保持 runtime `model/list` 为 capability single source of truth。
- 仅在 runtime metadata 缺失时，按 built-in model identity 使用已验证的 model-specific fallback。
- 保持现有 catalog merge、selection repair、provider-scoped enrichment 与 send payload 结构不变。

## 非目标

- 不修改 Codex app-server protocol、Rust bridge 或 runtime acquisition。
- 不改变 Composer reasoning selector 的 UI、i18n 或已支持 effort 类型。
- 不为 custom/unknown model 猜测具体 reasoning capability；metadata 缺失时 Composer 保留“默认”与 `selectedEffort = null`，backend 继续使用既有 `low` compatibility fallback。
- 不新增 dependency，不调整其他 engine 的 reasoning contract。

## What Changes

- 将 Codex built-in catalog 的统一 reasoning fallback 改为逐模型 metadata。
- 校准 `gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna`、`gpt-5.5` 的 fallback options/default。
- 保留 runtime metadata 的现有最高优先级和原始顺序。
- 增加 degraded fallback、runtime override、Native 单一会话 Composer/send 与 backend wire focused regression tests。

## 方案对比

- **方案 A：逐模型 fallback map + runtime override（采用）**。修复 degraded 状态，同时不改变在线主链路和现有结构。
- **方案 B：删除本地 reasoning fallback**。契约更纯，但 cold startup、旧 CLI 或 runtime unavailable 时会隐藏 selector，兼容性回退明显。
- **方案 C：修改 selector 临时追加 `max/ultra`**。只修表象，仍会让 Luna/GPT-5.5 暴露不支持选项，并重复 capability 判断。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `codex-model-catalog-coverage`: degraded reasoning fallback 从公共四档改为按 built-in model identity 映射，同时继续服从 runtime-first precedence。

## 验收标准

- 无 runtime hydration 时，Sol 显示六档且默认 `low`，Terra 显示六档且默认 `medium`，Luna 显示五档且不含 `ultra`，GPT-5.5 保持四档。
- runtime 返回非空 options/default 时，fallback 不覆盖、不裁剪、不重排。
- custom/unknown model 无 reasoning metadata 时显示“默认”，保持 `selectedEffort = null`，且不因本变更获得伪造 capability。
- Native 单一会话发送 custom/unknown model 时，frontend MUST 透传 `effort = null`；现有 Codex backend MUST 继续在 `turn/start.reasoning.effort` 使用 `low` compatibility fallback，且不得把该 fallback 反向宣传为模型 capability。
- focused Vitest、TypeScript typecheck、target lint 与 OpenSpec strict validation 通过。

## Impact

- Frontend Codex catalog metadata：`src/features/models/codexModelCatalog.ts`、`src/features/models/generatedModelCatalog.json`
- Focused tests：`src/features/models/hooks/useModels.test.tsx`、`src/app-shell-parts/useAppShellComposerModelSection.test.tsx`、`src/features/threads/hooks/useThreadMessaging.test.tsx`、`src-tauri/src/backend/app_server_tests.rs`
- 无 API、storage、backend、dependency 或 migration 影响。
