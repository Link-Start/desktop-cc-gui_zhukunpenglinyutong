//! Global DSH host supervisor: probe → adopt, else spawn. Kill only spawned.

use super::host::{origin_from_host_port, DshHostClient};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

const SPAWN_READY_TIMEOUT: Duration = Duration::from_secs(20);
const SPAWN_POLL: Duration = Duration::from_millis(250);

#[derive(Debug, Clone)]
pub struct DshRuntimeSettings {
    pub bin_path: Option<String>,
    pub host: String,
    pub port: u16,
    pub auto_start: bool,
}

impl Default for DshRuntimeSettings {
    fn default() -> Self {
        Self {
            bin_path: None,
            host: "127.0.0.1".to_string(),
            port: 3080,
            auto_start: true,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DshHostOwnership {
    Adopted,
    Spawned,
}

#[derive(Debug, Clone)]
pub struct DshHostSnapshot {
    pub origin: String,
    pub host: String,
    pub port: u16,
    pub ownership: DshHostOwnership,
    pub describe: serde_json::Value,
}

struct LiveHost {
    snapshot: DshHostSnapshot,
    child: Option<Child>,
}

struct SupervisorState {
    live: Option<LiveHost>,
    pending_child: Option<Child>,
    spawn_generation: u64,
}

static SUPERVISOR: OnceLock<Mutex<SupervisorState>> = OnceLock::new();
static REMEMBERED_ENDPOINT: OnceLock<std::sync::Mutex<Option<(String, u16)>>> = OnceLock::new();

fn remembered_endpoint_slot() -> &'static std::sync::Mutex<Option<(String, u16)>> {
    REMEMBERED_ENDPOINT.get_or_init(|| std::sync::Mutex::new(None))
}

pub fn remember_endpoint(host: &str, port: u16) {
    if let Ok(mut slot) = remembered_endpoint_slot().lock() {
        *slot = Some((host.to_string(), port));
    }
}

pub fn remembered_endpoint() -> Option<(String, u16)> {
    remembered_endpoint_slot()
        .lock()
        .ok()
        .and_then(|slot| slot.clone())
}

fn state() -> &'static Mutex<SupervisorState> {
    SUPERVISOR.get_or_init(|| {
        Mutex::new(SupervisorState {
            live: None,
            pending_child: None,
            spawn_generation: 0,
        })
    })
}

pub async fn current_snapshot() -> Option<DshHostSnapshot> {
    let guard = state().lock().await;
    guard.live.as_ref().map(|live| live.snapshot.clone())
}

pub async fn ensure_host(settings: &DshRuntimeSettings) -> Result<DshHostSnapshot, String> {
    remember_endpoint(&settings.host, settings.port);
    let wanted_origin = origin_from_host_port(&settings.host, settings.port);
    let spawn_generation = {
        let mut guard = state().lock().await;
        if let Some(live) = guard.live.as_ref() {
            let live_origin = live.snapshot.origin.clone();
            let live_snapshot = live.snapshot.clone();
            if live_origin == wanted_origin && probe_describe(&live_origin).await.is_ok() {
                return Ok(live_snapshot);
            }
            // Host/port changed or the live process died. Kill only a spawned
            // child that no longer matches the requested origin.
            drop_unlocked(&mut guard, live_origin != wanted_origin).await;
        }

        let origin = wanted_origin.clone();
        if let Ok(describe) = probe_describe(&origin).await {
            let snapshot = DshHostSnapshot {
                origin,
                host: settings.host.clone(),
                port: settings.port,
                ownership: DshHostOwnership::Adopted,
                describe,
            };
            guard.live = Some(LiveHost {
                snapshot: snapshot.clone(),
                child: None,
            });
            log::info!(
                "[dsh] adopted host {} (do not kill on mossx exit)",
                snapshot.origin
            );
            return Ok(snapshot);
        }

        if !settings.auto_start {
            return Err(format!(
                "DSH host is not running at {origin}. Start `dsh web` or enable auto-start."
            ));
        }

        let bin = resolve_dsh_bin(settings.bin_path.as_deref())?;
        let child = spawn_dsh_web(&bin, &settings.host, settings.port)?;
        if let Some(previous) = guard.pending_child.take() {
            let _ = kill_child(previous).await;
        }
        guard.spawn_generation = guard.spawn_generation.wrapping_add(1);
        let generation = guard.spawn_generation;
        guard.pending_child = Some(child);
        generation
    };

    let origin = wanted_origin;
    let wait_result = wait_until_ready(&origin).await;
    let mut guard = state().lock().await;
    let cancelled = guard.spawn_generation != spawn_generation;
    let pending = guard.pending_child.take();
    if cancelled {
        if let Some(child) = pending {
            let _ = kill_child(child).await;
        }
        return Err("DSH host start was cancelled.".to_string());
    }

    match wait_result {
        Ok(describe) => {
            let snapshot = DshHostSnapshot {
                origin,
                host: settings.host.clone(),
                port: settings.port,
                ownership: DshHostOwnership::Spawned,
                describe,
            };
            guard.live = Some(LiveHost {
                snapshot: snapshot.clone(),
                child: pending,
            });
            log::info!("[dsh] spawned host {}", snapshot.origin);
            Ok(snapshot)
        }
        Err(spawn_err) => {
            // Port may have been claimed by the user's own host while we spawned.
            if let Ok(describe) = probe_describe(&origin).await {
                if let Some(child) = pending {
                    let _ = kill_child(child).await;
                }
                let snapshot = DshHostSnapshot {
                    origin,
                    host: settings.host.clone(),
                    port: settings.port,
                    ownership: DshHostOwnership::Adopted,
                    describe,
                };
                guard.live = Some(LiveHost {
                    snapshot: snapshot.clone(),
                    child: None,
                });
                log::info!("[dsh] adopt-after-spawn-race {}", snapshot.origin);
                return Ok(snapshot);
            }
            if let Some(child) = pending {
                let _ = kill_child(child).await;
            }
            Err(classify_spawn_error(&origin, &spawn_err))
        }
    }
}

/// Probe an already-running host. Never spawn.
pub async fn connect_existing(settings: &DshRuntimeSettings) -> Result<DshHostSnapshot, String> {
    remember_endpoint(&settings.host, settings.port);
    let origin = origin_from_host_port(&settings.host, settings.port);
    if let Some(live) = current_snapshot().await {
        if live.origin == origin && probe_describe(&live.origin).await.is_ok() {
            return Ok(live);
        }
    }
    let describe = probe_describe(&origin).await?;
    Ok(DshHostSnapshot {
        origin,
        host: settings.host.clone(),
        port: settings.port,
        ownership: DshHostOwnership::Adopted,
        describe,
    })
}

/// Drop the supervisor handle. Adopted hosts are never killed.
pub async fn drop_host() {
    let mut guard = state().lock().await;
    abort_pending_unlocked(&mut guard).await;
    drop_unlocked(&mut guard, true).await;
}

/// Cancel an in-flight spawn. Adopted hosts stay running.
pub async fn cancel_start() -> Result<(), String> {
    stop_host(&DshRuntimeSettings::default()).await
}

/// Stop a settings-page start or a live local host. Remote origins are never killed.
pub async fn stop_host(settings: &DshRuntimeSettings) -> Result<(), String> {
    let origin = origin_from_host_port(&settings.host, settings.port);
    let live = {
        let mut guard = state().lock().await;
        abort_pending_unlocked(&mut guard).await;
        guard.live.take()
    };
    if let Some(mut live) = live {
        if let Some(child) = live.child.take() {
            let _ = kill_child(child).await;
            log::info!("[dsh] stopped spawned host {}", live.snapshot.origin);
        }
    }
    if !is_local_host(&settings.host) {
        return Err("只能停掉本机 DSH host。远程地址不会被 mossx 关闭。".to_string());
    }
    if probe_describe(&origin).await.is_ok() {
        terminate_local_listener(settings.port)?;
        log::info!("[dsh] stopped local listener at {origin}");
    }
    Ok(())
}

fn is_local_host(host: &str) -> bool {
    matches!(
        host.trim().to_ascii_lowercase().as_str(),
        "127.0.0.1" | "localhost" | "::1" | "0.0.0.0" | "[::1]" | "[::]"
    )
}

#[cfg(unix)]
fn terminate_local_listener(port: u16) -> Result<(), String> {
    let output = crate::utils::std_command("lsof")
        .arg("-n")
        .arg("-P")
        .arg("-t")
        .arg(format!("-iTCP:{port}"))
        .arg("-sTCP:LISTEN")
        .output()
        .map_err(|error| format!("failed to inspect port {port}: {error}"))?;
    let pids = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| line.trim().parse::<u32>().ok())
        .collect::<Vec<_>>();
    if pids.is_empty() {
        return Ok(());
    }
    for pid in pids {
        let status = crate::utils::std_command("kill")
            .arg("-TERM")
            .arg(pid.to_string())
            .status()
            .map_err(|error| format!("failed to stop pid {pid}: {error}"))?;
        if !status.success() {
            let _ = crate::utils::std_command("kill")
                .arg("-KILL")
                .arg(pid.to_string())
                .status();
        }
    }
    Ok(())
}

#[cfg(windows)]
fn terminate_local_listener(port: u16) -> Result<(), String> {
    let output = crate::utils::std_command("netstat")
        .arg("-ano")
        .arg("-p")
        .arg("tcp")
        .output()
        .map_err(|error| format!("failed to inspect port {port}: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let needle = format!(":{port}");
    let mut pids = Vec::new();
    for line in stdout.lines() {
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.len() < 5 || !cols[3].eq_ignore_ascii_case("LISTENING") {
            continue;
        }
        if cols[1].ends_with(&needle) {
            if let Ok(pid) = cols[4].parse::<u32>() {
                pids.push(pid);
            }
        }
    }
    for pid in pids {
        let _ = crate::utils::std_command("taskkill")
            .arg("/PID")
            .arg(pid.to_string())
            .arg("/T")
            .arg("/F")
            .status();
    }
    Ok(())
}

#[cfg(not(any(unix, windows)))]
fn terminate_local_listener(_port: u16) -> Result<(), String> {
    Err("stopping a local DSH host is not supported on this platform".to_string())
}

async fn abort_pending_unlocked(guard: &mut SupervisorState) {
    guard.spawn_generation = guard.spawn_generation.wrapping_add(1);
    if let Some(child) = guard.pending_child.take() {
        let _ = kill_child(child).await;
        log::info!("[dsh] cancelled pending host spawn");
    }
}

fn should_kill_host(ownership: DshHostOwnership, kill_spawned: bool) -> bool {
    kill_spawned && ownership == DshHostOwnership::Spawned
}

async fn drop_unlocked(guard: &mut SupervisorState, kill_spawned: bool) {
    let Some(mut live) = guard.live.take() else {
        return;
    };
    if should_kill_host(live.snapshot.ownership, kill_spawned) {
        if let Some(child) = live.child.take() {
            let _ = kill_child(child).await;
            log::info!("[dsh] stopped spawned host {}", live.snapshot.origin);
        }
    } else if live.snapshot.ownership == DshHostOwnership::Adopted {
        log::info!(
            "[dsh] leaving adopted host {} running",
            live.snapshot.origin
        );
    }
}

pub async fn probe_describe(origin: &str) -> Result<serde_json::Value, String> {
    let client = DshHostClient::new(origin.to_string())?;
    client.describe().await
}

pub fn resolve_dsh_bin(custom: Option<&str>) -> Result<String, String> {
    if let Some(custom) = custom.map(str::trim).filter(|value| !value.is_empty()) {
        let path = std::path::PathBuf::from(custom);
        if path.exists() {
            return Ok(custom.to_string());
        }
        return Err(format!("DSH binary not found: {custom}"));
    }
    crate::backend::app_server::find_cli_binary("dsh", None)
        .map(|path| path.to_string_lossy().to_string())
        .ok_or_else(|| "dsh CLI is not installed".to_string())
}

fn spawn_dsh_web(bin: &str, host: &str, port: u16) -> Result<Child, String> {
    let mut cmd = build_command(bin);
    cmd.arg("web")
        .arg("--host")
        .arg(host)
        .arg("--port")
        .arg(port.to_string())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(false);
    if let Some(path_env) = crate::backend::app_server::build_codex_path_env(Some(bin)) {
        cmd.env("PATH", path_env);
    }
    cmd.spawn()
        .map_err(|error| format!("failed to spawn `{bin} web --host {host} --port {port}`: {error}"))
}

fn classify_spawn_error(origin: &str, spawn_err: &str) -> String {
    if spawn_err.contains("HTTP")
        || spawn_err.contains("connection refused")
        || spawn_err.contains("timed out")
        || spawn_err.contains("os error 48")
        || spawn_err.contains("Address already in use")
        || spawn_err.contains("address already in use")
    {
        return format!(
            "port at {origin} is occupied by a non-DSH process or the spawned host never answered host.describe. Change dshPort or stop the other process. ({spawn_err})"
        );
    }
    spawn_err.to_string()
}

async fn wait_until_ready(origin: &str) -> Result<serde_json::Value, String> {
    let deadline = tokio::time::Instant::now() + SPAWN_READY_TIMEOUT;
    let mut last_error = "host.describe not ready".to_string();
    while tokio::time::Instant::now() < deadline {
        match probe_describe(origin).await {
            Ok(describe) => return Ok(describe),
            Err(error) => last_error = error,
        }
        tokio::time::sleep(SPAWN_POLL).await;
    }
    Err(format!(
        "spawned dsh web did not become ready at {origin}: {last_error}"
    ))
}

async fn kill_child(mut child: Child) -> Result<(), String> {
    match child.kill().await {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::InvalidInput => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn build_command(bin: &str) -> Command {
    #[cfg(windows)]
    {
        let bin_lower = bin.to_lowercase();
        if bin_lower.ends_with(".cmd") || bin_lower.ends_with(".bat") {
            let mut cmd = crate::utils::async_command("cmd");
            cmd.arg("/c");
            cmd.arg(bin);
            return cmd;
        }
    }
    crate::utils::async_command(bin)
}

pub fn client_for_snapshot(snapshot: &DshHostSnapshot) -> Result<Arc<DshHostClient>, String> {
    Ok(Arc::new(DshHostClient::new(snapshot.origin.clone())?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drop_kills_only_spawned_hosts() {
        assert!(should_kill_host(DshHostOwnership::Spawned, true));
        assert!(!should_kill_host(DshHostOwnership::Adopted, true));
        assert!(!should_kill_host(DshHostOwnership::Spawned, false));
        assert!(!should_kill_host(DshHostOwnership::Adopted, false));
    }

    #[test]
    fn stop_only_targets_loopback_hosts() {
        assert!(is_local_host("127.0.0.1"));
        assert!(is_local_host("localhost"));
        assert!(!is_local_host("10.0.0.8"));
    }
}
