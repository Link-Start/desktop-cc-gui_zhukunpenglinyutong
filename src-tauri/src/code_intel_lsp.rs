use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use tokio::io::{AsyncBufRead, AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin};
use tokio::sync::{oneshot, Mutex};
use tokio::time::timeout;

use crate::utils::async_command;

const INITIALIZE_TIMEOUT: Duration = Duration::from_secs(6);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(6);

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

    async fn sync_document(&self, uri: &str, text: &str) -> Result<(), String> {
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
                            "languageId": "rust",
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
        text: &str,
        line: u32,
        character: u32,
        kind: SemanticQueryKind,
    ) -> Result<Value, String> {
        self.sync_document(uri, text).await?;
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

#[derive(Default)]
pub(crate) struct RustAnalyzerRuntime {
    sessions: Mutex<HashMap<PathBuf, Arc<LspSession>>>,
}

impl RustAnalyzerRuntime {
    pub(crate) async fn query(
        &self,
        workspace_root: &Path,
        file: &Path,
        text: &str,
        line: u32,
        character: u32,
        kind: SemanticQueryKind,
    ) -> Result<Vec<SemanticLocation>, String> {
        let session = self.session_for(workspace_root).await?;
        let uri = path_to_file_uri(file);
        let response = session.query(&uri, text, line, character, kind).await;
        let value = match response {
            Ok(value) => value,
            Err(error) => {
                self.evict_session(workspace_root, &session).await;
                return Err(error);
            }
        };
        normalize_locations(workspace_root, &value)
    }

    async fn session_for(&self, workspace_root: &Path) -> Result<Arc<LspSession>, String> {
        let key = workspace_root.to_path_buf();
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get(&key) {
            if session.alive.load(Ordering::SeqCst) {
                return Ok(Arc::clone(session));
            }
            sessions.remove(&key);
        }
        let session = spawn_rust_analyzer(workspace_root).await?;
        sessions.insert(key, Arc::clone(&session));
        Ok(session)
    }

    async fn evict_session(&self, workspace_root: &Path, failed: &Arc<LspSession>) {
        let mut sessions = self.sessions.lock().await;
        let should_remove = sessions
            .get(workspace_root)
            .is_some_and(|current| Arc::ptr_eq(current, failed));
        if should_remove {
            if let Some(session) = sessions.remove(workspace_root) {
                session.alive.store(false, Ordering::SeqCst);
                let _ = session.child.lock().await.kill().await;
            }
        }
    }
}

async fn spawn_rust_analyzer(workspace_root: &Path) -> Result<Arc<LspSession>, String> {
    let mut command = async_command("rust-analyzer");
    command
        .current_dir(workspace_root)
        .kill_on_drop(true)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|error| format!("rust-analyzer is unavailable: {error}"))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "rust-analyzer stdin is unavailable".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "rust-analyzer stdout is unavailable".to_string())?;
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
    });

    tauri::async_runtime::spawn(read_server_messages(stdout, stdin, pending, alive));
    if let Some(stderr) = stderr {
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                log::debug!("[rust-analyzer] {line}");
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
                "capabilities": {
                    "textDocument": {
                        "definition": { "linkSupport": true },
                        "implementation": { "linkSupport": true },
                        "synchronization": { "didSave": false, "dynamicRegistration": false }
                    }
                }
            }),
            INITIALIZE_TIMEOUT,
        )
        .await
    {
        session.alive.store(false, Ordering::SeqCst);
        let _ = session.child.lock().await.kill().await;
        return Err(format!("Failed to initialize rust-analyzer: {error}"));
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
        log::debug!("[rust-analyzer] failed to answer server request: {error}");
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
        let runtime = RustAnalyzerRuntime::default();

        let definitions = runtime
            .query(&root, &file, source, 3, 35, SemanticQueryKind::Definition)
            .await
            .unwrap();
        assert!(!definitions.is_empty());

        let implementations = runtime
            .query(
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
