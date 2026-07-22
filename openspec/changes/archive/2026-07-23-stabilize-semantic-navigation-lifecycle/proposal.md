## Why

Java 与 TypeScript/JavaScript semantic navigation 会在 language server 尚处于 project import/indexing 时发起短时 query；单次 request timeout 又会淘汰健康 session，导致冷启动、索引重建与全工程 heuristic fallback 循环。大型 Maven/Gradle/npm workspace 因此无法稳定进入 warm state，dev/release 并行运行还可能竞争同一 provider data directory。

## 目标与边界

- 将 request timeout 与 process health 解耦：单次 query timeout 只结束 request，不杀死仍存活的 provider。
- Java、TypeScript/JavaScript、Rust 统一复用 workspace-scoped lifecycle state；Java/TS/JS 均纳入本次闭环。
- 将 semantic request soft timeout 调整为 15 秒，并让 frontend、backend timeout contract 对齐。
- 接收 LSP progress/status notification，区分 `starting`、`indexing`、`ready`、`degraded`。
- provider 正在 indexing 时不自动执行 workspace-wide fallback；provider unavailable/exited/invalid 时仍保持有界 fallback。
- 首次打开受支持语言文件后 idle prewarm，不进入 typing/hover 热路径。
- 隔离 dev/release provider data directory，并防止同一 runtime channel 的多进程竞争。

## 非目标

- 不打包或自动下载 `jdtls`、`typescript-language-server`、`rust-analyzer`。
- 不新增 completion、diagnostics、rename、format、refactor 或 settings path picker。
- 不建设通用 IDE project model，也不替代 language server 自身索引。

## What Changes

- Semantic runtime 增加 provider lifecycle snapshot、notification/progress handling、request cancellation 与健康 session 保留策略。
- Java/TS/JS request timeout 统一为 15 秒；process eviction 仅由明确 fatal signal 或 bounded repeated-stall policy 触发。
- Navigation response 增加稳定 lifecycle metadata；UI 显示 indexing/retry/fallback 状态。
- File editor 在受支持语言首次打开后执行一次 bounded idle prewarm。
- Provider data path 增加 runtime channel/owner boundary，避免 packaged 与 development client 共用同一 `-data`。
- 增加 lifecycle、timeout、fallback、prewarm、cross-language 与 cache isolation focused tests 和阶段耗时日志。

## 方案对比

1. **状态机 + persistent provider（采用）**：保留健康 session，使用 progress/readiness 驱动 UI 与 fallback，warm query 最稳定；需要扩展少量 LSP notification contract。
2. **仅把 timeout 从 6 秒改为 15 秒（拒绝）**：改动小，但大工程仍会 timeout 后杀进程，无法收敛到 warm state。
3. **索引期间始终并行 heuristic scan（拒绝）**：短期可能返回候选，但会与 Maven/TypeScript project import 争夺 IO/CPU，并继续掩盖 provider readiness。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `semantic-code-navigation-provider`: 修改 semantic session lifecycle、request timeout、progress/readiness、prewarm 与 data directory ownership contract。
- `file-view-code-intelligence-navigation`: 修改 loading/indexing/fallback UI contract，避免 indexing timeout 触发误导性的自动 fallback。

## 验收标准

- Java、TS/JS 单次 definition timeout 后 provider process 与 session 仍可复用，后续 query 无需重新 spawn。
- provider indexing 时 response/UI 明确标识 indexing，且不执行 workspace-wide fallback scan。
- provider unavailable、exit、malformed response 时仍 bounded 完成并允许后续重建。
- frontend/backend semantic request timeout 均为 15 秒，不存在更短 backend deadline 提前淘汰 session。
- dev/release 同 workspace 不共享同一 JDT LS `-data` directory；同 channel 重复 owner 有确定性保护。
- focused Rust tests、focused Vitest、typecheck、targeted lint、OpenSpec strict validation 通过。

## Impact

- Backend: `src-tauri/src/code_intel_lsp.rs`、`src-tauri/src/code_intel.rs`、`src-tauri/src/state.rs` 及相关 tests。
- Frontend: `src/features/files/hooks/useFileNavigation.ts`、navigation status/types/components/tests、Tauri response normalization。
- Runtime: local external language-server process、app-data cache directory；无持久业务数据 migration，无新增 dependency。
