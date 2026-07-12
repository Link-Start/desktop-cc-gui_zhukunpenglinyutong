## 1. Shared Floating Tooltip

- [x] 1.1 [P0][depends:none][I: TooltipIconButton Floating implementation][O: forwardRef FloatingTooltipButton preserving visual/placement/a11y contract][V: shared primitive tests] Extract shared primitive.
- [x] 1.2 [P1][depends:1.1][I: TooltipIconButton API][O: thin wrapper with no behavior drift][V: existing TooltipIconButton tests] Reuse primitive.

## 2. Sidebar Thread Rows

- [x] 2.1 [P0][depends:1.1][I: ThreadList row][O: Floating tooltip normal path and on-demand delete Popover][V: ThreadList tests] Migrate unpinned rows.
- [x] 2.2 [P0][depends:1.1][I: PinnedThreadList row][O: parity with normal rows][V: PinnedThreadList tests] Migrate pinned rows.
- [x] 2.3 [P0][depends:2.1,2.2][I: persisted multi-row hydration][O: StrictMode/ScrollArea regression][V: no #185/maximum-depth console error] Add startup coverage.

## 3. Verification

- [x] 3.1 [P0][depends:2.3][I: implementation][O: focused/AppShell/typecheck/lint/strict validation evidence][V: commands exit 0] Run automated gates.
- [x] 3.2 [P0][depends:3.1][I: production bundle][O: new hash first-install acceptance][V: human confirms no ErrorBoundary] Hold closure until production acceptance.
