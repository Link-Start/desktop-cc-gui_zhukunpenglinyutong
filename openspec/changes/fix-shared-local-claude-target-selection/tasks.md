## 1. Catalog Loading Contract

- [x] 1.1 [P0, depends: none] 调整 Shared provider catalog hook：输入 local/disk
  Provider scope，输出 forced authoritative refresh，同时保留 binding-scoped in-flight
  coalescing；以 hook focused test 验证 stale cache bypass 与 managed cache isolation。

## 2. Selection Regression

- [x] 2.1 [P0, depends: 1.1] 增加 Codex → Claude local 双栏点击回归：输入
  `settings-main` / `kimi-for-coding` identity pair，输出一次完整
  `ExecutionTarget`；以 picker click test 验证关闭、payload 与 fail-closed 行为。

## 3. Contract Synchronization

- [x] 3.1 [P1, depends: 1.1, 2.1] 将 local catalog freshness 与 catalog/runtime identity
  契约同步到 Trellis executable contract；以文档 diff 与 OpenSpec strict validation 验证。

## 4. Quality Gates

- [x] 4.1 [P0, depends: 1.1, 2.1] 运行 touched frontend focused Vitest，确保 catalog 与
  selector regression 通过。
- [x] 4.2 [P0, depends: 3.1] 运行 TypeScript typecheck、ESLint、runtime contracts 与
  OpenSpec strict validation。
- [x] 4.3 [P1, depends: 4.1] 运行 Shared target Rust validation focused tests，确认
  frontend 修复未放宽 backend fail-closed boundary。

## 5. Native / Shared Selection Convergence

- [x] 5.1 [P0, depends: 2.1] 收敛 Native 与 Shared Provider identity matcher：local
  sentinel 与 `null` 视为同一 binding，`providerProfileSource` 仅作为 metadata，不得导致
  Native 单栏丢失 Provider / Model 勾选态。
- [x] 5.2 [P0, depends: 1.1] 将 Shared local authoritative refresh 限定为同一 catalog
  owner 生命周期内首次成功展开；pointer / focus / accordion 重复 activation MUST 复用
  已完成结果，不得再次进入 loading。
- [x] 5.3 [P0, depends: 5.1, 5.2] 对 `model` 为空的 legacy catalog row 使用 backend
  同源的 `id` runtime fallback；已知 `id != model` 时仍必须提交明确 runtime `model`。
- [x] 5.4 [P0, depends: 5.1, 5.2, 5.3] 增加 Native 无 source 选中态、Native loading
  last-good 可交互、Shared refresh 去重与 legacy row 点击回归。
- [x] 5.5 [P0, depends: 5.4] 运行 focused Vitest、TypeScript typecheck、ESLint、
  runtime contracts 与 OpenSpec strict validation。
