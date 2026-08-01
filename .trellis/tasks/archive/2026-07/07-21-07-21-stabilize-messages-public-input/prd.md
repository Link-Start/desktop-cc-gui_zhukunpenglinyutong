# Stabilize Messages Public Input

## Objective

执行 roadmap Phase 2：建立 grouped canonical `MessagesCoreProps`、pure legacy adapter、thin `Messages`
façade 和 minimal public index，同时保持所有现有 render/streaming/interaction behavior。

## Acceptance

- matching canonical state wins; explicit empty arrays remain empty.
- mismatched workspace/thread uses legacy fallback without stale state leakage.
- omitted `activeEngine` derives from canonical meta; legacy-only caller unchanged.
- `MessagesCore.tsx` has one grouped input shape; `Messages.tsx` only adapts/delegates.
- layout direct imports use the messages public index.
- focused/full tests、typecheck、lint、build、boundary and large-file evidence recorded.
