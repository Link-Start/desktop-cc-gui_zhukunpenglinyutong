// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Best-effort early rename; Dock badge is applied later once AppKit is ready.
    #[cfg(all(debug_assertions, target_os = "macos"))]
    cc_gui_lib::debug_identity::apply_debug_process_display_name();

    if let Err(err) = fix_path_env::fix() {
        eprintln!("Failed to sync PATH from shell: {err}");
    }
    cc_gui_lib::run()
}
