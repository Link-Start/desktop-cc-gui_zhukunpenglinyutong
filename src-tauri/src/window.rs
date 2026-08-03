use serde::Serialize;
use tauri::{Theme, Window};

const WINDOW_OPACITY_MIN: f64 = 0.55;
const WINDOW_OPACITY_MAX: f64 = 1.0;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WindowOpacityApplyResult {
    requested_opacity: f64,
    applied_opacity: f64,
    applied: bool,
    platform: &'static str,
    reason: Option<String>,
}

#[cfg(test)]
use std::sync::{Mutex, OnceLock};

#[cfg(test)]
type WindowAppearanceOverride =
    Box<dyn Fn(&Window, &str) -> Result<(), String> + Send + Sync + 'static>;

#[cfg(test)]
static WINDOW_APPEARANCE_OVERRIDE: OnceLock<Mutex<Option<WindowAppearanceOverride>>> =
    OnceLock::new();

#[cfg(target_os = "macos")]
fn apply_macos_window_appearance(window: &Window, theme: &str) -> Result<(), String> {
    use objc2_app_kit::{
        NSAppearance, NSAppearanceCustomization, NSAppearanceNameAqua, NSAppearanceNameDarkAqua,
        NSWindow,
    };

    let ns_window = window.ns_window().map_err(|error| error.to_string())?;
    let ns_window: &NSWindow = unsafe { &*ns_window.cast() };

    if theme == "system" {
        ns_window.setAppearance(None);
        return Ok(());
    }

    let appearance_name = unsafe {
        if theme == "light" {
            NSAppearanceNameAqua
        } else {
            NSAppearanceNameDarkAqua
        }
    };
    let appearance =
        NSAppearance::appearanceNamed(appearance_name).ok_or("NSAppearance missing")?;
    ns_window.setAppearance(Some(&appearance));
    Ok(())
}

pub(crate) fn apply_window_appearance(window: &Window, theme: &str) -> Result<(), String> {
    #[cfg(test)]
    if let Some(handler) = WINDOW_APPEARANCE_OVERRIDE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .unwrap()
        .as_ref()
    {
        return handler(window, theme);
    }

    let next_theme = match theme {
        "light" => Some(Theme::Light),
        "dark" | "dim" => Some(Theme::Dark),
        _ => None,
    };
    let _ = window.set_theme(next_theme);

    #[cfg(target_os = "macos")]
    {
        let window_handle = window.clone();
        let theme_value = theme.to_string();
        window
            .run_on_main_thread(move || {
                let _ = apply_macos_window_appearance(&window_handle, theme_value.as_str());
            })
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn clamp_window_opacity(opacity: f64) -> Result<f64, String> {
    if !opacity.is_finite() {
        return Err("invalid window opacity: value must be finite".to_string());
    }
    Ok(opacity.clamp(WINDOW_OPACITY_MIN, WINDOW_OPACITY_MAX))
}

fn opacity_result(
    requested_opacity: f64,
    applied_opacity: f64,
    applied: bool,
    platform: &'static str,
    reason: Option<String>,
) -> WindowOpacityApplyResult {
    WindowOpacityApplyResult {
        requested_opacity,
        applied_opacity,
        applied,
        platform,
        reason,
    }
}

#[cfg(target_os = "macos")]
fn apply_native_window_opacity(
    window: &Window,
    opacity: f64,
) -> Result<WindowOpacityApplyResult, String> {
    use objc2_app_kit::NSWindow;

    let applied_opacity = clamp_window_opacity(opacity)?;
    let ns_window = window
        .ns_window()
        .map_err(|error| format!("failed to get macOS window handle: {error}"))?
        as usize;
    window
        .run_on_main_thread(move || {
            let ns_window = ns_window as *mut std::ffi::c_void;
            let ns_window: &NSWindow = unsafe { &*ns_window.cast() };
            ns_window.setAlphaValue(applied_opacity);
        })
        .map_err(|error| format!("failed to apply macOS window opacity: {error}"))?;

    Ok(opacity_result(
        opacity,
        applied_opacity,
        true,
        "macos",
        None,
    ))
}

#[cfg(target_os = "windows")]
fn apply_native_window_opacity(
    window: &Window,
    opacity: f64,
) -> Result<WindowOpacityApplyResult, String> {
    use windows_sys::Win32::Foundation::GetLastError;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetLayeredWindowAttributes, SetWindowLongPtrW, GWL_EXSTYLE, LWA_ALPHA,
        WS_EX_LAYERED,
    };

    let applied_opacity = clamp_window_opacity(opacity)?;
    let hwnd = window
        .hwnd()
        .map_err(|error| format!("failed to get Windows window handle: {error}"))?;
    let hwnd = hwnd.0 as windows_sys::Win32::Foundation::HWND;
    let alpha = (applied_opacity * 255.0).round() as u8;

    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style | WS_EX_LAYERED as isize);
        if SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA) == 0 {
            return Err(format!(
                "failed to apply Windows window opacity: GetLastError={}",
                GetLastError()
            ));
        }
    }

    Ok(opacity_result(
        opacity,
        applied_opacity,
        true,
        "windows",
        None,
    ))
}

#[cfg(target_os = "linux")]
fn apply_native_window_opacity(
    _window: &Window,
    opacity: f64,
) -> Result<WindowOpacityApplyResult, String> {
    let applied_opacity = clamp_window_opacity(opacity)?;
    Ok(opacity_result(
        opacity,
        applied_opacity,
        false,
        "linux",
        Some("native window opacity is not supported on this Linux runtime".to_string()),
    ))
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn apply_native_window_opacity(
    _window: &Window,
    opacity: f64,
) -> Result<WindowOpacityApplyResult, String> {
    let applied_opacity = clamp_window_opacity(opacity)?;
    Ok(opacity_result(
        opacity,
        applied_opacity,
        false,
        "unsupported",
        Some("native window opacity is not supported on this platform".to_string()),
    ))
}

#[tauri::command]
pub(crate) fn set_main_window_opacity(
    window: Window,
    opacity: f64,
) -> Result<WindowOpacityApplyResult, String> {
    apply_native_window_opacity(&window, opacity)
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DockIconApplyResult {
    icon_id: String,
    applied: bool,
    platform: &'static str,
    /// How many windows received a window-level icon update (Win/Linux).
    windows_updated: u32,
    reason: Option<String>,
}

fn dock_icon_result(
    icon_id: String,
    applied: bool,
    platform: &'static str,
    windows_updated: u32,
    reason: Option<String>,
) -> DockIconApplyResult {
    DockIconApplyResult {
        icon_id,
        applied,
        platform,
        windows_updated,
        reason,
    }
}

/// Apply the user-selected app icon.
///
/// Platform mapping:
/// - **macOS**: `NSApplication.setApplicationIconImage` (Dock + app switcher).
///   When `png_bytes` is present (including the `default` catalog entry), those
///   bytes are applied so the Dock matches the settings picker. Empty bytes fall
///   back to the bundle icon.
/// - **Windows / Linux**: `Window::set_icon` on every open window (taskbar /
///   window chrome). Requires non-empty PNG bytes.
/// - **Other**: no-op with an explanatory reason.
#[tauri::command]
pub(crate) fn set_dock_icon(
    app: tauri::AppHandle,
    icon_id: String,
    png_bytes: Option<Vec<u8>>,
) -> Result<DockIconApplyResult, String> {
    let trimmed_id = icon_id.trim().to_string();
    if trimmed_id.is_empty() {
        return Err("dock icon id must not be empty".to_string());
    }

    let bytes = png_bytes.filter(|raw| !raw.is_empty());
    if let Some(raw) = bytes.as_ref() {
        validate_png_payload(raw)?;
    }

    #[cfg(target_os = "macos")]
    {
        let bytes_owned = bytes.clone();
        let icon_id_for_result = trimmed_id.clone();
        // Fail closed if the main-thread schedule itself fails. Decode/apply
        // errors inside the closure are logged (NSImage is main-thread only).
        app.run_on_main_thread(move || {
            if let Err(error) = apply_macos_dock_icon(bytes_owned.as_deref()) {
                log::error!("failed to apply macOS dock icon: {error}");
            }
        })
        .map_err(|error| format!("failed to schedule dock icon update: {error}"))?;

        // Window chrome is best-effort; Dock is the primary surface on macOS.
        // Some secondary windows may reject set_icon — do not fail the command.
        let windows_updated = match bytes.as_ref() {
            Some(raw) => apply_desktop_window_icons(&app, raw).unwrap_or(0),
            None => 0,
        };

        return Ok(dock_icon_result(
            icon_id_for_result,
            true,
            "macos",
            windows_updated,
            None,
        ));
    }

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        // No process-wide app icon API: each window carries its own taskbar icon.
        // Callers should re-invoke after creating secondary windows (about, explorer).
        let platform = if cfg!(target_os = "windows") {
            "windows"
        } else {
            "linux"
        };
        let Some(raw) = bytes.as_ref() else {
            return Ok(dock_icon_result(
                trimmed_id,
                false,
                platform,
                0,
                Some("png bytes are required to update window icons".to_string()),
            ));
        };
        let windows_updated = apply_desktop_window_icons(&app, raw)?;
        // Partial success is still success: Linux compositors may reject some windows.
        let applied = windows_updated > 0;
        return Ok(dock_icon_result(
            trimmed_id,
            applied,
            platform,
            windows_updated,
            if applied {
                None
            } else {
                Some("no open windows accepted the icon update".to_string())
            },
        ));
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = app;
        let _ = bytes;
        Ok(dock_icon_result(
            trimmed_id,
            false,
            std::env::consts::OS,
            0,
            Some("app icon switching is not supported on this platform".to_string()),
        ))
    }
}

/// PNG magic: 89 50 4E 47 0D 0A 1A 0A
fn validate_png_payload(raw: &[u8]) -> Result<(), String> {
    const PNG_MAGIC: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];
    if raw.len() < PNG_MAGIC.len() {
        return Err("dock icon png bytes are too short".to_string());
    }
    if raw.get(..PNG_MAGIC.len()) != Some(&PNG_MAGIC) {
        return Err("dock icon payload is not a valid PNG".to_string());
    }
    // Guard IPC abuse / accidental huge blobs (catalog icons are ~300KB).
    const MAX_PNG_BYTES: usize = 4 * 1024 * 1024;
    if raw.len() > MAX_PNG_BYTES {
        return Err(format!(
            "dock icon png is too large ({} bytes, max {MAX_PNG_BYTES})",
            raw.len()
        ));
    }
    Ok(())
}

/// Decode PNG and apply as the window icon on every open window.
/// Used on Windows/Linux for taskbar/window chrome, and on macOS for parity.
///
/// Note (Win/Linux): icons are per-window. Windows created later need another
/// `set_dock_icon` call (or a new-window hook) to stay in sync.
fn apply_desktop_window_icons(app: &tauri::AppHandle, png_bytes: &[u8]) -> Result<u32, String> {
    use tauri::image::Image;
    use tauri::Manager;

    let image = Image::from_bytes(png_bytes)
        .map_err(|error| format!("failed to decode dock icon PNG: {error}"))?;
    let mut updated = 0u32;
    let mut failed = 0u32;
    for (label, window) in app.windows() {
        match window.set_icon(image.clone()) {
            Ok(()) => updated = updated.saturating_add(1),
            Err(error) => {
                failed = failed.saturating_add(1);
                // Wayland / some secondary labels may reject set_icon; keep going.
                log::warn!("failed to set window icon for '{label}': {error}");
            }
        }
    }
    if updated == 0 && failed > 0 {
        log::warn!(
            "dock icon: all {failed} window set_icon attempts failed on {}",
            std::env::consts::OS
        );
    }
    Ok(updated)
}

#[cfg(target_os = "macos")]
fn apply_macos_dock_icon(png_bytes: Option<&[u8]>) -> Result<(), String> {
    use objc2::AllocAnyThread;
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::{MainThreadMarker, NSData};

    // SAFETY: `run_on_main_thread` guarantees this closure executes on the main thread.
    let mtm = unsafe { MainThreadMarker::new_unchecked() };
    let app = NSApplication::sharedApplication(mtm);

    match png_bytes {
        None => {
            // Fallback only: restores the icon from the application bundle.
            unsafe {
                app.setApplicationIconImage(None);
            }
        }
        Some(bytes) => {
            let data = NSData::with_bytes(bytes);
            let image = NSImage::initWithData(NSImage::alloc(), &data)
                .ok_or_else(|| "failed to decode dock icon PNG".to_string())?;
            unsafe {
                app.setApplicationIconImage(Some(&image));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{clamp_window_opacity, validate_png_payload};

    #[test]
    fn clamps_window_opacity_to_readable_range() {
        assert_eq!(clamp_window_opacity(0.2).unwrap(), 0.55);
        assert_eq!(clamp_window_opacity(0.88).unwrap(), 0.88);
        assert_eq!(clamp_window_opacity(1.4).unwrap(), 1.0);
    }

    #[test]
    fn rejects_non_finite_window_opacity() {
        assert!(clamp_window_opacity(f64::NAN).is_err());
        assert!(clamp_window_opacity(f64::INFINITY).is_err());
    }

    #[test]
    fn accepts_png_magic_and_rejects_garbage() {
        let mut png = vec![0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];
        png.extend_from_slice(&[0u8; 16]);
        assert!(validate_png_payload(&png).is_ok());
        assert!(validate_png_payload(&[1, 2, 3, 4, 5, 6, 7, 8]).is_err());
        assert!(validate_png_payload(&[0x89, b'P']).is_err());
    }
}
