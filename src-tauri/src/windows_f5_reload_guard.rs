/// WebView2 virtual-key for F5. Browser refresh is a WebView2 accelerator
/// processed before page JS, so renderer `preventDefault` is not reliable.
const VK_F5: u32 = 0x74;
const KEY_EVENT_KIND_KEY_DOWN: i32 = 0;
const KEY_EVENT_KIND_SYSTEM_KEY_DOWN: i32 = 2;

pub(crate) fn is_windows_f5_reload_key(virtual_key: u32, key_event_kind: i32) -> bool {
    virtual_key == VK_F5
        && (key_event_kind == KEY_EVENT_KIND_KEY_DOWN
            || key_event_kind == KEY_EVENT_KIND_SYSTEM_KEY_DOWN)
}

/// Block WebView2's native F5 / Ctrl+F5 / Shift+F5 / Alt+F5 refresh on the
/// main desktop window. Do not install on Browser Agent child webviews.
#[cfg(target_os = "windows")]
pub(crate) fn install_on_main_window(window: &tauri::WebviewWindow) {
    if let Err(error) = window.with_webview(|platform| {
        if let Err(error) = install_accelerator_guard(platform.controller()) {
            log::warn!("failed to install Windows F5 reload guard: {error}");
        }
    }) {
        log::warn!("failed to access Windows webview for F5 reload guard: {error}");
    }
}

#[cfg(target_os = "windows")]
fn install_accelerator_guard(
    controller: webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller,
) -> Result<(), String> {
    use webview2_com::{
        AcceleratorKeyPressedEventHandler,
        Microsoft::Web::WebView2::Win32::COREWEBVIEW2_KEY_EVENT_KIND,
    };

    let mut token = 0i64;
    unsafe {
        controller
            .add_AcceleratorKeyPressed(
                &AcceleratorKeyPressedEventHandler::create(Box::new(move |_, args| {
                    let Some(args) = args else {
                        return Ok(());
                    };
                    let mut kind = COREWEBVIEW2_KEY_EVENT_KIND::default();
                    let mut virtual_key = 0u32;
                    args.KeyEventKind(&mut kind)?;
                    args.VirtualKey(&mut virtual_key)?;
                    if is_windows_f5_reload_key(virtual_key, kind.0) {
                        args.SetHandled(true)?;
                    }
                    Ok(())
                })),
                &mut token,
            )
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        is_windows_f5_reload_key, KEY_EVENT_KIND_KEY_DOWN, KEY_EVENT_KIND_SYSTEM_KEY_DOWN, VK_F5,
    };

    #[test]
    fn blocks_f5_keydown_and_system_keydown() {
        assert!(is_windows_f5_reload_key(VK_F5, KEY_EVENT_KIND_KEY_DOWN));
        assert!(is_windows_f5_reload_key(
            VK_F5,
            KEY_EVENT_KIND_SYSTEM_KEY_DOWN
        ));
    }

    #[test]
    fn ignores_f5_keyup_and_other_keys() {
        const KEY_EVENT_KIND_KEY_UP: i32 = 1;
        const VK_R: u32 = 0x52;
        const VK_F12: u32 = 0x7B;

        assert!(!is_windows_f5_reload_key(VK_F5, KEY_EVENT_KIND_KEY_UP));
        assert!(!is_windows_f5_reload_key(VK_R, KEY_EVENT_KIND_KEY_DOWN));
        assert!(!is_windows_f5_reload_key(VK_F12, KEY_EVENT_KIND_KEY_DOWN));
    }
}
