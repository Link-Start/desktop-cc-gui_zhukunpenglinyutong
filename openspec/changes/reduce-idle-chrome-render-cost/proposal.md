# Proposal: Reduce idle chrome render cost

## Why

On large projects the app spent multi-second bursts in `recalculate-styles` and
kept avoidable render/observer work alive while idle. Profiling on WebKitGTK
(the Tauri Linux webview) traced most of it to app-wide chrome behaviour rather
than to any one feature:

- Universal `*` / `*:hover` scrollbar rules forced a style re-match and
  `var()` re-resolve for **every** element on every style recalc.
- The workspace diff viewer stayed mounted (with its virtualizer and resize
  observers) even when its tab was not visible.
- The file tree only virtualized past 250 entries, so medium trees rendered
  every row.

These are the behaviour-visible half of the idle-render work; the pure,
behaviour-preserving optimizations ship separately.

## What Changes

- **Scrollbar scoping.** Scope scrollbar styling to the scroll roots
  (`html`, `body`) plus an opt-in `.scrollable` class, replacing the universal
  `*` rules. Add `.scrollable` to the chat list (`.messages`), the file-tree
  scroll containers, and the settings sub-panels so they keep styled scrollbars.
- **Diff viewer unmount-on-tab-switch.** Unmount the workspace diff viewer when
  its tab is not active, releasing its virtualizer and observers while idle.
- **File-tree virtualization threshold.** Lower the virtualization threshold
  from 250 to 30 entries so medium trees stop rendering every row.

## Impact

- Affected spec: `ui-chrome-idle-render-cost` (new capability)
- Affected code:
  - `src/styles/base.css`
  - `src/features/layout/components/DesktopLayout.tsx`
  - `src/features/files/components/fileTreePanelInternals.ts`
  - `src/features/messages/components/Messages.tsx`
  - `src/features/files/components/FileTreePanel.tsx`, `FilePreviewPopover.tsx`
  - `src/features/search/components/WorkspaceSearchPanel.tsx`
  - `src/features/settings/**` (settings sub-panel scroll containers opt in)
- Accepted tradeoff: switching away from the diff viewer's tab discards its
  unsaved annotation draft, selection, and loaded full-diff (see design).
