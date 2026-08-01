# Verification

## Scope

验证 Provider Continuation metadata row 在现有 Messages scroller 内保持 sticky header，并保留
collapsed → expanded → collapsed 的可逆交互、来源导航和来源缺失状态。

## Evidence

| Gate | Result | Evidence |
|---|---|---|
| Focused Vitest | PASS | `npm exec vitest run src/features/shared-session/components/ProviderContinuationContextCard.test.tsx`；2/2 tests passed |
| TypeScript | PASS | `npm run typecheck` |
| ESLint | PASS | `npm run lint`；0 errors，8 warnings 均来自未触及的既有文件 |
| Diff hygiene | PASS | `git diff --check` |
| OpenSpec structure | PASS | `openspec validate fix-provider-continuation-header-collapse --strict --no-interactive` |

## Requirement Mapping

- `ProviderContinuationContextCard.tsx`
  - feature-scoped `provider-continuation-context-card`
  - `sticky top-3 z-10` 保持 header 位于 scroller viewport 内
  - opaque `bg-muted` + `shadow-sm` 阻止下方 message 穿透
- `ProviderContinuationContextCard.test.tsx`
  - 锁定 sticky layout class contract
  - 覆盖 collapsed → expanded → source navigation → collapsed
  - 保留 missing-source disabled assertion

## Verdict

PASS。实现与 proposal、design、delta spec 一致，无 backend/API/dependency 变化。
