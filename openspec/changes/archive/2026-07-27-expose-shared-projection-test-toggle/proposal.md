## Why

Change A 的 Shared Projection 已具备 feature-flagged read path，但当前只能通过
DevTools 手工写 `localStorage` 开启。入口不可发现，测试者也容易把 V0 fallback
误判为 Projection 成功，形成认知负债。

## 目标与边界

- 在 `设置 → 其他设置` 暴露 Shared Projection 动态测试开关。
- 复用现有 `mossx.sharedProjection` localStorage flag，不新增 backend setting。
- 开关变化后自动刷新应用，使 history loader 立即按新 flag 重新选择数据源。
- 明确标注该入口只用于 Change A/B 验证、默认关闭、失败仍回退 V0。
- 同步把多 CLI × 多 Provider 总任务清单改成可扫读的认知地图。

## 非目标

- 不把 Shared Projection 改成生产默认数据源。
- 不提前实施 Change B 的 V0→V2 Send、Provider Binding 或 Execution Target。
- 不实现当前会话局部热切换；测试开关通过整页刷新获得确定性重载。
- 不新增 Rust command、数据库字段或第三方依赖。

## What Changes

- `OtherSection` 新增 Shared Projection 测试开关和风险说明。
- Shared Projection DataSource 提供同一 flag 的读写 helper，避免 UI 重复硬编码 key。
- 开关写入后刷新当前 WebView；关闭时删除 override 并恢复默认 V0。
- 增加 focused frontend tests，覆盖默认关闭、开启、关闭和 reload。
- Wave 0–6 任务表新增 `大白话说明`、`改变点`、`UI 变化` 三列。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `shared-canonical-projection`: 增加可发现、默认关闭、可回滚的开发者测试控制面。

## 方案对比与取舍

1. **采用：复用 localStorage flag，切换后刷新。** 改动最小，和现有 DataSource
   判定保持 single source of truth，且刷新能确定性重跑 Shared history loader。
2. **不采用：写入 AppSettings/Rust persistence。** 测试 flag 不属于长期产品配置，
   引入跨层 schema 和 migration 会扩大 Change A 边界。
3. **不采用：当前会话局部热重载。** 需要新增跨组件事件与 history reload
   orchestration，测试入口不值得承担额外状态复杂度。

## 验收标准

- `设置 → 其他设置` 可见 Shared Projection 测试开关。
- 默认状态为关闭；开启写入 `mossx.sharedProjection=1`，关闭删除该 key。
- 每次实际状态变化后调用一次 reload；重复写同状态不制造额外刷新。
- 用户文案明确说明 dark launch、测试用途和 V0 fallback。
- Shared DataSource 继续默认关闭，加载错误继续可观测地回退 V0。
- 总任务清单 Wave 0–6 的任务表均包含三列认知说明，且计划/完成状态不漂移。

## Impact

- Frontend:
  - `src/features/messages/presentation/sharedProjection/dataSource.ts`
  - `src/features/settings/components/settings-view/sections/OtherSection.tsx`
  - 对应 focused tests 与 i18n copy
- Documentation:
  - `docs/plans/2026-07-27-multi-cli-provider-session-foundation-task-checklist.md`
- Backend/API/dependencies: 无变化。
