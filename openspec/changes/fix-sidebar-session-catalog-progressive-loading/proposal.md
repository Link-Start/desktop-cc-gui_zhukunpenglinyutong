## Why

Sidebar session hydration already uses bounded catalog pages, but its change-local rationale and acceptance contract were lost. Without an explicit proposal, future work can regress startup into an all-history request or treat a bounded first page as authoritative absence.

## What Changes

- Define a bounded first-page contract for sidebar catalog hydration.
- Preserve continuation cursor and partial/degraded evidence when more history may exist.
- Keep “load older” filter semantics stable and prevent stale page results from replacing a newer query.
- Record focused tests and manual evidence before claiming completion.

## Capabilities

### Modified Capabilities

- `workspace-session-catalog-projection`: calibrates bounded first-page and continuation behavior for the sidebar consumer.

## Impact

- Documentation scope: sidebar/catalog behavior, pagination, source completeness, and verification gates.
- Expected implementation surfaces when work resumes: workspace catalog backend, thread list hydration, sidebar load-older flow, and focused tests.
- No implementation change is included in this documentation repair.

