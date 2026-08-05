## Context

- Evidence: `docs/analysis/windows-ccgui-startup-hang-2026-08-05.md`（settings 二分到 `uiScale`；`setZoom≠1` 在 Win 假死）。
- Current code: `useUiScaleShortcuts` effect always `getCurrentWebview().setZoom(uiScale)`.
- wry backends: Win `SetZoomFactor` | Mac `setPageZoom` | Linux `set_zoom_level`.

## Goals / Non-Goals

**Goals:**

- Platform-correct application of `uiScale` without Windows hang.
- Keep macOS/Linux native zoom unless future evidence says otherwise.
- Testable pure `applyUiScale` + thin hook effect.

**Non-Goals:**

- Persist migration of `uiScale`.
- Rust-side zoom intercept.
- Pixel-perfect parity of every fixed/canvas edge case vs native zoom (letterbox fill is in scope).

## Decisions

### 1. Split by `detectRendererPlatform()`

| platform | CSS scale target | layout fill (`width`/`height`) | native setZoom |
|----------|------------------|--------------------------------|----------------|
| windows / unknown | `<body>` `transform: scale(s)` + `position:fixed` | `100/scale %` on body when `scale≠1`; clear at `1` | `1` only |
| macos / linux | clear transform/zoom on html **and** body | clear `""` on html **and** body | `scale` |

**Why not Linux=CSS:** no hang evidence; WebKitGTK CSS zoom weaker than Chromium.

**Why pin native 1 on Windows:** clear residual ZoomFactor from older builds; prevent double scale.

**Why `transform: scale` not CSS `zoom` for fill:** WebView2 was observed applying `width/height: 100/scale%` while CSS `zoom` did **not** re-expand the border box (uiScale 1.3 → ~77% shell + black bars). `transform: scale(s)` with origin `0 0` always scales paint including chrome. Body portals (dialogs/menus) still scale.

**Why layout fill on Windows only:** bare scale shrinks the paint box and leaves letterbox (black over transparent html/body). Expanding layout by `1/scale` restores full-window coverage without calling `SetZoomFactor(≠1)`. macOS/Linux must never keep these CSS dimensions.

**Why scale `<body>` not `<html>`:** keep `<html>` at 100% viewport; put transform + fill on `<body>` so residual html zoom from older builds can be cleared without double-scale.

**Why shell must be `%` not `100vh`/`100vw`:** expanding body only works if `#root` / `.app` inherit from the expanded parent. Viewport units stay tied to the window — fixed in `src/styles/base.css` (html/body/#root/.app → width/height 100%).

### 2. Platform detection API

Use `detectRendererPlatform()` from `rendererPlatform.ts` (works without Tauri gate). Do **not** rely solely on `isWindowsPlatform()` which returns false when `!isTauri()`.

### 3. Apply site remains `useUiScaleShortcuts` effect

Settings still load via `useAppSettings` → controller → hook. No early apply in `bootstrapApp`.

## Risks / Trade-offs

- [Risk] CSS zoom vs pane drag coordinates → manual smoke DesktopLayout drag on Windows.
- [Risk] Linux future hang → switch linux into CSS branch with new evidence only.
- [Risk] `setZoom(1)` on every Windows apply → catch errors; CSS already applied.
- [Risk] Subpixel gaps after `100/scale %` fill → rare 1px letterbox; smoke at 0.8 / 1.1 / 1.25 DPI.

## Migration Plan

1. Land code + tests locally (no commit this round per user).
2. Human smoke: restore `uiScale:0.8` on Windows, confirm app usable.
3. Later: commit / verify / sync / archive under OpenSpec.

## Open Questions

- None for v1. Linux hangs would reopen strategy.
