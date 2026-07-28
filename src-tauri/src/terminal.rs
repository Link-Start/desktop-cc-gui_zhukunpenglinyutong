use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Arc;

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;

use crate::backend::events::{EventSink, TerminalOutput};
use crate::event_sink::build_event_sink;
use crate::state::AppState;
use crate::types::AppSettings;

pub(crate) struct TerminalSession {
    pub(crate) id: String,
    pub(crate) master: Mutex<Box<dyn portable_pty::MasterPty + Send>>,
    pub(crate) writer: Mutex<Box<dyn Write + Send>>,
    pub(crate) child: Mutex<Box<dyn portable_pty::Child + Send>>,
}

#[derive(Debug, Serialize, Clone)]
pub(crate) struct TerminalSessionInfo {
    id: String,
}

fn terminal_key(workspace_id: &str, terminal_id: &str) -> String {
    format!("{workspace_id}:{terminal_id}")
}

fn default_shell_path() -> String {
    #[cfg(windows)]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    }
    #[cfg(not(windows))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    }
}

fn resolve_terminal_shell_path(settings: &AppSettings) -> String {
    settings
        .terminal_shell_path
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(default_shell_path)
}

fn resolve_locale() -> String {
    let candidate = std::env::var("LC_ALL")
        .or_else(|_| std::env::var("LANG"))
        .unwrap_or_else(|_| "en_US.UTF-8".to_string());
    let lower = candidate.to_lowercase();
    if lower.contains("utf-8") || lower.contains("utf8") {
        return candidate;
    }
    "en_US.UTF-8".to_string()
}

fn spawn_terminal_reader(
    app: AppHandle,
    event_sink: impl EventSink,
    workspace_id: String,
    terminal_id: String,
    session: Arc<TerminalSession>,
    mut reader: Box<dyn Read + Send>,
) {
    std::thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        let mut pending: Vec<u8> = Vec::new();
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(count) => {
                    pending.extend_from_slice(&buffer[..count]);
                    loop {
                        match std::str::from_utf8(&pending) {
                            Ok(decoded) => {
                                if !decoded.is_empty() {
                                    let payload = TerminalOutput {
                                        workspace_id: workspace_id.clone(),
                                        terminal_id: terminal_id.clone(),
                                        data: decoded.to_string(),
                                    };
                                    event_sink.emit_terminal_output(payload);
                                }
                                pending.clear();
                                break;
                            }
                            Err(error) => {
                                let valid_up_to = error.valid_up_to();
                                if valid_up_to == 0 {
                                    if error.error_len().is_none() {
                                        break;
                                    }
                                    let invalid_len = error.error_len().unwrap_or(1);
                                    pending.drain(..invalid_len.min(pending.len()));
                                    continue;
                                }
                                let chunk =
                                    String::from_utf8_lossy(&pending[..valid_up_to]).to_string();
                                if !chunk.is_empty() {
                                    let payload = TerminalOutput {
                                        workspace_id: workspace_id.clone(),
                                        terminal_id: terminal_id.clone(),
                                        data: chunk,
                                    };
                                    event_sink.emit_terminal_output(payload);
                                }
                                pending.drain(..valid_up_to);
                                if error.error_len().is_none() {
                                    break;
                                }
                                let invalid_len = error.error_len().unwrap_or(1);
                                pending.drain(..invalid_len.min(pending.len()));
                            }
                        }
                    }
                }
                Err(_) => break,
            }
        }
        let key = terminal_key(&workspace_id, &terminal_id);
        tauri::async_runtime::block_on(async move {
            let state = app.state::<AppState>();
            remove_terminal_session_if_current(&state.terminal_sessions, &key, &session).await;
        });
    });
}

async fn remove_terminal_session_if_current(
    sessions: &Mutex<std::collections::HashMap<String, Arc<TerminalSession>>>,
    key: &str,
    session: &Arc<TerminalSession>,
) {
    let mut sessions = sessions.lock().await;
    if sessions
        .get(key)
        .is_some_and(|current| Arc::ptr_eq(current, session))
    {
        sessions.remove(key);
    }
}

async fn kill_terminal_session(session: Arc<TerminalSession>) {
    let mut child = session.child.lock().await;
    let _ = child.kill();
}

pub(crate) async fn cleanup_terminal_sessions_for_workspace(state: &AppState, workspace_id: &str) {
    let removed_sessions = {
        let mut sessions = state.terminal_sessions.lock().await;
        let keys_to_remove: Vec<String> = sessions
            .keys()
            .filter(|key| key.starts_with(&format!("{workspace_id}:")))
            .cloned()
            .collect();
        keys_to_remove
            .into_iter()
            .filter_map(|key| sessions.remove(&key))
            .collect::<Vec<_>>()
    };

    for session in removed_sessions {
        kill_terminal_session(session).await;
    }
}

pub(crate) async fn cleanup_all_terminal_sessions(state: &AppState) {
    let removed_sessions = {
        let mut sessions = state.terminal_sessions.lock().await;
        sessions
            .drain()
            .map(|(_, session)| session)
            .collect::<Vec<_>>()
    };

    for session in removed_sessions {
        kill_terminal_session(session).await;
    }
}

async fn get_workspace_path(
    workspace_id: &str,
    state: &State<'_, AppState>,
) -> Result<PathBuf, String> {
    let workspaces = state.workspaces.lock().await;
    let entry = workspaces
        .get(workspace_id)
        .ok_or_else(|| "Unknown workspace".to_string())?;
    Ok(PathBuf::from(&entry.path))
}

#[tauri::command]
pub(crate) async fn terminal_open(
    workspace_id: String,
    terminal_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<TerminalSessionInfo, String> {
    if terminal_id.is_empty() {
        return Err("Terminal id is required".to_string());
    }
    let key = terminal_key(&workspace_id, &terminal_id);
    {
        let sessions = state.terminal_sessions.lock().await;
        if let Some(existing) = sessions.get(&key) {
            return Ok(TerminalSessionInfo {
                id: existing.id.clone(),
            });
        }
    }

    let cwd = get_workspace_path(&workspace_id, &state).await?;
    let pty_system = native_pty_system();
    let size = PtySize {
        rows: rows.max(2),
        cols: cols.max(2),
        pixel_width: 0,
        pixel_height: 0,
    };
    let pair = pty_system
        .openpty(size)
        .map_err(|e| format!("Failed to open pty: {e}"))?;

    let shell_path = {
        let settings = state.app_settings.lock().await;
        resolve_terminal_shell_path(&settings)
    };
    let mut cmd = CommandBuilder::new(shell_path);
    cmd.cwd(cwd);
    // On Unix, pass -i for interactive shell; cmd.exe on Windows doesn't support it
    #[cfg(not(windows))]
    cmd.arg("-i");
    cmd.env("TERM", "xterm-256color");
    let locale = resolve_locale();
    cmd.env("LANG", &locale);
    cmd.env("LC_ALL", &locale);
    cmd.env("LC_CTYPE", &locale);

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {e}"))?;
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to open pty reader: {e}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to open pty writer: {e}"))?;

    let session = Arc::new(TerminalSession {
        id: terminal_id.clone(),
        master: Mutex::new(pair.master),
        writer: Mutex::new(writer),
        child: Mutex::new(child),
    });
    let session_id = session.id.clone();

    {
        let mut sessions = state.terminal_sessions.lock().await;
        if let Some(existing) = sessions.get(&key) {
            let mut child = session.child.lock().await;
            let _ = child.kill();
            return Ok(TerminalSessionInfo {
                id: existing.id.clone(),
            });
        }
        sessions.insert(key, Arc::clone(&session));
    }
    let event_sink = build_event_sink(app.clone());
    spawn_terminal_reader(app, event_sink, workspace_id, terminal_id, Arc::clone(&session), reader);

    Ok(TerminalSessionInfo { id: session_id })
}

#[tauri::command]
pub(crate) async fn terminal_write(
    workspace_id: String,
    terminal_id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let key = terminal_key(&workspace_id, &terminal_id);
    let sessions = state.terminal_sessions.lock().await;
    let session = sessions
        .get(&key)
        .ok_or_else(|| "Terminal session not found".to_string())?;
    let mut writer = session.writer.lock().await;
    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to pty: {e}"))?;
    writer
        .flush()
        .map_err(|e| format!("Failed to flush pty: {e}"))?;
    Ok(())
}

#[tauri::command]
pub(crate) async fn terminal_resize(
    workspace_id: String,
    terminal_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let key = terminal_key(&workspace_id, &terminal_id);
    let sessions = state.terminal_sessions.lock().await;
    let session = sessions
        .get(&key)
        .ok_or_else(|| "Terminal session not found".to_string())?;
    let size = PtySize {
        rows: rows.max(2),
        cols: cols.max(2),
        pixel_width: 0,
        pixel_height: 0,
    };
    let master = session.master.lock().await;
    master
        .resize(size)
        .map_err(|e| format!("Failed to resize pty: {e}"))?;
    Ok(())
}

#[tauri::command]
pub(crate) async fn terminal_close(
    workspace_id: String,
    terminal_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let key = terminal_key(&workspace_id, &terminal_id);
    let mut sessions = state.terminal_sessions.lock().await;
    let session = sessions
        .remove(&key)
        .ok_or_else(|| "Terminal session not found".to_string())?;
    kill_terminal_session(session).await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::sync::Arc;

    use super::remove_terminal_session_if_current;
    use portable_pty::{native_pty_system, CommandBuilder, PtySize};
    use tokio::sync::Mutex;

    use super::resolve_terminal_shell_path;
    use crate::types::AppSettings;

    fn build_test_terminal_session() -> Arc<super::TerminalSession> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: 2,
                cols: 2,
                pixel_width: 0,
                pixel_height: 0,
            })
            .expect("open test pty");
        let shell_path = super::default_shell_path();
        let mut cmd = CommandBuilder::new(shell_path);
        #[cfg(not(windows))]
        cmd.arg("-i");
        let child = pair
            .slave
            .spawn_command(cmd)
            .expect("spawn test shell");
        let writer = pair.master.take_writer().expect("take test writer");
        Arc::new(super::TerminalSession {
            id: "terminal-test".to_string(),
            master: Mutex::new(pair.master),
            writer: Mutex::new(writer),
            child: Mutex::new(child),
        })
    }

    #[test]
    fn resolve_terminal_shell_path_prefers_configured_path() {
        let mut settings = AppSettings::default();
        settings.terminal_shell_path =
            Some("  C:\\Program Files\\PowerShell\\7\\pwsh.exe  ".to_string());

        assert_eq!(
            resolve_terminal_shell_path(&settings),
            "C:\\Program Files\\PowerShell\\7\\pwsh.exe"
        );
    }

    #[tokio::test]
    async fn remove_terminal_session_if_current_only_removes_matching_session() {
        let session = build_test_terminal_session();
        let replacement = build_test_terminal_session();
        let sessions: Mutex<HashMap<String, Arc<super::TerminalSession>>> =
            Mutex::new(HashMap::from([("workspace:terminal".to_string(), Arc::clone(&session))]));

        remove_terminal_session_if_current(&sessions, "workspace:terminal", &replacement).await;
        assert!(sessions.lock().await.contains_key("workspace:terminal"));

        remove_terminal_session_if_current(&sessions, "workspace:terminal", &session).await;
        assert!(!sessions.lock().await.contains_key("workspace:terminal"));
    }
}
