use serde_json::Value;
use std::collections::HashMap;
use std::io::Write;
use std::path::Path;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use uuid::Uuid;

use crate::app_paths;

const ALLOWED_STORES: &[&str] = &[
    "layout",
    "composer",
    "threads",
    "app",
    "leida",
    "diagnostics",
];
const PANEL_LOCK_PASSWORD_FILENAME: &str = "pwd.txt";
const CLIENT_STORE_LOCK_WAIT_TIMEOUT: Duration = Duration::from_secs(5);
const CLIENT_STORE_LOCK_RETRY_INTERVAL: Duration = Duration::from_millis(25);
const CLIENT_STORE_LOCK_STALE_TIMEOUT: Duration = Duration::from_secs(30);

fn client_storage_dir() -> Result<PathBuf, String> {
    app_paths::client_storage_dir()
}

fn validate_store_name(store: &str) -> Result<(), String> {
    if ALLOWED_STORES.contains(&store) {
        Ok(())
    } else {
        Err(format!("Invalid client store name: {store}"))
    }
}

struct ClientStoreFileLock {
    path: PathBuf,
}

impl Drop for ClientStoreFileLock {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

fn client_store_lock_file_path(path: &Path) -> PathBuf {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!("{value}.lock"))
        .unwrap_or_else(|| "lock".to_string());
    path.with_extension(extension)
}

fn is_client_store_lock_stale(lock_path: &Path) -> bool {
    let metadata = match std::fs::metadata(lock_path) {
        Ok(metadata) => metadata,
        Err(_) => return false,
    };
    let modified_at = match metadata.modified() {
        Ok(modified_at) => modified_at,
        Err(_) => return false,
    };
    match modified_at.elapsed() {
        Ok(elapsed) => elapsed > CLIENT_STORE_LOCK_STALE_TIMEOUT,
        Err(_) => false,
    }
}

fn acquire_client_store_lock(path: &Path) -> Result<ClientStoreFileLock, String> {
    let lock_path = client_store_lock_file_path(path);
    if let Some(parent) = lock_path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let deadline = Instant::now() + CLIENT_STORE_LOCK_WAIT_TIMEOUT;
    loop {
        match std::fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&lock_path)
        {
            Ok(mut file) => {
                let _ = writeln!(file, "pid={}", std::process::id());
                return Ok(ClientStoreFileLock { path: lock_path });
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                if is_client_store_lock_stale(&lock_path) {
                    let _ = std::fs::remove_file(&lock_path);
                    continue;
                }
                if Instant::now() >= deadline {
                    return Err(format!(
                        "Timed out waiting for client store lock: {}",
                        lock_path.display()
                    ));
                }
                thread::sleep(CLIENT_STORE_LOCK_RETRY_INTERVAL);
            }
            Err(error) => return Err(error.to_string()),
        }
    }
}

fn with_client_store_lock<T>(
    path: &Path,
    op: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let _lock_guard = acquire_client_store_lock(path)?;
    op()
}

fn write_string_atomically(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let parent = path
        .parent()
        .ok_or_else(|| format!("Client store path has no parent: {}", path.display()))?;
    let filename = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("Client store path has invalid filename: {}", path.display()))?;
    let temp_path = parent.join(format!(".{filename}.{}.tmp", Uuid::new_v4()));
    let mut temp_file = std::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temp_path)
        .map_err(|error| error.to_string())?;
    temp_file
        .write_all(content.as_bytes())
        .map_err(|error| error.to_string())?;
    temp_file.sync_all().map_err(|error| error.to_string())?;

    #[cfg(target_os = "windows")]
    if path.exists() {
        std::fs::remove_file(path).map_err(|error| error.to_string())?;
    }

    if let Err(error) = std::fs::rename(&temp_path, path) {
        let _ = std::fs::remove_file(&temp_path);
        return Err(error.to_string());
    }
    Ok(())
}

/// 进程内 store 缓存：避免每次 patch 都对整份 store 文件做 read + parse。
/// renderer 侧本就整份缓存并按 key 盲写 patch（单实例假设成立），
/// 写盘期间仍持有跨进程 file lock，语义不劣化。
fn store_cache() -> &'static Mutex<HashMap<PathBuf, Value>> {
    static CACHE: OnceLock<Mutex<HashMap<PathBuf, Value>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn read_store_unlocked(path: &Path) -> Result<Value, String> {
    if !path.exists() {
        return Ok(Value::Null);
    }
    let data = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

fn read_store(filename: &str) -> Result<Value, String> {
    let path = client_storage_dir()?.join(filename);
    {
        let cache = store_cache().lock().map_err(|e| e.to_string())?;
        if let Some(value) = cache.get(&path) {
            return Ok(value.clone());
        }
    }
    let value = read_store_unlocked(&path)?;
    let mut cache = store_cache().lock().map_err(|e| e.to_string())?;
    cache.insert(path, value.clone());
    Ok(value)
}

fn write_store(filename: &str, value: &Value) -> Result<(), String> {
    let dir = client_storage_dir()?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(filename);
    with_client_store_lock(&path, || {
        // compact JSON：pretty-print 对大 store 的 serialize CPU 与文件体积都是纯开销。
        let data = serde_json::to_string(value).map_err(|e| e.to_string())?;
        {
            let mut cache = store_cache().lock().map_err(|e| e.to_string())?;
            cache.insert(path.clone(), value.clone());
        }
        write_string_atomically(&path, &data)
    })
}

fn patch_store_at_path(path: &Path, patch: &serde_json::Map<String, Value>) -> Result<(), String> {
    with_client_store_lock(path, || {
        let serialized = {
            let mut cache = store_cache().lock().map_err(|e| e.to_string())?;
            if !cache.contains_key(path) {
                let value = read_store_unlocked(path)?;
                cache.insert(path.to_path_buf(), value);
            }
            let entry = cache
                .get_mut(path)
                .ok_or_else(|| "client store cache entry missing".to_string())?;
            if !entry.is_object() {
                *entry = Value::Object(serde_json::Map::new());
            }
            let map = entry
                .as_object_mut()
                .ok_or_else(|| "client store cache entry is not an object".to_string())?;
            // 只比较 patch 涉及的 key，避免对整份 store 做全量 deep equality。
            let mut changed = false;
            for (key, value) in patch {
                if map.get(key) != Some(value) {
                    map.insert(key.clone(), value.clone());
                    changed = true;
                }
            }
            if !changed {
                return Ok(());
            }
            serde_json::to_string(entry).map_err(|e| e.to_string())?
        };
        write_string_atomically(path, &serialized)
    })
}

fn patch_store(filename: &str, patch: &serde_json::Map<String, Value>) -> Result<(), String> {
    let dir = client_storage_dir()?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(filename);
    patch_store_at_path(&path, patch)
}

#[tauri::command]
pub(crate) fn client_panel_lock_password_read() -> Result<Option<String>, String> {
    let path = client_storage_dir()?.join(PANEL_LOCK_PASSWORD_FILENAME);
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(Some(content))
}

#[tauri::command]
pub(crate) fn client_panel_lock_password_write(password: String) -> Result<(), String> {
    let dir = client_storage_dir()?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(PANEL_LOCK_PASSWORD_FILENAME);
    std::fs::write(&path, password).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn client_store_read(store: String) -> Result<Value, String> {
    validate_store_name(&store)?;
    read_store(&format!("{store}.json"))
}

#[tauri::command]
pub(crate) fn client_store_write(store: String, data: Value) -> Result<(), String> {
    validate_store_name(&store)?;
    write_store(&format!("{store}.json"), &data)
}

#[tauri::command]
pub(crate) fn client_store_patch(store: String, patch: Value) -> Result<(), String> {
    validate_store_name(&store)?;
    let patch_map = patch
        .as_object()
        .ok_or_else(|| "client_store_patch expects an object patch".to_string())?;
    patch_store(&format!("{store}.json"), patch_map)
}

const KANBAN_IMAGE_DIR_NAME: &str = "kanban-images";
const MAX_KANBAN_IMAGE_BYTES: usize = 20 * 1024 * 1024;

fn kanban_image_extension(media_type: &str) -> Option<&'static str> {
    match media_type {
        "image/png" => Some("png"),
        "image/jpeg" | "image/jpg" => Some("jpg"),
        "image/gif" => Some("gif"),
        "image/webp" => Some("webp"),
        "image/bmp" => Some("bmp"),
        "image/avif" => Some("avif"),
        _ => None,
    }
}

/// 将 kanban 任务里的 base64 data URL 图片落盘为文件，返回绝对路径。
/// 避免把 MB 级 base64 存进 client store JSON（曾把 app.json 撑到 24MB）。
#[tauri::command]
pub(crate) fn client_save_kanban_image(data_url: String) -> Result<String, String> {
    use base64::Engine;

    let (media_type, payload) = data_url
        .strip_prefix("data:")
        .and_then(|rest| rest.split_once(";base64,"))
        .ok_or_else(|| "client_save_kanban_image expects a base64 image data URL".to_string())?;
    let extension = kanban_image_extension(media_type)
        .ok_or_else(|| format!("Unsupported kanban image media type: {media_type}"))?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(payload.trim().as_bytes())
        .map_err(|error| format!("Invalid kanban image base64 payload: {error}"))?;
    if bytes.is_empty() {
        return Err("Kanban image payload is empty".to_string());
    }
    if bytes.len() > MAX_KANBAN_IMAGE_BYTES {
        return Err(format!(
            "Kanban image payload too large: {} bytes",
            bytes.len()
        ));
    }
    let dir = client_storage_dir()?.join(KANBAN_IMAGE_DIR_NAME);
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let path = dir.join(format!("kanban-{}.{extension}", Uuid::new_v4()));
    std::fs::write(&path, &bytes).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::{patch_store_at_path, read_store};
    use serde_json::json;
    use uuid::Uuid;

    #[test]
    fn read_missing_file_returns_null() {
        let filename = format!("test-missing-{}.json", Uuid::new_v4());
        let result = read_store(&filename).expect("should not error");
        assert_eq!(result, serde_json::Value::Null);
    }

    #[test]
    fn write_then_read_roundtrip() {
        let dir = std::env::temp_dir().join(format!("ccgui-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        let filename = "test-roundtrip.json";
        let path = dir.join(filename);

        let value = json!({
            "sidebarWidth": 300,
            "collapsed": true
        });

        let data = serde_json::to_string_pretty(&value).unwrap();
        std::fs::write(&path, &data).unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        let read_back: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(read_back, value);

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn patch_store_skips_noop_file_write() {
        let dir = std::env::temp_dir().join(format!("ccgui-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        let path = dir.join("test-noop-patch.json");

        patch_store_at_path(
            &path,
            json!({
                "theme": "dark",
                "count": 1
            })
            .as_object()
            .unwrap(),
        )
        .expect("initial patch");
        let before_modified = std::fs::metadata(&path)
            .expect("metadata")
            .modified()
            .expect("modified");

        std::thread::sleep(std::time::Duration::from_millis(20));
        patch_store_at_path(
            &path,
            json!({
                "theme": "dark"
            })
            .as_object()
            .unwrap(),
        )
        .expect("noop patch");

        let after_modified = std::fs::metadata(&path)
            .expect("metadata")
            .modified()
            .expect("modified");
        assert_eq!(after_modified, before_modified);

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn patch_store_accumulates_keys_and_writes_compact_json() {
        let dir = std::env::temp_dir().join(format!("ccgui-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        let path = dir.join("test-compact-patch.json");

        patch_store_at_path(&path, json!({ "alpha": 1 }).as_object().unwrap())
            .expect("first patch");
        patch_store_at_path(
            &path,
            json!({ "beta": { "nested": true } }).as_object().unwrap(),
        )
        .expect("second patch");

        let content = std::fs::read_to_string(&path).expect("read store file");
        assert!(
            !content.contains('\n'),
            "store file should be compact JSON without pretty-print newlines"
        );
        let value: serde_json::Value = serde_json::from_str(&content).expect("parse store file");
        assert_eq!(value, json!({ "alpha": 1, "beta": { "nested": true } }));

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn patch_store_serves_existing_value_from_cache_after_first_read() {
        let dir = std::env::temp_dir().join(format!("ccgui-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        let path = dir.join("test-cache-patch.json");

        patch_store_at_path(&path, json!({ "keep": "value" }).as_object().unwrap())
            .expect("initial patch");
        // 模拟外部把文件删掉：cache 仍应保留 existing keys，patch 后完整写回。
        std::fs::remove_file(&path).expect("remove store file");
        patch_store_at_path(&path, json!({ "extra": 2 }).as_object().unwrap())
            .expect("patch after external delete");

        let content = std::fs::read_to_string(&path).expect("read store file");
        let value: serde_json::Value = serde_json::from_str(&content).expect("parse store file");
        assert_eq!(value, json!({ "keep": "value", "extra": 2 }));

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn save_kanban_image_extension_mapping() {
        assert_eq!(super::kanban_image_extension("image/png"), Some("png"));
        assert_eq!(super::kanban_image_extension("image/jpeg"), Some("jpg"));
        assert_eq!(super::kanban_image_extension("text/plain"), None);
    }
}
