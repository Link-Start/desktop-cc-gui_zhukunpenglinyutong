//! Debug-only app identity for local `tauri dev` / `cargo run` builds.
//!
//! macOS Dock tooltip for a bare cargo binary is the **executable file name**.
//! Cosmetic APIs (`setProcessName`, badge label, productName alone) are unreliable
//! for that surface. The durable fix is running as binary `cc-gui-debug`
//! (`Cargo.toml` `default-run` + `[[bin]]`), plus a high-contrast dock icon.

/// Shown as window title in debug builds. Dock tooltip comes from the binary name.
pub const DEBUG_APP_DISPLAY_NAME: &str = "cc-gui-debug";

/// High-contrast dock icon (orange + DEV) so debug is obvious without hovering.
#[cfg(all(debug_assertions, target_os = "macos"))]
const DEBUG_DOCK_ICON_PNG: &[u8] = include_bytes!("../icons/icon-debug.png");

#[cfg(all(debug_assertions, target_os = "macos"))]
const DEBUG_DOCK_BADGE: &str = "DEV";

/// Best-effort process rename (secondary; binary name is the real Dock tooltip).
#[cfg(all(debug_assertions, target_os = "macos"))]
pub fn apply_debug_process_display_name() {
    use objc2_foundation::{NSProcessInfo, NSString};
    let name = NSString::from_str(DEBUG_APP_DISPLAY_NAME);
    NSProcessInfo::processInfo().setProcessName(&name);
}

#[cfg(not(all(debug_assertions, target_os = "macos")))]
pub fn apply_debug_process_display_name() {}

/// Apply debug dock icon + DEV badge. Must run on the main thread after AppKit is up.
#[cfg(all(debug_assertions, target_os = "macos"))]
pub fn apply_debug_dock_identity() {
    use objc2::AllocAnyThread;
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::{MainThreadMarker, NSData, NSString};

    // SAFETY: callers invoke from Tauri main-thread hooks.
    let mtm = unsafe { MainThreadMarker::new_unchecked() };
    let app = NSApplication::sharedApplication(mtm);

    // 1) Distinct icon (works even when badge/tooltips fail).
    let data = NSData::with_bytes(DEBUG_DOCK_ICON_PNG);
    if let Some(image) = NSImage::initWithData(NSImage::alloc(), &data) {
        unsafe {
            app.setApplicationIconImage(Some(&image));
        }
    } else {
        log::warn!("debug identity: failed to decode debug dock icon PNG");
    }

    // 2) Badge as extra cue.
    let tile = app.dockTile();
    tile.setShowsApplicationBadge(true);
    tile.setBadgeLabel(Some(&NSString::from_str(DEBUG_DOCK_BADGE)));
    tile.display();

    // 3) Process name (Activity Monitor / some switchers).
    apply_debug_process_display_name();
}

#[cfg(not(all(debug_assertions, target_os = "macos")))]
pub fn apply_debug_dock_identity() {}

/// Back-compat alias used by older call sites.
#[cfg(all(debug_assertions, target_os = "macos"))]
pub fn apply_debug_dock_badge() {
    apply_debug_dock_identity();
}

#[cfg(not(all(debug_assertions, target_os = "macos")))]
pub fn apply_debug_dock_badge() {}
