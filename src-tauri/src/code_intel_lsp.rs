use std::collections::{hash_map::DefaultHasher, HashMap};
use std::ffi::OsString;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Weak};
use std::time::{Duration, Instant};

use serde_json::{json, Value};
use tokio::io::{AsyncBufRead, AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin};
use tokio::sync::{oneshot, Mutex};
use tokio::time::timeout;

use crate::backend::app_server::{build_cli_path_env, find_cli_binary};
use crate::utils::async_command;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(6);
const DEFAULT_INITIALIZE_TIMEOUT: Duration = Duration::from_secs(10);
const JAVA_INITIALIZE_TIMEOUT: Duration = Duration::from_secs(30);
const SESSION_IDLE_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const MAX_SESSIONS: usize = 6;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum SemanticProvider {
    RustAnalyzer,
    EclipseJdtLs,
    TypeScriptLanguageServer,
}

impl SemanticProvider {
    pub(crate) fn id(self) -> &'static str {
        match self {
            Self::RustAnalyzer => "rust-analyzer",
            Self::EclipseJdtLs => "eclipse-jdt-ls",
            Self::TypeScriptLanguageServer => "typescript-language-server",
        }
    }

    fn language_id(self, file: &Path) -> &'static str {
        match self {
            Self::RustAnalyzer => "rust",
            Self::EclipseJdtLs => "java",
            Self::TypeScriptLanguageServer => match file
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase()
                .as_str()
            {
                "tsx" => "typescriptreact",
                "js" | "mjs" | "cjs" => "javascript",
                "jsx" => "javascriptreact",
                _ => "typescript",
            },
        }
    }

    fn override_env(self) -> &'static str {
        match self {
            Self::RustAnalyzer => "MOSSX_RUST_ANALYZER_BIN",
            Self::EclipseJdtLs => "MOSSX_JAVA_LANGUAGE_SERVER_BIN",
            Self::TypeScriptLanguageServer => "MOSSX_TYPESCRIPT_LANGUAGE_SERVER_BIN",
        }
    }

    fn default_executable(self) -> &'static str {
        match self {
            Self::RustAnalyzer => "rust-analyzer",
            Self::EclipseJdtLs => "jdtls",
            Self::TypeScriptLanguageServer => "typescript-language-server",
        }
    }

    fn initialize_timeout(self) -> Duration {
        match self {
            Self::EclipseJdtLs => JAVA_INITIALIZE_TIMEOUT,
            _ => DEFAULT_INITIALIZE_TIMEOUT,
        }
    }

    fn launch_args(
        self,
        workspace_root: &Path,
        cache_root: &Path,
    ) -> Result<Vec<OsString>, String> {
        match self {
            Self::RustAnalyzer => Ok(Vec::new()),
            Self::TypeScriptLanguageServer => Ok(vec![OsString::from("--stdio")]),
            Self::EclipseJdtLs => {
                let mut hasher = DefaultHasher::new();
                workspace_root.hash(&mut hasher);
                let data_dir = cache_root
                    .join("eclipse-jdt-ls")
                    .join(format!("{:016x}", hasher.finish()));
                std::fs::create_dir_all(&data_dir).map_err(|error| {
                    format!("failed to prepare eclipse-jdt-ls data directory: {error}")
                })?;
                Ok(vec![OsString::from("-data"), data_dir.into_os_string()])
            }
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub(crate) enum SemanticQueryKind {
    Definition,
    References { include_declaration: bool },
    Implementation,
}

impl SemanticQueryKind {
    fn method(self) -> &'static str {
        match self {
            Self::Definition => "textDocument/definition",
            Self::References { .. } => "textDocument/references",
            Self::Implementation => "textDocument/implementation",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SemanticPosition {
    pub(crate) line: u32,
    pub(crate) character: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SemanticLocation {
    pub(crate) uri: String,
    pub(crate) path: PathBuf,
    pub(crate) start: SemanticPosition,
    pub(crate) end: SemanticPosition,
}

#[derive(Debug, Clone)]
struct OpenDocument {
    version: i32,
    text: String,
}

type PendingRequests = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>;

struct LspSession {
    child: Mutex<Child>,
    stdin: Arc<Mutex<ChildStdin>>,
    pending: PendingRequests,
    next_id: AtomicU64,
    opened_documents: Mutex<HashMap<String, OpenDocument>>,
    alive: Arc<AtomicBool>,
    provider_id: &'static str,
}

impl LspSession {
    async fn write_message(&self, value: &Value) -> Result<(), String> {
        write_lsp_value(&self.stdin, value).await
    }
}

async fn write_lsp_value(stdin: &Arc<Mutex<ChildStdin>>, value: &Value) -> Result<(), String> {
    let payload = serde_json::to_vec(value).map_err(|error| error.to_string())?;
    let header = format!("Content-Length: {}\r\n\r\n", payload.len());
    let mut stdin = stdin.lock().await;
    stdin
        .write_all(header.as_bytes())
        .await
        .map_err(|error| format!("Failed to write LSP header: {error}"))?;
    stdin
        .write_all(&payload)
        .await
        .map_err(|error| format!("Failed to write LSP payload: {error}"))?;
    stdin
        .flush()
        .await
        .map_err(|error| format!("Failed to flush LSP request: {error}"))
}

impl LspSession {
    async fn send_request_with_timeout(
        &self,
        method: &str,
        params: Value,
        timeout_duration: Duration,
    ) -> Result<Value, String> {
        if !self.alive.load(Ordering::SeqCst) {
            return Err("Language server is not running".to_string());
        }
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (sender, receiver) = oneshot::channel();
        self.pending.lock().await.insert(id, sender);
        let request = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });
        if let Err(error) = self.write_message(&request).await {
            self.pending.lock().await.remove(&id);
            return Err(error);
        }
        match timeout(timeout_duration, receiver).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => {
                self.pending.lock().await.remove(&id);
                Err("Language server request was canceled".to_string())
            }
            Err(_) => {
                self.pending.lock().await.remove(&id);
                Err(format!("Language server request timed out: {method}"))
            }
        }
    }

    async fn send_notification(&self, method: &str, params: Value) -> Result<(), String> {
        self.write_message(&json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        }))
        .await
    }

    async fn sync_document(&self, uri: &str, language_id: &str, text: &str) -> Result<(), String> {
        let mut opened_documents = self.opened_documents.lock().await;
        match opened_documents.get_mut(uri) {
            Some(document) if document.text == text => return Ok(()),
            Some(document) => {
                document.version = document.version.saturating_add(1);
                document.text = text.to_string();
                let version = document.version;
                self.send_notification(
                    "textDocument/didChange",
                    json!({
                        "textDocument": { "uri": uri, "version": version },
                        "contentChanges": [{ "text": text }],
                    }),
                )
                .await
            }
            None => {
                opened_documents.insert(
                    uri.to_string(),
                    OpenDocument {
                        version: 1,
                        text: text.to_string(),
                    },
                );
                self.send_notification(
                    "textDocument/didOpen",
                    json!({
                        "textDocument": {
                            "uri": uri,
                            "languageId": language_id,
                            "version": 1,
                            "text": text,
                        }
                    }),
                )
                .await
            }
        }
    }

    async fn query(
        &self,
        uri: &str,
        language_id: &str,
        text: &str,
        line: u32,
        character: u32,
        kind: SemanticQueryKind,
    ) -> Result<Value, String> {
        self.sync_document(uri, language_id, text).await?;
        let mut params = json!({
            "textDocument": { "uri": uri },
            "position": { "line": line, "character": character },
        });
        if let SemanticQueryKind::References {
            include_declaration,
        } = kind
        {
            params["context"] = json!({ "includeDeclaration": include_declaration });
        }
        self.send_request_with_timeout(kind.method(), params, REQUEST_TIMEOUT)
            .await
    }
}

struct SessionEntry {
    session: Arc<LspSession>,
    last_used: Instant,
}

fn select_session_evictions<K>(
    entries: &[(K, bool, Instant)],
    requested_key: &K,
    now: Instant,
) -> Vec<K>
where
    K: Clone + Eq,
{
    let mut evictions = entries
        .iter()
        .filter_map(|(key, alive, last_used)| {
            (!alive || now.duration_since(*last_used) >= SESSION_IDLE_TIMEOUT).then(|| key.clone())
        })
        .collect::<Vec<_>>();
    let requested_survives = entries
        .iter()
        .any(|(key, _, _)| key == requested_key && !evictions.contains(key));
    let survivor_count = entries.len().saturating_sub(evictions.len());
    if !requested_survives && survivor_count >= MAX_SESSIONS {
        let oldest_survivor = entries
            .iter()
            .filter(|(key, _, _)| !evictions.contains(key))
            .min_by_key(|(_, _, last_used)| *last_used)
            .map(|(key, _, _)| key.clone());
        if let Some(oldest_survivor) = oldest_survivor {
            evictions.push(oldest_survivor);
        }
    }
    evictions
}

pub(crate) struct SemanticNavigationRuntime {
    sessions: Mutex<HashMap<(SemanticProvider, PathBuf), SessionEntry>>,
    session_initializers: Mutex<HashMap<(SemanticProvider, PathBuf), Weak<Mutex<()>>>>,
    cache_root: PathBuf,
}

impl Default for SemanticNavigationRuntime {
    fn default() -> Self {
        Self::new(std::env::temp_dir().join("mossx-language-servers"))
    }
}

impl SemanticNavigationRuntime {
    pub(crate) fn new(cache_root: PathBuf) -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            session_initializers: Mutex::new(HashMap::new()),
            cache_root,
        }
    }

    async fn initializer_for(&self, key: &(SemanticProvider, PathBuf)) -> Arc<Mutex<()>> {
        let mut initializers = self.session_initializers.lock().await;
        initializers.retain(|_, initializer| initializer.strong_count() > 0);
        if let Some(initializer) = initializers.get(key).and_then(Weak::upgrade) {
            return initializer;
        }
        let initializer = Arc::new(Mutex::new(()));
        initializers.insert(key.clone(), Arc::downgrade(&initializer));
        initializer
    }

    pub(crate) async fn query(
        &self,
        provider: SemanticProvider,
        workspace_root: &Path,
        file: &Path,
        text: &str,
        line: u32,
        character: u32,
        kind: SemanticQueryKind,
    ) -> Result<Vec<SemanticLocation>, String> {
        let session = self.session_for(provider, workspace_root).await?;
        let uri = path_to_file_uri(file);
        let response = session
            .query(
                &uri,
                provider.language_id(file),
                text,
                line,
                character,
                kind,
            )
            .await;
        let value = match response {
            Ok(value) => value,
            Err(error) => {
                self.evict_session(provider, workspace_root, &session).await;
                return Err(error);
            }
        };
        normalize_locations(workspace_root, &value)
    }

    async fn session_for(
        &self,
        provider: SemanticProvider,
        workspace_root: &Path,
    ) -> Result<Arc<LspSession>, String> {
        let key = (provider, workspace_root.to_path_buf());
        let initializer = self.initializer_for(&key).await;
        let _initialization_guard = initializer.lock().await;
        let now = Instant::now();
        let (cached_session, expired_sessions) = {
            let mut sessions = self.sessions.lock().await;
            let session_facts = sessions
                .iter()
                .map(|(entry_key, entry)| {
                    (
                        entry_key.clone(),
                        entry.session.alive.load(Ordering::SeqCst),
                        entry.last_used,
                    )
                })
                .collect::<Vec<_>>();
            let expired_sessions = select_session_evictions(&session_facts, &key, now)
                .into_iter()
                .filter_map(|expired_key| sessions.remove(&expired_key))
                .map(|entry| entry.session)
                .collect::<Vec<_>>();
            let cached_session = sessions.get_mut(&key).map(|entry| {
                entry.last_used = now;
                Arc::clone(&entry.session)
            });
            (cached_session, expired_sessions)
        };
        for expired_session in expired_sessions {
            stop_session(&expired_session).await;
        }
        if let Some(cached_session) = cached_session {
            return Ok(cached_session);
        }

        let session = spawn_language_server(provider, workspace_root, &self.cache_root).await?;
        let evicted_sessions = {
            let mut sessions = self.sessions.lock().await;
            let inserted_at = Instant::now();
            let session_facts = sessions
                .iter()
                .map(|(entry_key, entry)| {
                    (
                        entry_key.clone(),
                        entry.session.alive.load(Ordering::SeqCst),
                        entry.last_used,
                    )
                })
                .collect::<Vec<_>>();
            let evicted_sessions = select_session_evictions(&session_facts, &key, inserted_at)
                .into_iter()
                .filter_map(|expired_key| sessions.remove(&expired_key))
                .map(|entry| entry.session)
                .collect::<Vec<_>>();
            sessions.insert(
                key,
                SessionEntry {
                    session: Arc::clone(&session),
                    last_used: inserted_at,
                },
            );
            evicted_sessions
        };
        for evicted_session in evicted_sessions {
            stop_session(&evicted_session).await;
        }
        Ok(session)
    }

    async fn evict_session(
        &self,
        provider: SemanticProvider,
        workspace_root: &Path,
        failed: &Arc<LspSession>,
    ) {
        let key = (provider, workspace_root.to_path_buf());
        let removed_session = {
            let mut sessions = self.sessions.lock().await;
            let should_remove = sessions
                .get(&key)
                .is_some_and(|current| Arc::ptr_eq(&current.session, failed));
            should_remove
                .then(|| sessions.remove(&key))
                .flatten()
                .map(|entry| entry.session)
        };
        if let Some(removed_session) = removed_session {
            stop_session(&removed_session).await;
        }
    }
}

async fn stop_session(session: &Arc<LspSession>) {
    session.alive.store(false, Ordering::SeqCst);
    if let Err(error) = session.child.lock().await.kill().await {
        log::debug!(
            "[{}] failed to stop language server: {error}",
            session.provider_id
        );
    }
}

fn resolve_provider_executable(provider: SemanticProvider) -> OsString {
    let override_executable =
        std::env::var_os(provider.override_env()).filter(|value| !value.is_empty());
    if override_executable.is_some() {
        return select_provider_executable(
            provider.default_executable(),
            override_executable,
            None,
        );
    }
    select_provider_executable(
        provider.default_executable(),
        None,
        find_cli_binary(provider.default_executable(), None),
    )
}

fn select_provider_executable(
    default_executable: &str,
    override_executable: Option<OsString>,
    discovered_executable: Option<PathBuf>,
) -> OsString {
    override_executable
        .or_else(|| discovered_executable.map(PathBuf::into_os_string))
        .unwrap_or_else(|| OsString::from(default_executable))
}

#[cfg(any(windows, test))]
fn is_windows_command_wrapper(executable: &OsString) -> bool {
    let executable_lower = executable.to_string_lossy().to_ascii_lowercase();
    executable_lower.ends_with(".cmd") || executable_lower.ends_with(".bat")
}

fn build_provider_command(executable: &OsString) -> tokio::process::Command {
    #[cfg(windows)]
    {
        if is_windows_command_wrapper(executable) {
            let mut command = async_command("cmd");
            command.arg("/d").arg("/s").arg("/c").arg(executable);
            return command;
        }
    }
    async_command(executable)
}

async fn spawn_language_server(
    provider: SemanticProvider,
    workspace_root: &Path,
    cache_root: &Path,
) -> Result<Arc<LspSession>, String> {
    let executable = resolve_provider_executable(provider);
    let mut command = build_provider_command(&executable);
    if let Some(path_env) = build_cli_path_env(executable.to_str()) {
        command.env("PATH", path_env);
    }
    command
        .args(provider.launch_args(workspace_root, cache_root)?)
        .current_dir(workspace_root)
        .kill_on_drop(true)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|error| format!("{} is unavailable: {error}", provider.id()))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| format!("{} stdin is unavailable", provider.id()))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| format!("{} stdout is unavailable", provider.id()))?;
    let stderr = child.stderr.take();
    let pending: PendingRequests = Arc::new(Mutex::new(HashMap::new()));
    let alive = Arc::new(AtomicBool::new(true));
    let stdin = Arc::new(Mutex::new(stdin));
    let session = Arc::new(LspSession {
        child: Mutex::new(child),
        stdin: Arc::clone(&stdin),
        pending: Arc::clone(&pending),
        next_id: AtomicU64::new(1),
        opened_documents: Mutex::new(HashMap::new()),
        alive: Arc::clone(&alive),
        provider_id: provider.id(),
    });

    tauri::async_runtime::spawn(read_server_messages(stdout, stdin, pending, alive));
    if let Some(stderr) = stderr {
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                log::debug!("[{}] {line}", provider.id());
            }
        });
    }

    let root_uri = path_to_file_uri(workspace_root);
    if let Err(error) = session
        .send_request_with_timeout(
            "initialize",
            json!({
                "processId": Value::Null,
                "clientInfo": { "name": "mossx", "version": env!("CARGO_PKG_VERSION") },
                "rootUri": root_uri,
                "workspaceFolders": [{ "uri": root_uri, "name": "workspace" }],
                "capabilities": {
                    "textDocument": {
                        "definition": { "linkSupport": true },
                        "implementation": { "linkSupport": true },
                        "synchronization": { "didSave": false, "dynamicRegistration": false }
                    }
                }
            }),
            provider.initialize_timeout(),
        )
        .await
    {
        session.alive.store(false, Ordering::SeqCst);
        let _ = session.child.lock().await.kill().await;
        return Err(format!("Failed to initialize {}: {error}", provider.id()));
    }
    session.send_notification("initialized", json!({})).await?;
    Ok(session)
}

async fn read_server_messages(
    stdout: tokio::process::ChildStdout,
    stdin: Arc<Mutex<ChildStdin>>,
    pending: PendingRequests,
    alive: Arc<AtomicBool>,
) {
    let mut reader = BufReader::new(stdout);
    loop {
        match read_lsp_message(&mut reader).await {
            Ok(Some(message)) => dispatch_server_message(message, &stdin, &pending).await,
            Ok(None) => break,
            Err(error) => {
                fail_pending(&pending, error).await;
                break;
            }
        }
    }
    alive.store(false, Ordering::SeqCst);
    fail_pending(&pending, "Language server exited".to_string()).await;
}

async fn dispatch_server_message(
    message: Value,
    stdin: &Arc<Mutex<ChildStdin>>,
    pending: &PendingRequests,
) {
    if message.get("method").and_then(Value::as_str).is_some() {
        respond_to_server_request(&message, stdin).await;
        return;
    }
    let Some(id) = message.get("id").and_then(Value::as_u64) else {
        return;
    };
    let Some(sender) = pending.lock().await.remove(&id) else {
        return;
    };
    let result = if let Some(error) = message.get("error") {
        Err(error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("Language server request failed")
            .to_string())
    } else {
        Ok(message.get("result").cloned().unwrap_or(Value::Null))
    };
    let _ = sender.send(result);
}

async fn respond_to_server_request(message: &Value, stdin: &Arc<Mutex<ChildStdin>>) {
    let Some(id) = message.get("id").cloned() else {
        return;
    };
    let method = message
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let response = match method {
        "workspace/configuration" => {
            let item_count = message
                .pointer("/params/items")
                .and_then(Value::as_array)
                .map_or(0, Vec::len);
            json!({ "jsonrpc": "2.0", "id": id, "result": vec![Value::Null; item_count] })
        }
        "client/registerCapability"
        | "client/unregisterCapability"
        | "window/workDoneProgress/create" => {
            json!({ "jsonrpc": "2.0", "id": id, "result": Value::Null })
        }
        _ => json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": -32601, "message": format!("Unsupported server request: {method}") }
        }),
    };
    if let Err(error) = write_lsp_value(stdin, &response).await {
        log::debug!("[language-server] failed to answer server request: {error}");
    }
}

async fn fail_pending(pending: &PendingRequests, error: String) {
    let requests = std::mem::take(&mut *pending.lock().await);
    for (_, sender) in requests {
        let _ = sender.send(Err(error.clone()));
    }
}

async fn read_lsp_message<R>(reader: &mut R) -> Result<Option<Value>, String>
where
    R: AsyncBufRead + Unpin,
{
    let mut content_length = None;
    loop {
        let mut header = String::new();
        let read = reader
            .read_line(&mut header)
            .await
            .map_err(|error| format!("Failed to read LSP header: {error}"))?;
        if read == 0 {
            return if content_length.is_none() {
                Ok(None)
            } else {
                Err("Unexpected EOF in LSP header".to_string())
            };
        }
        let header = header.trim_end_matches(['\r', '\n']);
        if header.is_empty() {
            break;
        }
        if let Some(value) = header.strip_prefix("Content-Length:") {
            content_length = Some(
                value
                    .trim()
                    .parse::<usize>()
                    .map_err(|_| "Invalid LSP Content-Length".to_string())?,
            );
        }
    }
    let length = content_length.ok_or_else(|| "Missing LSP Content-Length".to_string())?;
    let mut payload = vec![0; length];
    reader
        .read_exact(&mut payload)
        .await
        .map_err(|error| format!("Failed to read LSP payload: {error}"))?;
    serde_json::from_slice(&payload)
        .map(Some)
        .map_err(|error| format!("Language server returned invalid JSON: {error}"))
}

fn path_to_file_uri(path: &Path) -> String {
    let normalized = path.to_string_lossy().replace('\\', "/");
    let encoded = percent_encode_path(&normalized);
    if normalized.starts_with('/') {
        format!("file://{encoded}")
    } else {
        format!("file:///{encoded}")
    }
}

fn percent_encode_path(path: &str) -> String {
    let mut encoded = String::with_capacity(path.len());
    for byte in path.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b':' | b'-' | b'_' | b'.' | b'~') {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

fn file_uri_to_path(uri: &str) -> Option<PathBuf> {
    let encoded = uri.strip_prefix("file://")?;
    let decoded = percent_decode_path(encoded)?;
    #[cfg(windows)]
    let decoded = decoded
        .strip_prefix('/')
        .filter(|value| value.as_bytes().get(1) == Some(&b':'))
        .unwrap_or(&decoded)
        .to_string();
    Some(PathBuf::from(decoded))
}

fn percent_decode_path(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let high = *bytes.get(index + 1)?;
            let low = *bytes.get(index + 2)?;
            decoded.push((hex_value(high)? << 4) | hex_value(low)?);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(decoded).ok()
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn normalize_locations(
    workspace_root: &Path,
    response: &Value,
) -> Result<Vec<SemanticLocation>, String> {
    let entries: Vec<&Value> = match response {
        Value::Null => Vec::new(),
        Value::Array(values) => values.iter().collect(),
        Value::Object(_) => vec![response],
        _ => return Err("Language server returned an invalid location response".to_string()),
    };
    let canonical_root = workspace_root
        .canonicalize()
        .map_err(|error| format!("Failed to resolve workspace root: {error}"))?;
    let mut locations = Vec::new();
    for entry in entries {
        let uri = entry
            .get("uri")
            .or_else(|| entry.get("targetUri"))
            .and_then(Value::as_str);
        let range = entry
            .get("range")
            .or_else(|| entry.get("targetSelectionRange"))
            .or_else(|| entry.get("targetRange"));
        let (Some(uri), Some(range)) = (uri, range) else {
            continue;
        };
        let Some(path) = file_uri_to_path(uri) else {
            continue;
        };
        let Ok(canonical_path) = path.canonicalize() else {
            continue;
        };
        if !canonical_path.starts_with(&canonical_root) || !canonical_path.is_file() {
            continue;
        }
        let Some(start) = parse_position(range.get("start")) else {
            continue;
        };
        let Some(end) = parse_position(range.get("end")) else {
            continue;
        };
        locations.push(SemanticLocation {
            uri: uri.to_string(),
            path: canonical_path,
            start,
            end,
        });
    }
    Ok(locations)
}

fn parse_position(value: Option<&Value>) -> Option<SemanticPosition> {
    let value = value?;
    Some(SemanticPosition {
        line: u32::try_from(value.get("line")?.as_u64()?).ok()?,
        character: u32::try_from(value.get("character")?.as_u64()?).ok()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{duplex, AsyncWriteExt};

    #[tokio::test]
    async fn reads_partial_lsp_frame() {
        let (mut writer, reader) = duplex(128);
        let write_task = tokio::spawn(async move {
            writer
                .write_all(b"Content-Length: 24\r\n\r\n{\"jsonrpc\":\"2.0\",\"id\":1}")
                .await
                .unwrap();
        });
        let mut reader = BufReader::new(reader);
        let message = read_lsp_message(&mut reader).await.unwrap().unwrap();
        write_task.await.unwrap();
        assert_eq!(message["id"], 1);
    }

    #[tokio::test]
    async fn eof_failure_releases_all_pending_requests() {
        let pending: PendingRequests = Arc::new(Mutex::new(HashMap::new()));
        let (sender, receiver) = oneshot::channel();
        pending.lock().await.insert(7, sender);

        fail_pending(&pending, "Language server exited".to_string()).await;

        assert_eq!(
            receiver.await.unwrap().unwrap_err(),
            "Language server exited"
        );
        assert!(pending.lock().await.is_empty());
    }

    #[test]
    fn file_uri_round_trip_preserves_spaces_and_unicode() {
        let path = PathBuf::from("/tmp/mossx workspace/中文.rs");
        let uri = path_to_file_uri(&path);
        assert_eq!(file_uri_to_path(&uri), Some(path));
    }

    #[test]
    fn rejects_non_file_uri() {
        assert_eq!(file_uri_to_path("https://example.com/main.rs"), None);
    }

    #[test]
    fn detects_windows_command_wrappers_case_insensitively() {
        assert!(is_windows_command_wrapper(&OsString::from(
            "C:\\tools\\server.CMD"
        )));
        assert!(is_windows_command_wrapper(&OsString::from("server.bat")));
        assert!(!is_windows_command_wrapper(&OsString::from("server.exe")));
    }

    #[test]
    fn provider_executable_prefers_override_then_extended_discovery() {
        let override_path = OsString::from("/configured/jdtls");
        let discovered_path = PathBuf::from("/opt/homebrew/bin/jdtls");
        assert_eq!(
            select_provider_executable(
                "jdtls",
                Some(override_path.clone()),
                Some(discovered_path.clone()),
            ),
            override_path,
        );
        assert_eq!(
            select_provider_executable("jdtls", None, Some(discovered_path.clone())),
            discovered_path.into_os_string(),
        );
        assert_eq!(
            select_provider_executable("jdtls", None, None),
            OsString::from("jdtls"),
        );
    }

    #[test]
    fn installed_java_provider_is_discovered_from_extended_cli_paths_when_available() {
        if std::env::var_os(SemanticProvider::EclipseJdtLs.override_env()).is_some() {
            return;
        }
        let Some(discovered) =
            find_cli_binary(SemanticProvider::EclipseJdtLs.default_executable(), None)
        else {
            return;
        };

        assert_eq!(
            resolve_provider_executable(SemanticProvider::EclipseJdtLs),
            discovered.into_os_string(),
        );
    }

    #[test]
    fn provider_launch_arguments_are_language_specific() {
        let root = PathBuf::from("/workspace");
        let cache = std::env::temp_dir().join("mossx-lsp-args");
        assert!(SemanticProvider::RustAnalyzer
            .launch_args(&root, &cache)
            .unwrap()
            .is_empty());
        assert_eq!(
            SemanticProvider::TypeScriptLanguageServer
                .launch_args(&root, &cache)
                .unwrap(),
            vec![OsString::from("--stdio")]
        );
        let java_args = SemanticProvider::EclipseJdtLs
            .launch_args(&root, &cache)
            .unwrap();
        assert_eq!(java_args.first(), Some(&OsString::from("-data")));
        assert_eq!(java_args.len(), 2);
        let _ = std::fs::remove_dir_all(cache);
    }

    #[test]
    fn session_eviction_is_idle_and_capacity_bounded_without_polling() {
        let now = Instant::now();
        let recent = now - Duration::from_secs(5);
        let expired = now - SESSION_IDLE_TIMEOUT;
        let entries = vec![
            ("expired", true, expired),
            ("dead", false, recent),
            ("live", true, recent),
        ];
        assert_eq!(
            select_session_evictions(&entries, &"live", now),
            vec!["expired", "dead"]
        );

        let capped_entries = (0..MAX_SESSIONS)
            .map(|index| {
                (
                    index,
                    true,
                    now - Duration::from_secs((MAX_SESSIONS - index) as u64),
                )
            })
            .collect::<Vec<_>>();
        assert_eq!(select_session_evictions(&capped_entries, &99, now), vec![0]);
    }

    #[tokio::test]
    async fn session_initialization_is_scoped_by_provider_and_workspace() {
        let runtime = SemanticNavigationRuntime::default();
        let java_key = (
            SemanticProvider::EclipseJdtLs,
            PathBuf::from("/workspace/one"),
        );
        let same_java_initializer = runtime.initializer_for(&java_key).await;
        let repeated_java_initializer = runtime.initializer_for(&java_key).await;
        let typescript_initializer = runtime
            .initializer_for(&(
                SemanticProvider::TypeScriptLanguageServer,
                PathBuf::from("/workspace/one"),
            ))
            .await;
        let other_workspace_initializer = runtime
            .initializer_for(&(
                SemanticProvider::EclipseJdtLs,
                PathBuf::from("/workspace/two"),
            ))
            .await;

        assert!(Arc::ptr_eq(
            &same_java_initializer,
            &repeated_java_initializer
        ));
        assert!(!Arc::ptr_eq(
            &same_java_initializer,
            &typescript_initializer
        ));
        assert!(!Arc::ptr_eq(
            &same_java_initializer,
            &other_workspace_initializer
        ));
    }

    #[test]
    fn normalizes_location_links_and_rejects_external_targets() {
        let root =
            std::env::temp_dir().join(format!("mossx-lsp-location-{}", uuid::Uuid::new_v4()));
        let outside =
            std::env::temp_dir().join(format!("mossx-lsp-outside-{}.rs", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("src")).unwrap();
        let inside = root.join("src/lib.rs");
        std::fs::write(&inside, "trait Renderer {}\n").unwrap();
        std::fs::write(&outside, "trait Outside {}\n").unwrap();
        let root = root.canonicalize().unwrap();
        let response = json!([
            {
                "targetUri": path_to_file_uri(&inside),
                "targetSelectionRange": {
                    "start": { "line": 0, "character": 6 },
                    "end": { "line": 0, "character": 14 }
                }
            },
            {
                "uri": path_to_file_uri(&outside),
                "range": {
                    "start": { "line": 0, "character": 6 },
                    "end": { "line": 0, "character": 13 }
                }
            },
            {
                "uri": "https://example.com/lib.rs",
                "range": {
                    "start": { "line": 0, "character": 0 },
                    "end": { "line": 0, "character": 1 }
                }
            }
        ]);

        let locations = normalize_locations(&root, &response).unwrap();
        assert_eq!(locations.len(), 1);
        assert_eq!(locations[0].path, inside.canonicalize().unwrap());
        assert_eq!(locations[0].start.character, 6);

        std::fs::remove_dir_all(root).unwrap();
        std::fs::remove_file(outside).unwrap();
    }

    #[tokio::test]
    async fn rust_analyzer_resolves_definition_and_reuses_workspace_session_when_available() {
        let available = crate::utils::std_command("rust-analyzer")
            .arg("--version")
            .output()
            .is_ok_and(|output| output.status.success());
        if !available {
            return;
        }

        let root =
            std::env::temp_dir().join(format!("mossx-rust-analyzer-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("src")).unwrap();
        std::fs::write(
            root.join("Cargo.toml"),
            "[package]\nname = \"mossx_lsp_fixture\"\nversion = \"0.1.0\"\nedition = \"2021\"\n",
        )
        .unwrap();
        let source = concat!(
            "pub trait Renderer { fn render(&self); }\n",
            "pub struct Html;\n",
            "impl Renderer for Html { fn render(&self) {} }\n",
            "pub fn call(value: &Html) { value.render(); }\n",
        );
        let file = root.join("src/lib.rs");
        std::fs::write(&file, source).unwrap();
        let root = root.canonicalize().unwrap();
        let runtime = SemanticNavigationRuntime::default();

        let definitions = runtime
            .query(
                SemanticProvider::RustAnalyzer,
                &root,
                &file,
                source,
                3,
                35,
                SemanticQueryKind::Definition,
            )
            .await
            .unwrap();
        assert!(!definitions.is_empty());

        let implementations = runtime
            .query(
                SemanticProvider::RustAnalyzer,
                &root,
                &file,
                source,
                0,
                10,
                SemanticQueryKind::Implementation,
            )
            .await
            .unwrap();
        assert!(!implementations.is_empty());
        assert_eq!(runtime.sessions.lock().await.len(), 1);

        runtime.sessions.lock().await.clear();
        std::fs::remove_dir_all(root).unwrap();
    }
}
