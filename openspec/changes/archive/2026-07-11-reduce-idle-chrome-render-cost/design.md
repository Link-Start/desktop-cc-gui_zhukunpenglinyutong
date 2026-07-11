# Design: Reduce idle chrome render cost

## Scrollbar scoping

**Problem.** `*::-webkit-scrollbar` / `*:hover` rules make WebKitGTK re-match and
re-resolve (including `var()`) for every element on every style recalc — a large
share of the multi-second `recalculate-styles` stalls on big projects.

**Decision.** Style the scroll roots only: `html`, `body`, and an opt-in
`.scrollable` class. The thumb is always shown (no `:hover` reveal) so no
universal hover selector is needed.

**Ceiling.** Any nested overflow container that wants a styled scrollbar must add
`.scrollable`. Covered explicitly: `.messages`, the file-tree scroll containers,
and the native-overflow settings sub-panels. The main settings view scrolls
through a Radix `ScrollArea`, which renders its own overlay scrollbar and is
unaffected. Vendor config dialogs still fall back to the platform scrollbar; they
can opt in later without further CSS changes.

## Diff viewer unmount-on-tab-switch

**Problem.** The workspace diff viewer stayed mounted with its row virtualizer and
per-row `ResizeObserver`s even when its tab was hidden, so it kept doing layout
work while idle.

**Decision.** Unmount it when its tab is not active.

**Tradeoff (accepted by maintainer).** Unmounting discards transient view state:
an unsaved code-annotation draft, the current text selection, and any lazily
loaded full-diff. Persisted data (saved annotations, the diff itself) is
unaffected and reloads on return. The maintainer noted they will manually verify
the annotation flow on a large dirty project before landing.

## File-tree virtualization threshold

**Decision.** Lower the threshold from 250 to 30 entries. Below 30 the row count
is small enough that virtualization overhead is not worth it; at or above 30 the
saved DOM/render work dominates. No visible change other than that medium trees
now scroll through a virtualized window.

## Why a separate change from the pure-perf work

The pure, behaviour-preserving optimizations (memoization, early-outs, the Prism
LRU cache, cheaper CSS transitions) carry no user-visible change and ship in a
separate PR. This change is scoped to the three behaviour-visible items above so
each can be reviewed and, if needed, reverted independently.
