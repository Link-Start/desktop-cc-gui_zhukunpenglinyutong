## 1. Endpoint index contract（P0）

- [x] 1.1 [P0, depends: none] 审计 Project Map scan input、adapter filter、ownership 与 atomic storage helper；输出最小 reusable boundary，并用 existing tests 验证行为未变
- [x] 1.2 [P0, depends: 1.1] 复用 workspace-scoped Project Map read/scan contract；验证 missing、ready、empty、stale、error mapping
- [x] 1.3 [P0, depends: 1.2] 复用既有 ignored-file disk scan、blocking execution 与 atomic snapshot；在 frontend palette session 内完成 in-flight dedupe

## 2. Frontend bridge 与 hydration（P0）

- [x] 2.1 [P0, depends: 1.2] 复用 typed `readProjectMapRelationships` / `scanProjectMapRelationships` bridge 与 dashboard normalizer，保持 error propagation
- [x] 2.2 [P0, depends: 2.1] 新增独立 `WorkspaceSearchApiSnapshot` hydration orchestration，active workspace 优先且 global concurrency bounded；验证 stale generation drop 与 scan dedupe
- [x] 2.3 [P0, depends: 2.2] 将 API loading/refreshing/empty/error 状态 additive 接入 palette，逐段保留并行 file hydration change；运行 SearchPalette focused tests

## 3. Unified API search（P0）

- [x] 3.1 [P0, depends: 2.2] 新增 API provider 与 fast-request-compatible query intent parser；验证 path、method+path、handler、operation、description 与 non-HTTP endpoint cases
- [x] 3.2 [P0, depends: 3.1] 扩展 unified search kind/filter/limits/metrics/ranking 与 grouped presentation；验证 provider limit、workspace label、section order
- [x] 3.3 [P0, depends: 3.2] 接入 endpoint source navigation、optional line 与 recency；验证跨 workspace result 打开正确 source

## 4. 并行变更与质量门禁（P0）

- [x] 4.1 [P0, depends: 2.3,3.3] 对 `fix-global-file-search-hydration` working-tree diff 做 capability matrix，确认 file hydration 与 API hydration 均保留
- [x] 4.2 [P0, depends: 4.1] 运行 focused Vitest、Rust tests、`npm run typecheck`、`npm run lint` 与 relevant contract checks，并记录任何 pre-existing failure
- [x] 4.3 [P0, depends: 4.2] 执行 `openspec validate add-api-endpoint-global-search --strict --no-interactive`，更新 tasks 与 verification evidence

## 5. Stale cache 状态回归（P0）

- [x] 5.1 [P0, depends: 2.3] 区分 cold loading 与 stale/background refreshing，已有 endpoint 时禁止显示 blocking index build
- [x] 5.2 [P0, depends: 5.1] 覆盖 global partial cache、真实 path prefix 与 palette stale-result presentation 回归测试

## 6. Endpoint source line navigation（P0）

- [x] 6.1 [P0, depends: 3.3] 将 Project Map endpoint evidence line 贯通到 SearchResult 与跨 workspace file navigation
- [x] 6.2 [P0, depends: 6.1] 接口跳转使用 centered scroll、focus 与既有 flash feedback；无效行号安全降级
- [x] 6.3 [P0, depends: 6.2] 覆盖 line extraction、selection payload 与 missing-line regression tests

## 7. Review blockers（P0）

- [x] 7.1 [P0, depends: 5.2] workspace-scoped in-flight hydration 支持 effect cleanup 后重订阅、palette reopen 与 scan dedupe
- [x] 7.2 [P0, depends: 6.2] centered navigation 下沉至 lazy `FileCodeMirrorEditorImpl`，恢复 shell type-only boundary
- [x] 7.3 [P0, depends: 7.1,7.2] 覆盖 lifecycle race、imperative centered dispatch 与 lazy-boundary regression gates
