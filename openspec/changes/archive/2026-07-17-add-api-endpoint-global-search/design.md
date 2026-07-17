## Context

全局搜索当前由 synchronous providers 聚合 workspace files、threads、messages、kanban、history、skills 和 commands。Project Map backend 已能从 workspace source files 构建 `ApiContractGraph`，但该 graph 作为完整 relationship scan 的副产物持久化；未执行 scan 时没有数据。

并行 change `fix-global-file-search-hydration` 正在引入 file-specific hydration state。接口能力必须与其并行演进：共享“按 workspace lazy hydration”的模式，但不共享 state 字段或覆盖其修改。

fast-request 的可借鉴契约是：endpoint item 由 method、path、handler/source metadata 组成；query 支持 `/path`、`method /path` 和描述关键词；选择后导航源码。本 change 不复制其 AGPL implementation。

## Goals / Non-Goals

**Goals:**

- 复用 Project Map endpoint extraction fidelity，同时避免完整 relationship scan 的额外成本。
- cache hit 立即可搜；cache missing / stale 时后台磁盘 hydration。
- query path 保持 memory-only，并提供可区分的 loading / ready / empty / stale / error 状态。
- 以 additive provider 接入 unified search，保留并行 file hydration change。
- 多 workspace endpoint 结果具有稳定 ownership、ranking 和 source navigation。

**Non-Goals:**

- 不提供 API request runner、parameter editor 或 export。
- 不在每次 palette open 时无条件重扫。
- 不把 endpoint hydration 塞入 AppShell 高频根状态更新链。
- 不新增 parser dependency 或复制 Project Map extractor。

## Decisions

### 1. 复用 Project Map read / scan lifecycle

Frontend 先调用 `project_map_relationship_read` 并 normalize `apiContracts` 与 `staleSummary`。cache missing 或 stale 时，后台调用既有 `project_map_relationship_scan`，完成后再次 read。该 command 已在 `spawn_blocking` 中执行，并统一提供 ignore walker、file budget、ownership validation、storage lock、atomic write 与 API extractor。

Alternative：新增 endpoint-only command。拒绝，因为当前 scanner 的 walker/input assembly 尚未形成独立 reusable boundary；为首版复制 walker 会让 ignore、budget、fingerprint 与 storage contract 漂移。只有性能 evidence 证明完整 scan 不可接受时，才抽取共享 scan-input builder 后增加 endpoint-only mode。

Alternative：新增独立 parser。拒绝，因为 endpoint semantics 会与 Project Map drift。

### 2. stale-while-revalidate

- ready cache：立即返回。
- stale cache：立即暴露旧 endpoints，并触发一次 background refresh。
- missing cache：状态为 loading，完成后变为 ready 或 empty。
- failed refresh：保留可用 stale endpoints，同时暴露 error；无 cache 时为 error。

同一 workspace 通过 in-flight registry 去重。palette close 不强杀 Rust scan，但 frontend 使用 generation token 丢弃过期 UI commit。

### 3. provider-specific snapshots

Frontend 使用独立 `WorkspaceSearchApiSnapshot`，包含 endpoints、status、sourceVersion/fingerprint 与 error。它与 `WorkspaceSearchFileSnapshot` 并列，不合并为共享 union，避免并行 change 互相覆盖。

API hydration 仅在 palette open 且 filter 包含 `all` 或 `apis` 时启动。全局 scope 限制并发，active workspace 优先。

### 4. fast-request-compatible query parsing

provider 对 query 做一次 bounded parse：

- 单 token 以 `/` 开头：path intent；
- 首 token 命中 known HTTP method 且存在后续 token：method + path intent；
- 其他：general intent。

HTTP endpoint 对 method/path 精确前缀给予最高权重；RPC/GraphQL/ABI 继续通过 protocol、operation、handler、description 和 source metadata 匹配。无 regex backtracking 或 fuzzy dependency。

### 5. navigation contract

`SearchResult` 增加 endpoint identity、source file 与 optional source line。选择结果沿现有 workspace/file open path：

1. 确认 target workspace；
2. 打开 source file；
3. 有可靠 evidence line 时定位；
4. 记录 recency 并关闭 palette。

不强制打开 Project Map panel。

### 6. 并行修改保护

- backend 优先新增 endpoint index module，Project Map extractor 只做最小 visibility/refactor。
- frontend 优先新增 provider、snapshot hook/service；对 `SearchPalette`、types 和 AppShell 的改动按当前 working tree 逐段合并。
- 实施前后重复检查 `git diff`，不还原、不格式化覆盖并行 AI 文件。

## Risks / Trade-offs

- [首次扫描仍可能较慢] → adapter extension filter、file/size budget、blocking worker、active workspace priority。
- [fingerprint 计算本身需要磁盘遍历] → cache 先返回；refresh 在后台执行，query 不等待。
- [Project Map extractor 与 relationship scan 耦合] → 只抽出最小 reusable scan input/build boundary，不重构整个 subsystem。
- [并行 AI 修改同一 search files] → additive types/provider，逐 hunk semantic merge，focused regression tests。
- [source line 不完整] → evidence line 可用才定位，否则安全降级为打开文件。
- [多 workspace 同时冷启动导致 IO 放大] → bounded concurrency、workspace in-flight dedupe。

## Migration Plan

1. 复用并验证现有 Project Map read / scan contract。
2. 新增 frontend snapshot hydration 与 provider。
3. 将 `api` kind/filter additive 接入 palette 与 navigation。
4. 验证并行 file hydration focused tests。
5. 若需回滚，移除新 command/provider 接线；既有 Project Map artifact 保持兼容。

## Open Questions

- 初版 source line 以 endpoint evidence 中首个可信 line 为准；若现有 extractor 对某些 adapter 不提供 line，则只打开文件，后续再扩充 adapter evidence。
