//! TokenTracker CLI integration
//!
//! The TokenTracker usage dashboard is served by a local HTTP server from the
//! globally-installed `tokentracker-cli` npm package (`tokentracker serve`,
//! bound to 127.0.0.1). That server does not emit CORS headers, so all webview
//! data requests are tunneled through the [`tt_proxy`] command.

use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tokio::time::timeout;

use crate::backend::app_server::{build_cli_path_env, find_cli_binary};

/// Same npm package exposes several bin aliases; probe them in order.
const TT_BIN_CANDIDATES: [&str; 3] = ["tokentracker", "tracker", "tokentracker-cli"];
/// Default port used by `tokentracker serve`.
const TT_DEFAULT_PORT: u16 = 7680;
/// Ports scanned by [`tt_server_status`] when looking for a running server.
const TT_STATUS_SCAN_PORTS: std::ops::RangeInclusive<u16> = 7680..=7684;
/// Ports considered when starting a new server (avoid killing an occupant:
/// `tokentracker serve --port` kills whatever already holds the port).
const TT_ENSURE_PORT_RANGE: std::ops::RangeInclusive<u16> = 7680..=7690;
/// Health/readiness endpoint used to detect a running server.
const TT_USER_STATUS_PATH: &str = "/functions/tokentracker-user-status";
/// Timeout for a single server probe.
const TT_STATUS_TIMEOUT: Duration = Duration::from_millis(800);
/// Timeout for proxied requests.
const TT_PROXY_TIMEOUT: Duration = Duration::from_secs(20);
/// Timeout for `<bin> --version` detection.
const TT_DETECTION_TIMEOUT: Duration = Duration::from_secs(10);
/// Timeout for `npm install -g tokentracker-cli`.
const TT_INSTALL_TIMEOUT: Duration = Duration::from_secs(180);
/// Max wait for a freshly spawned server to become ready.
const TT_READY_TIMEOUT: Duration = Duration::from_secs(20);
/// Interval between readiness probes.
const TT_READY_POLL_INTERVAL: Duration = Duration::from_millis(500);

/// Port of the server we started or last found running.
/// Never held across an `.await` point.
static TT_SERVER_PORT: Mutex<Option<u16>> = Mutex::new(None);

fn remembered_port() -> Option<u16> {
    TT_SERVER_PORT.lock().ok().and_then(|guard| *guard)
}

fn store_port(port: u16) {
    if let Ok(mut guard) = TT_SERVER_PORT.lock() {
        *guard = Some(port);
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TtCliStatus {
    installed: bool,
    version: Option<String>,
    bin_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TtServerStatus {
    running: bool,
    port: u16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TtInstallResult {
    installed: bool,
    version: Option<String>,
    bin_path: Option<String>,
}

/// Build a tokio Command that correctly handles .cmd/.bat files on Windows
/// (mirrors `engine::status::build_async_command`).
#[allow(unused_variables)]
fn build_async_command(bin: &str) -> tokio::process::Command {
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

/// Build a std Command that correctly handles .cmd/.bat files on Windows.
#[allow(unused_variables)]
fn build_std_command(bin: &str) -> std::process::Command {
    #[cfg(windows)]
    {
        let bin_lower = bin.to_lowercase();
        if bin_lower.ends_with(".cmd") || bin_lower.ends_with(".bat") {
            let mut cmd = crate::utils::std_command("cmd");
            cmd.arg("/c");
            cmd.arg(bin);
            return cmd;
        }
    }
    crate::utils::std_command(bin)
}

/// Probe a resolved binary with `--version`, returning the first stdout line.
async fn probe_tt_version(bin: &str) -> Option<String> {
    let path_env = build_cli_path_env(None);
    let result = timeout(TT_DETECTION_TIMEOUT, async {
        let mut cmd = build_async_command(bin);
        if let Some(path) = path_env {
            cmd.env("PATH", path);
        }
        cmd.arg("--version")
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .output()
            .await
    })
    .await;

    match result {
        Ok(Ok(output)) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let first_line = stdout
                .lines()
                .next()
                .unwrap_or_default()
                .trim()
                .to_string();
            if first_line.is_empty() {
                None
            } else {
                Some(first_line)
            }
        }
        _ => None,
    }
}

/// Detect the globally-installed TokenTracker CLI.
async fn detect_cli() -> TtCliStatus {
    // GUI apps on macOS do not inherit the shell PATH that contains the npm
    // global bin directory; repair it before probing.
    if let Err(err) = fix_path_env::fix() {
        log::warn!("tokentracker: failed to sync PATH from shell: {err}");
    }

    for name in TT_BIN_CANDIDATES {
        let Some(bin_path) = find_cli_binary(name, None) else {
            continue;
        };
        let bin = bin_path.to_string_lossy().to_string();
        let version = probe_tt_version(&bin).await;
        return TtCliStatus {
            installed: true,
            version,
            bin_path: Some(bin),
        };
    }

    TtCliStatus {
        installed: false,
        version: None,
        bin_path: None,
    }
}

fn output_snippet(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes)
        .chars()
        .take(800)
        .collect::<String>()
        .trim()
        .to_string()
}

fn resolve_npm_bin() -> String {
    find_cli_binary("npm", None)
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_else(|| "npm".to_string())
}

async fn install_cli() -> Result<TtInstallResult, String> {
    if let Err(err) = fix_path_env::fix() {
        log::warn!("tokentracker: failed to sync PATH before install: {err}");
    }

    let npm_bin = resolve_npm_bin();
    log::info!("tokentracker: installing tokentracker-cli via npm");
    let result = timeout(TT_INSTALL_TIMEOUT, async {
        let mut cmd = build_async_command(&npm_bin);
        if let Some(path) = build_cli_path_env(None) {
            cmd.env("PATH", path);
        }
        cmd.arg("install")
            .arg("-g")
            .arg("tokentracker-cli")
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .output()
            .await
    })
    .await
    .map_err(|_| {
        format!(
            "tokentracker-cli install timed out after {}s",
            TT_INSTALL_TIMEOUT.as_secs()
        )
    })?
    .map_err(|error| format!("failed to run npm install for tokentracker-cli: {error}"))?;

    if !result.status.success() {
        let stderr = output_snippet(&result.stderr);
        let stdout = output_snippet(&result.stdout);
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        return Err(format!(
            "tokentracker-cli install failed with status {}{}",
            result.status,
            if detail.is_empty() {
                String::new()
            } else {
                format!(": {detail}")
            }
        ));
    }

    let cli = detect_cli().await;
    if !cli.installed {
        return Err("tokentracker-cli install completed but CLI was not found on PATH".to_string());
    }

    Ok(TtInstallResult {
        installed: true,
        version: cli.version,
        bin_path: cli.bin_path,
    })
}

fn build_http_client(request_timeout: Duration) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(request_timeout)
        .timeout(request_timeout)
        .build()
        .map_err(|error| format!("Failed to build HTTP client: {error}"))
}

/// A server counts as running when the user-status endpoint answers HTTP 200
/// with a JSON object body.
async fn probe_server_on_port(client: &reqwest::Client, port: u16) -> bool {
    let url = format!("http://127.0.0.1:{port}{TT_USER_STATUS_PATH}");
    let Ok(response) = client.get(&url).send().await else {
        return false;
    };
    if response.status() != reqwest::StatusCode::OK {
        return false;
    }
    let Ok(body) = response.text().await else {
        return false;
    };
    serde_json::from_str::<serde_json::Value>(&body)
        .map(|value| value.is_object())
        .unwrap_or(false)
}

/// Probe the remembered port first, then the default scan range.
async fn detect_server_status() -> TtServerStatus {
    let fallback_port = remembered_port().unwrap_or(TT_DEFAULT_PORT);
    let client = match build_http_client(TT_STATUS_TIMEOUT) {
        Ok(client) => client,
        Err(err) => {
            log::warn!("tokentracker: {err}");
            return TtServerStatus {
                running: false,
                port: fallback_port,
            };
        }
    };

    let mut candidates: Vec<u16> = Vec::new();
    if let Some(port) = remembered_port() {
        candidates.push(port);
    }
    for port in TT_STATUS_SCAN_PORTS {
        if !candidates.contains(&port) {
            candidates.push(port);
        }
    }

    for port in candidates {
        if probe_server_on_port(&client, port).await {
            store_port(port);
            return TtServerStatus {
                running: true,
                port,
            };
        }
    }

    TtServerStatus {
        running: false,
        port: fallback_port,
    }
}

/// Find a port in [`TT_ENSURE_PORT_RANGE`] that is free right now.
fn find_free_port() -> Option<u16> {
    for port in TT_ENSURE_PORT_RANGE {
        if std::net::TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Some(port);
        }
    }
    None
}

/// Spawn `tokentracker serve` detached. The child handle is dropped on purpose
/// so the server keeps running after this call (matching the official
/// TokenTracker desktop client's behavior); it must not be killed on drop.
fn spawn_server(bin: &str, port: u16) -> Result<(), String> {
    let mut cmd = build_std_command(bin);
    cmd.arg("serve")
        .arg("--no-open")
        .arg("--port")
        .arg(port.to_string())
        .env("TOKENTRACKER_NO_TELEMETRY", "1")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    if let Some(path_env) = build_cli_path_env(None) {
        cmd.env("PATH", path_env);
    }
    cmd.spawn()
        .map_err(|error| format!("Failed to start tokentracker server: {error}"))?;
    Ok(())
}

/// Detect whether the TokenTracker CLI is installed globally.
#[tauri::command]
pub(crate) async fn tt_detect_cli() -> Result<TtCliStatus, String> {
    Ok(detect_cli().await)
}

/// Detect whether the local TokenTracker server is running.
#[tauri::command]
pub(crate) async fn tt_server_status() -> Result<TtServerStatus, String> {
    Ok(detect_server_status().await)
}

/// Install the TokenTracker CLI globally with npm.
#[tauri::command]
pub(crate) async fn tt_install_cli() -> Result<TtInstallResult, String> {
    install_cli().await
}

/// Ensure the local TokenTracker server is running, starting it if needed.
#[tauri::command]
pub(crate) async fn tt_ensure_server() -> Result<TtServerStatus, String> {
    let status = detect_server_status().await;
    if status.running {
        return Ok(status);
    }

    let cli = detect_cli().await;
    if !cli.installed {
        return Err("tokentracker_cli_not_installed".to_string());
    }
    let bin = cli
        .bin_path
        .clone()
        .ok_or_else(|| "tokentracker_cli_not_installed".to_string())?;

    let port = find_free_port()
        .ok_or_else(|| "No free port for tokentracker server (7680-7690)".to_string())?;

    spawn_server(&bin, port)?;

    let client = build_http_client(TT_STATUS_TIMEOUT)?;
    let deadline = Instant::now() + TT_READY_TIMEOUT;
    loop {
        if probe_server_on_port(&client, port).await {
            store_port(port);
            return Ok(TtServerStatus {
                running: true,
                port,
            });
        }
        if Instant::now() >= deadline {
            return Err(format!(
                "tokentracker server did not become ready on port {port} within {}s",
                TT_READY_TIMEOUT.as_secs()
            ));
        }
        tokio::time::sleep(TT_READY_POLL_INTERVAL).await;
    }
}

/// Proxy a request to the local TokenTracker server (bypasses webview CORS).
///
/// `path` may include a query string and is passed through verbatim, but must
/// match the allowlist: `/functions/tokentracker-*` or `/api/local-auth`.
#[tauri::command]
pub(crate) async fn tt_proxy(
    method: String,
    path: String,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
) -> Result<serde_json::Value, String> {
    let path_only = path.split('?').next().unwrap_or(path.as_str());
    if !(path_only.starts_with("/functions/tokentracker-") || path_only == "/api/local-auth") {
        return Err(format!("tokentracker proxy path not allowed: {path}"));
    }

    let http_method = match method.trim().to_ascii_uppercase().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        other => return Err(format!("tokentracker proxy method not allowed: {other}")),
    };

    let port = remembered_port().unwrap_or(TT_DEFAULT_PORT);
    let url = format!("http://127.0.0.1:{port}{path}");
    let client = build_http_client(TT_PROXY_TIMEOUT)?;

    let mut request = client.request(http_method, &url);
    if let Some(headers) = headers {
        for (name, value) in headers {
            let Ok(header_name) = reqwest::header::HeaderName::from_bytes(name.as_bytes()) else {
                continue;
            };
            let Ok(header_value) = reqwest::header::HeaderValue::from_str(&value) else {
                continue;
            };
            request = request.header(header_name, header_value);
        }
    }
    if let Some(body) = body {
        request = request.body(body);
    }

    let response = request
        .send()
        .await
        .map_err(|error| format!("tokentracker server unreachable: {error}"))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| format!("Failed to read tokentracker response body: {error}"))?;
    if !status.is_success() {
        let snippet: String = text.chars().take(500).collect();
        return Err(format!(
            "tokentracker server returned HTTP {status}: {snippet}"
        ));
    }
    serde_json::from_str::<serde_json::Value>(&text)
        .map_err(|error| format!("Failed to parse tokentracker response as JSON: {error}"))
}
