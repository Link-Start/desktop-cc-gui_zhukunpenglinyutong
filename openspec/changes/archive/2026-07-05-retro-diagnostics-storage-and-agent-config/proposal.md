## Why

诊断数据和用户业务数据必须分层。AI 桌面客户端里 diagnostics 可能涉及错误、renderer 事件、运行时状态、导出包；如果边界不清，容易把 prompt、raw output、workspace file content 或 secrets 混进诊断包。

既成事实是：client diagnostics storage 和 schema 已被隔离；diagnostics bundle 处理被更新；debug log、kanban store、renderer diagnostics tests 已同步；`.codex/agents/*.toml` 和 OpenSpec consistency script 已补齐。

这类变更横跨 backend、frontend storage、host adapter config 和 governance tooling。OpenSpec 必须写清楚：diagnostics 是 diagnostics boundary，agent config 是 host adapter glue，不是 app runtime source fact。

## What Changes

- 隔离 client diagnostics storage/schema。
- 更新 diagnostics bundle handling。
- 补齐 Codex debug/dispatch/plan agents config。
- 新增 OpenSpec consistency validation script。
- 更新 debug log、kanban、renderer diagnostics tests。

## Scope / Impact

- Affected commits: `df1e5163`.
- Impact file/surface: `src-tauri/src/client_storage.rs`
- Impact file/surface: `src-tauri/src/diagnostics_bundle.rs`
- Impact file/surface: `src/services/clientStorageSchema.ts`
- Impact file/surface: `src/services/rendererDiagnostics.ts`
- Impact file/surface: `src/features/debug/**`
- Impact file/surface: `src/features/kanban/**`
- Impact file/surface: `.codex/agents/*.toml`
- Impact file/surface: `.agents/skills/osp-openspec-sync/scripts/validate-consistency.py`

## Non-Goals

- 不改变 core workspace storage model。
- 不改变 renderer diagnostics event schema beyond storage isolation。
- 不在 retro spec 执行 agent workflow changes。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
