//! DSH session / workspace unary operations.

use super::host::DshHostClient;
use serde_json::{json, Value};
use std::path::Path;

pub const THREAD_PREFIX: &str = "dsh:";
pub const PENDING_PREFIX: &str = "dsh-pending-";

pub fn thread_id_for_session(session_id: &str) -> String {
    format!("{THREAD_PREFIX}{session_id}")
}

pub fn session_id_from_thread(thread_id: &str) -> String {
    let trimmed = thread_id.trim();
    if let Some(rest) = trimmed.strip_prefix(THREAD_PREFIX) {
        return rest.to_string();
    }
    if let Some(rest) = trimmed.strip_prefix(PENDING_PREFIX) {
        return rest.to_string();
    }
    trimmed.to_string()
}

pub fn is_pending_thread(thread_id: &str) -> bool {
    thread_id.trim().starts_with(PENDING_PREFIX)
}

pub fn strip_windows_verbatim_prefix(path: &str) -> String {
    let raw = path.replace('/', "\\");
    if let Some(stripped) = raw.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{stripped}");
    }
    if let Some(stripped) = raw.strip_prefix(r"\\?\") {
        return stripped.to_string();
    }
    path.to_string()
}

pub fn canonicalize_host_path(path: &Path) -> String {
    let canonical = dunce::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    strip_windows_verbatim_prefix(&canonical.to_string_lossy())
}

pub async fn create_workspace(client: &DshHostClient, path: &Path) -> Result<Value, String> {
    let path = canonicalize_host_path(path);
    client
        .call("workspace.create", json!({ "path": path }))
        .await
}

pub fn workspace_id_from_create(value: &Value) -> Result<String, String> {
    value
        .get("workspace")
        .and_then(|ws| ws.get("workspaceId"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "dsh workspace.create missing workspaceId".to_string())
}

pub async fn create_session(
    client: &DshHostClient,
    workspace_id: &str,
    session_id: Option<&str>,
) -> Result<String, String> {
    let mut payload = json!({ "workspaceId": workspace_id });
    if let Some(session_id) = session_id.map(str::trim).filter(|value| !value.is_empty()) {
        payload["sessionId"] = json!(session_id);
    }
    let value = client.call("session.create", payload).await?;
    value
        .get("sessionId")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "dsh session.create did not return a sessionId".to_string())
}

pub async fn select_model(
    client: &DshHostClient,
    session_id: &str,
    provider: &str,
    model: &str,
    reasoning_effort: Option<&str>,
) -> Result<Value, String> {
    let mut payload = json!({
        "sessionId": session_id,
        "provider": provider,
        "model": model,
    });
    if let Some(effort) = reasoning_effort.map(str::trim).filter(|value| !value.is_empty()) {
        payload["reasoningEffort"] = json!(effort);
    }
    client.call("session.selectModel", payload).await
}

pub async fn prompt(
    client: &DshHostClient,
    session_id: &str,
    text: &str,
    images: &[DshPromptImage],
) -> Result<Value, String> {
    let mut content = vec![json!({ "type": "text", "text": text })];
    for image in images {
        content.push(json!({
            "type": "image",
            "mediaType": image.media_type,
            "data": image.data,
            "name": image.name,
        }));
    }
    client
        .call(
            "session.prompt",
            json!({
                "sessionId": session_id,
                "mode": "queue",
                "content": content,
            }),
        )
        .await
}

pub async fn cancel(client: &DshHostClient, session_id: &str) -> Result<Value, String> {
    client
        .call("session.cancel", json!({ "sessionId": session_id }))
        .await
}

pub async fn fork(client: &DshHostClient, session_id: &str) -> Result<String, String> {
    let value = client
        .call("session.fork", json!({ "sessionId": session_id }))
        .await?;
    value
        .get("sessionId")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "dsh session.fork did not return a sessionId".to_string())
}

pub async fn list_sessions(client: &DshHostClient) -> Result<Vec<Value>, String> {
    let value = client.call("session.list", json!({})).await?;
    Ok(value
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default())
}

pub async fn history(
    client: &DshHostClient,
    session_id: &str,
    max_messages: Option<u32>,
    before_seq: Option<i64>,
) -> Result<Value, String> {
    let mut payload = json!({ "sessionId": session_id });
    if let Some(max_messages) = max_messages {
        payload["maxMessages"] = json!(max_messages);
    }
    if let Some(before_seq) = before_seq {
        payload["beforeSeq"] = json!(before_seq);
    }
    client.call("session.history", payload).await
}

pub async fn archive_session(client: &DshHostClient, session_id: &str) -> Result<Value, String> {
    client
        .call(
            "workspace.archiveSession",
            json!({ "sessionId": session_id }),
        )
        .await
}

pub async fn load_models(client: &DshHostClient) -> Result<Value, String> {
    client.call("llm.models", json!({})).await
}

#[derive(Debug, Clone)]
pub struct DshPromptImage {
    pub media_type: String,
    pub data: String,
    pub name: Option<String>,
}

pub async fn prompt_images_from_paths(images: Option<&[String]>) -> Vec<DshPromptImage> {
    let Some(images) = images else {
        return Vec::new();
    };
    let mut decoded = Vec::with_capacity(images.len());
    for entry in images {
        if let Some(image) = decode_image_entry(entry).await {
            decoded.push(image);
        }
    }
    decoded
}

async fn decode_image_entry(entry: &str) -> Option<DshPromptImage> {
    let trimmed = entry.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Some(rest) = trimmed.strip_prefix("data:") {
        let (header, data) = rest.split_once(',')?;
        let media_type = header
            .split(';')
            .next()
            .filter(|value| !value.is_empty())
            .unwrap_or("image/png")
            .to_string();
        return Some(DshPromptImage {
            media_type,
            data: data.to_string(),
            name: None,
        });
    }
    let path = Path::new(trimmed);
    let bytes = tokio::fs::read(path).await.ok()?;
    let media_type = media_type_for_path(path)?;
    use base64::Engine as _;
    Some(DshPromptImage {
        media_type: media_type.to_string(),
        data: base64::engine::general_purpose::STANDARD.encode(bytes),
        name: path
            .file_name()
            .map(|name| name.to_string_lossy().to_string()),
    })
}

fn media_type_for_path(path: &Path) -> Option<&'static str> {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "png" => Some("image/png"),
        _ => None,
    }
}

/// Parse mossx catalog id `provider/model` (or a bare model) plus optional provider.
pub fn split_model_selection(
    catalog_or_model: &str,
    explicit_provider: Option<&str>,
) -> Option<(String, String)> {
    let trimmed = catalog_or_model.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Some(provider) = explicit_provider.map(str::trim).filter(|value| !value.is_empty())
    {
        let model = trimmed
            .strip_prefix(&format!("{provider}/"))
            .unwrap_or(trimmed)
            .trim();
        if model.is_empty() {
            return None;
        }
        return Some((provider.to_string(), model.to_string()));
    }
    // Catalog ids are `${provider}/${model}`. Keep the first slash as the
    // provider boundary so model ids such as `ovh/Qwen2.5` stay intact.
    let (provider, model) = trimmed.split_once('/')?;
    let provider = provider.trim();
    let model = model.trim();
    if provider.is_empty() || model.is_empty() {
        return None;
    }
    Some((provider.to_string(), model.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_windows_verbatim_prefix() {
        assert_eq!(
            strip_windows_verbatim_prefix(r"\\?\C:\Users\foo"),
            r"C:\Users\foo"
        );
        assert_eq!(
            strip_windows_verbatim_prefix(r"\\?\UNC\server\share\proj"),
            r"\\server\share\proj"
        );
        assert_eq!(
            strip_windows_verbatim_prefix("//?/C:/Users/foo"),
            r"C:\Users\foo"
        );
        assert_eq!(
            strip_windows_verbatim_prefix(r"C:\Users\foo"),
            r"C:\Users\foo"
        );
        assert_eq!(strip_windows_verbatim_prefix("/tmp/project"), "/tmp/project");
    }

    #[test]
    fn thread_roundtrip() {
        assert_eq!(
            session_id_from_thread("dsh:session-abc"),
            "session-abc"
        );
        assert!(is_pending_thread("dsh-pending-1"));
        assert_eq!(thread_id_for_session("session-abc"), "dsh:session-abc");
    }

    #[test]
    fn split_provider_model() {
        assert_eq!(
            split_model_selection("deepseek-official/deepseek-v4-flash", None).unwrap(),
            (
                "deepseek-official".to_string(),
                "deepseek-v4-flash".to_string()
            )
        );
        assert_eq!(
            split_model_selection("deepseek-v4-flash", Some("deepseek-official")).unwrap(),
            (
                "deepseek-official".to_string(),
                "deepseek-v4-flash".to_string()
            )
        );
        assert_eq!(
            split_model_selection("vision-http/ovh/Qwen2.5-VL-72B-Instruct", None).unwrap(),
            (
                "vision-http".to_string(),
                "ovh/Qwen2.5-VL-72B-Instruct".to_string()
            )
        );
        assert_eq!(split_model_selection("deepseek-v4-flash", None), None);
    }
}
