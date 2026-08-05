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
- Full visual parity of CSS zoom vs native zoom.

## Decisions

### 1. Split by `detectRendererPlatform()`

| platform | CSS zoom | native setZoom |
|----------|----------|----------------|
| windows / unknown | `String(scale)` | `1` only |
| macos / linux | clear `""` | `scale` |

**Why not Linux=CSS:** no hang evidence; WebKitGTK CSS zoom weaker than Chromium.

**Why pin native 1 on Windows:** clear residual ZoomFactor from older builds; prevent double scale.

### 2. Platform detection API

Use `detectRendererPlatform()` from `rendererPlatform.ts` (works without Tauri gate). Do **not** rely solely on `isWindowsPlatform()` which returns false when `!isTauri()`.

### 3. Apply site remains `useUiScaleShortcuts` effect

Settings still load via `useAppSettings` → controller → hook. No early apply in `bootstrapApp`.

## Risks / Trade-offs

- [Risk] CSS zoom vs pane drag coordinates → manual smoke DesktopLayout drag on Windows.
- [Risk] Linux future hang → switch linux into CSS branch with new evidence only.
- [Risk] `setZoom(1)` on every Windows apply → catch errors; CSS already applied.

## Migration Plan

1. Land code + tests locally (no commit this round per user).
2. Human smoke: restore `uiScale:0.8` on Windows, confirm app usable.
3. Later: commit / verify / sync / archive under OpenSpec.

## Open Questions

- None for v1. Linux hangs would reopen strategy.
