//! 本地 ONNX embedding（Phase-3 方案 A）。
//!
//! 运行时：`ort`（ONNX Runtime）+ `tokenizers`（HuggingFace tokenizer）。
//! 模型文件查找优先级：
//!   1. **客户端默认家目录** `~/.ccgui/models/embedding/`（下载目标；与 project-memory 同根）
//!   2. 打包 resource_dir（若未来随包装载）
//!   3. 开发态仓库内路径
//!   4. 兼容旧路径：Tauri app_data_dir/models/embedding/（自动迁移到 ~/.ccgui）
//!
//! 降级合约：
//! - 模型/tokenizer 缺失 → health = unavailable + downloadable=true → 前端可触发下载
//! - 下载到 `~/.ccgui/models/embedding/`（不污染安装包；用户零独立装软件）
//! - 推理失败 → 错误传播至 worker/retrieve 各自 catch，不抛到发送路径
//! - Mutex 中毒 → recover（unwrap_or_else），不 panic
//! - health 调用自动触发懒加载（首次 health / embed 调用均可初始化 runtime）

use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};

use ort::session::Session;
use ort::value::Tensor;
use serde::Serialize;
use tauri::Emitter;
use tauri::Manager;
use tokenizers::tokenizer::{PaddingParams, Tokenizer, TruncationParams};
use tokenizers::EncodeInput;

// ── 常量 ──

const EMBEDDING_VERSION: &str = "memory-embed-v1";
const MODEL_ID: &str = "memory-embed-v1";
const PROVIDER_ID: &str = "mossx-bundled-onnx";
/// all-MiniLM-L6-v2 hidden_size；模型落地后按真实输出校正。
const DEFAULT_DIMENSIONS: usize = 384;
/// 最大输入 token 数，防止超长文本导致 OOM / 推理超时。
const MAX_SEQ_LENGTH: usize = 256;

/// HuggingFace 模型下载 URL（all-MiniLM-L6-v2，384 维，~90MB）。
const HF_ONNX_URL: &str =
    "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx";
const HF_TOKENIZER_URL: &str =
    "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json";
/// 下载进度事件名
const DOWNLOAD_PROGRESS_EVENT: &str = "embed-download-progress";

// ── 数据结构 ──

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMemoryEmbedHealth {
    pub status: String,
    pub reason: Option<String>,
    /// 模型文件缺失时 true：前端可以触发下载到 ~/.ccgui/models/embedding/
    pub downloadable: bool,
    pub provider_id: String,
    pub model_id: String,
    pub embedding_version: String,
    pub dimensions: usize,
    /// 已解析到的 onnx 路径（就绪时）
    pub model_path: Option<String>,
    /// 标准存放/下载目录（始终给出，便于 UI 展示）
    pub model_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMemoryEmbedResult {
    pub vector: Vec<f32>,
    pub dimensions: usize,
    pub embedding_version: String,
    pub model_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbedDownloadProgress {
    pub phase: String, // "tokenizer" | "model"
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
}

// ── 运行时（lazy init · 允许重试） ──

struct EmbeddingRuntime {
    session: Session,
    tokenizer: Tokenizer,
}

static EMBEDDING_RUNTIME: LazyLock<Mutex<Option<EmbeddingRuntime>>> =
    LazyLock::new(|| Mutex::new(None));

/// 锁守卫：毒化时 recovery（取回内部 Option，不 panic）。
fn lock_runtime() -> std::sync::MutexGuard<'static, Option<EmbeddingRuntime>> {
    EMBEDDING_RUNTIME
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

// ── 模型路径探测 ──

const ONNX_FILE_NAME: &str = "memory-embed-v1.onnx";
const TOKENIZER_FILE_NAME: &str = "tokenizer.json";

/// resource / 开发目录下的相对路径候选（root 为 resource_dir 或 resources/）
fn model_relative_candidates() -> Vec<&'static str> {
    vec![
        "models/embedding/memory-embed-v1.onnx",
        "resources/models/embedding/memory-embed-v1.onnx",
        "embedding/memory-embed-v1.onnx",
    ]
}

/// 客户端默认家目录下的模型目录：`~/.ccgui/models/embedding/`
/// （与 project-memory / config 同根；**不是** macOS Application Support bundle id 路径）
fn embed_model_ccgui_dir() -> Option<PathBuf> {
    crate::app_paths::app_home_dir()
        .ok()
        .map(|home| home.join("models").join("embedding"))
}

/// 旧版误用的 Tauri app_data 路径（仅迁移用）
fn embed_model_legacy_app_data_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("models").join("embedding"))
}

/// 下载与查找的权威目录：始终 `~/.ccgui/models/embedding/`
fn embed_model_data_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let _ = app; // 保留签名与调用点一致
    embed_model_ccgui_dir()
}

/// 若旧 Application Support 路径有模型而 ~/.ccgui 没有，复制过去（一次性兼容）。
fn migrate_legacy_model_dir_if_needed(app: &tauri::AppHandle) {
    let Some(dest_dir) = embed_model_ccgui_dir() else {
        return;
    };
    let dest_onnx = dest_dir.join(ONNX_FILE_NAME);
    let dest_tok = dest_dir.join(TOKENIZER_FILE_NAME);
    if dest_onnx.is_file() && dest_tok.is_file() {
        return;
    }
    let Some(src_dir) = embed_model_legacy_app_data_dir(app) else {
        return;
    };
    let src_onnx = src_dir.join(ONNX_FILE_NAME);
    let src_tok = src_dir.join(TOKENIZER_FILE_NAME);
    if !src_onnx.is_file() || !src_tok.is_file() {
        return;
    }
    if let Err(e) = std::fs::create_dir_all(&dest_dir) {
        log::warn!("[embed] migrate mkdir failed: {}", e);
        return;
    }
    for (src, dest) in [(&src_onnx, &dest_onnx), (&src_tok, &dest_tok)] {
        if dest.is_file() {
            continue;
        }
        match std::fs::copy(src, dest) {
            Ok(_) => log::info!(
                "[embed] migrated {} → {}",
                src.display(),
                dest.display()
            ),
            Err(e) => log::warn!(
                "[embed] migrate copy failed {} → {}: {}",
                src.display(),
                dest.display(),
                e
            ),
        }
    }
}

/// 数据目录扁平布局是否完整（下载目标）。
fn data_dir_model_pair(app: &tauri::AppHandle) -> Option<(PathBuf, PathBuf)> {
    migrate_legacy_model_dir_if_needed(app);
    let dir = embed_model_data_dir(app)?;
    let onnx = dir.join(ONNX_FILE_NAME);
    let tokenizer = dir.join(TOKENIZER_FILE_NAME);
    if onnx.is_file() && tokenizer.is_file() {
        Some((onnx, tokenizer))
    } else {
        None
    }
}

fn resolve_model_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    // 优先级 1：~/.ccgui/models/embedding/（扁平）
    if let Some((onnx, _)) = data_dir_model_pair(app) {
        log::info!("[embed] found model at {}", onnx.display());
        return Some(onnx);
    }

    // 优先级 2：打包 resource_dir / 开发态仓库 resources
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        roots.push(resource_dir);
    }
    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd.join("src-tauri").join("resources"));
        roots.push(cwd.join("resources"));
        roots.push(cwd.join("resources").join("models").join("embedding"));
        roots.push(cwd.join("models").join("embedding"));
    }

    for root in roots {
        let flat = root.join(ONNX_FILE_NAME);
        if flat.is_file() {
            let tok = root.join(TOKENIZER_FILE_NAME);
            if tok.is_file() {
                log::info!("[embed] found model at {}", flat.display());
                return Some(flat);
            }
        }
        for rel in model_relative_candidates() {
            let candidate = root.join(rel);
            if candidate.is_file() {
                let parent = candidate.parent()?;
                if parent.join(TOKENIZER_FILE_NAME).is_file() {
                    log::info!("[embed] found model at {}", candidate.display());
                    return Some(candidate);
                }
            }
        }
    }
    None
}

/// 模型是否存在于标准下载目录（~/.ccgui/...）。
fn model_exists_in_data_dir(app: &tauri::AppHandle) -> bool {
    data_dir_model_pair(app).is_some()
}

fn tokenizer_path(model_dir: &Path) -> PathBuf {
    model_dir.join("tokenizer.json")
}

// ── 加载 ──

fn try_load_runtime(model_path: &Path) -> Option<EmbeddingRuntime> {
    let model_dir = model_path.parent()?;
    let tok_path = tokenizer_path(model_dir);

    if !tok_path.is_file() {
        log::warn!("[embed] tokenizer.json not found at {}", tok_path.display());
        return None;
    }

    let mut tokenizer = match Tokenizer::from_file(&tok_path) {
        Ok(t) => t,
        Err(e) => {
            log::warn!("[embed] failed to load tokenizer: {}", e);
            return None;
        }
    };

    // 防御：截断过长文本 + padding，避免 OOM / 推理超时
    let _ = tokenizer.with_truncation(Some(TruncationParams {
        max_length: MAX_SEQ_LENGTH,
        strategy: tokenizers::TruncationStrategy::LongestFirst,
        direction: tokenizers::TruncationDirection::Right,
        stride: 0,
    }));
    let _ = tokenizer.with_padding(Some(PaddingParams {
        strategy: tokenizers::PaddingStrategy::BatchLongest,
        ..Default::default()
    }));

    let session: Session = match Session::builder() {
        Ok(mut b) => match b.commit_from_file(model_path) {
            Ok(s) => s,
            Err(e) => {
                log::warn!("[embed] commit_from_file failed: {}", e);
                return None;
            }
        },
        Err(e) => {
            log::warn!("[embed] Session::builder failed: {}", e);
            return None;
        }
    };

    log::info!(
        "[embed] runtime ready: model={} inputs={} outputs={}",
        model_path.display(),
        session.inputs().len(),
        session.outputs().len(),
    );

    Some(EmbeddingRuntime { session, tokenizer })
}

fn ensure_runtime(app: &tauri::AppHandle) -> Result<(), String> {
    // 快速路径：已加载直接返回（不持锁做 I/O）
    {
        let guard = lock_runtime();
        if guard.is_some() {
            return Ok(());
        }
    } // 释放锁

    let model_path =
        resolve_model_path(app).ok_or_else(|| "model_resource_missing".to_string())?;

    // 在锁外完成 I/O 重量级加载
    let loaded = try_load_runtime(&model_path);

    // 写入缓存：只有 None → Some 才更新；已经是 Some 则保留（先到先得）
    let mut guard = lock_runtime();
    if guard.is_none() {
        *guard = loaded;
    }

    match guard.as_ref() {
        Some(_) => Ok(()),
        None => Err("runtime_load_failed".to_string()),
    }
}

// ── 推理 ──

/// mean pooling + L2 normalize（对标 sentence-transformers）
fn mean_pool(
    token_embeddings: &[f32],
    attention_mask: &[i64],
    seq_len: usize,
    hidden_size: usize,
) -> Vec<f32> {
    let mut result = vec![0.0f32; hidden_size];
    let mut mask_sum = 0.0f32;

    for i in 0..seq_len {
        let mask = attention_mask[i] as f32;
        if mask == 0.0 {
            continue;
        }
        mask_sum += mask;
        let offset = i * hidden_size;
        for j in 0..hidden_size {
            result[j] += token_embeddings[offset + j] * mask;
        }
    }

    if mask_sum > 0.0 {
        for v in result.iter_mut() {
            *v /= mask_sum;
        }
    }

    // L2 normalize
    let norm: f32 = result.iter().map(|v| v * v).sum::<f32>().sqrt();
    if norm > 0.0 {
        for v in result.iter_mut() {
            *v /= norm;
        }
    }

    result
}

fn run_embed(text: &str, rt: &mut EmbeddingRuntime) -> Result<Vec<f32>, String> {
    let input: EncodeInput = EncodeInput::Single(text.into());
    let encoding = rt
        .tokenizer
        .encode(input, true)
        .map_err(|e| format!("tokenize error: {}", e))?;

    let seq_len = encoding.len();
    if seq_len == 0 {
        return Err("empty tokenization".to_string());
    }

    let token_ids: Vec<i64> = encoding.get_ids().iter().map(|&id| id as i64).collect();
    let attention_mask: Vec<i64> = encoding
        .get_attention_mask()
        .iter()
        .map(|&m| m as i64)
        .collect();

    let input_count = rt.session.inputs().len();
    let shape = [1i64, seq_len as i64];

    let id_tensor = Tensor::from_array((shape.to_vec(), token_ids.into_boxed_slice()))
        .map_err(|e| format!("input_ids tensor: {}", e))?;

    let mask_tensor =
        Tensor::from_array((shape.to_vec(), attention_mask.clone().into_boxed_slice()))
            .map_err(|e| format!("attention_mask tensor: {}", e))?;

    let outputs = if input_count >= 3 {
        let type_ids: Vec<i64> = vec![0i64; seq_len];
        let type_tensor = Tensor::from_array((shape.to_vec(), type_ids.into_boxed_slice()))
            .map_err(|e| format!("type_ids tensor: {}", e))?;

        rt.session
            .run(ort::inputs![id_tensor, mask_tensor, type_tensor])
            .map_err(|e| format!("inference error (3 inputs): {}", e))?
    } else if input_count == 2 {
        rt.session
            .run(ort::inputs![id_tensor, mask_tensor])
            .map_err(|e| format!("inference error (2 inputs): {}", e))?
    } else {
        return Err(format!(
            "unexpected input count {} (expected 2 or 3)",
            input_count
        ));
    };

    // 取第一个输出（通常是 last_hidden_state）
    let output = outputs.values().next().ok_or("no output tensor")?;

    let output_array = output
        .try_extract_array::<f32>()
        .map_err(|e| format!("extract output: {}", e))?;

    let output_data = output_array
        .as_slice()
        .ok_or("tensor memory not contiguous")?;

    let hidden_size = DEFAULT_DIMENSIONS;
    if output_data.len() != seq_len * hidden_size {
        return Err(format!(
            "output size mismatch: got {} expected {}×{}",
            output_data.len(),
            seq_len,
            hidden_size,
        ));
    }

    let pooled = mean_pool(output_data, &attention_mask, seq_len, hidden_size);
    Ok(pooled)
}

// ── Tauri commands ──

fn health_from_runtime(app: &tauri::AppHandle) -> ProjectMemoryEmbedHealth {
    let model_dir_str = embed_model_data_dir(app).map(|p| p.display().to_string());
    let model_path = resolve_model_path(app);
    let model_path_str = model_path.as_ref().map(|p| p.display().to_string());
    let model_found = model_path.is_some();

    // health 调用也触发懒加载，避免前端先调 health 看到 unavailable 就永久走 lexical
    let runtime_ok = if model_found {
        ensure_runtime(app).is_ok()
    } else {
        false
    };

    // downloadable：标准 ~/.ccgui 目录尚无完整模型 → 可触发下载
    let on_disk = model_exists_in_data_dir(app);
    let downloadable = !on_disk && !model_found;

    ProjectMemoryEmbedHealth {
        status: if runtime_ok {
            "available"
        } else if on_disk && !runtime_ok {
            // 已下载但加载失败（路径/ORT/模型不兼容）
            "error"
        } else {
            "unavailable"
        }
        .to_string(),
        reason: if !model_found && !on_disk {
            Some("model_resource_missing".to_string())
        } else if !runtime_ok {
            Some("runtime_load_failed".to_string())
        } else {
            None
        },
        downloadable,
        provider_id: PROVIDER_ID.to_string(),
        model_id: MODEL_ID.to_string(),
        embedding_version: EMBEDDING_VERSION.to_string(),
        dimensions: DEFAULT_DIMENSIONS,
        model_path: model_path_str,
        model_dir: model_dir_str,
    }
}

#[tauri::command]
pub(crate) async fn project_memory_embed_health(
    app: tauri::AppHandle,
) -> Result<ProjectMemoryEmbedHealth, String> {
    Ok(health_from_runtime(&app))
}

#[tauri::command]
pub(crate) async fn project_memory_embed_text(
    app: tauri::AppHandle,
    text: String,
) -> Result<ProjectMemoryEmbedResult, String> {
    ensure_runtime(&app)?;

    let mut guard = lock_runtime();
    let rt = guard
        .as_mut()
        .ok_or_else(|| "runtime_not_loaded".to_string())?;

    let vector = run_embed(&text, rt)?;

    Ok(ProjectMemoryEmbedResult {
        vector,
        dimensions: DEFAULT_DIMENSIONS,
        embedding_version: EMBEDDING_VERSION.to_string(),
        model_id: MODEL_ID.to_string(),
    })
}

// ── 自动下载 ──

/// 流式下载文件到目标路径（atomic：先写 .download 临时文件，成功后 rename）。
/// 临时文件路径（跨平台：不用 with_extension，避免 `file.onnx` → 意外后缀）
fn download_tmp_path(dest: &Path) -> PathBuf {
    let file_name = dest
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("download.bin");
    // stem + .download：memory-embed-v1.onnx → memory-embed-v1.onnx.download
    dest.with_file_name(format!("{file_name}.download"))
}

async fn download_file(
    url: &str,
    dest: &Path,
    phase: &str,
    app: &tauri::AppHandle,
) -> Result<(), String> {
    // 跟随重定向；超时拉长以兼容慢网（约 90MB 模型）
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| format!("http client: {}", e))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("download request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "download http {}: {}",
            response.status(),
            url
        ));
    }

    let total = response.content_length().unwrap_or(0);
    let tmp = download_tmp_path(dest);

    if let Some(parent) = tmp.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir: {}", e))?;
    }

    // 清理上次失败残留
    let _ = std::fs::remove_file(&tmp);

    let mut file = tokio::fs::File::create(&tmp)
        .await
        .map_err(|e| format!("create tmp file: {}", e))?;

    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;

    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("download chunk: {}", e))?;
        tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(|e| format!("write chunk: {}", e))?;
        downloaded += chunk.len() as u64;

        let _ = app.emit(
            DOWNLOAD_PROGRESS_EVENT,
            EmbedDownloadProgress {
                phase: phase.to_string(),
                downloaded_bytes: downloaded,
                total_bytes: total,
            },
        );
    }

    tokio::io::AsyncWriteExt::flush(&mut file)
        .await
        .map_err(|e| format!("flush: {}", e))?;
    // 关闭文件再 rename（Windows 上句柄未关可能导致 rename 失败）
    drop(file);

    // 目标已存在则先删（Windows replace 更稳）
    if dest.exists() {
        let _ = std::fs::remove_file(dest);
    }
    std::fs::rename(&tmp, dest).map_err(|e| format!("rename: {}", e))?;

    log::info!(
        "[embed] downloaded {} ({:.1} MB) to {}",
        phase,
        downloaded as f64 / 1_000_000.0,
        dest.display(),
    );

    Ok(())
}

#[tauri::command]
pub(crate) async fn project_memory_embed_download(
    app: tauri::AppHandle,
) -> Result<ProjectMemoryEmbedHealth, String> {
    let model_dir = embed_model_data_dir(&app)
        .ok_or_else(|| "app_data_dir_unavailable".to_string())?;
    std::fs::create_dir_all(&model_dir).map_err(|e| format!("mkdir model dir: {}", e))?;

    let onnx_path = model_dir.join(ONNX_FILE_NAME);
    let tokenizer_path = model_dir.join(TOKENIZER_FILE_NAME);

    // 已存在则跳过下载，直接加载
    let need_onnx = !onnx_path.is_file();
    let need_tokenizer = !tokenizer_path.is_file();

    if !need_onnx && !need_tokenizer {
        log::info!(
            "[embed] model already at {}, reloading runtime",
            model_dir.display()
        );
    }

    if need_tokenizer {
        log::info!("[embed] downloading tokenizer (0.5MB)...");
        download_file(HF_TOKENIZER_URL, &tokenizer_path, "tokenizer", &app).await?;
    }

    if need_onnx {
        log::info!("[embed] downloading ONNX model (~90MB)...");
        download_file(HF_ONNX_URL, &onnx_path, "model", &app).await?;
    }

    // 下载完成 → 重置 runtime 缓存，强制用数据目录路径重新加载
    __reset_embedding_runtime_for_tests();

    // 强制 ensure 一次，避免 health 只看路径不加载
    if let Err(e) = ensure_runtime(&app) {
        log::warn!("[embed] post-download ensure_runtime failed: {}", e);
        return Ok(ProjectMemoryEmbedHealth {
            status: "error".to_string(),
            reason: Some(e),
            downloadable: false,
            provider_id: PROVIDER_ID.to_string(),
            model_id: MODEL_ID.to_string(),
            embedding_version: EMBEDDING_VERSION.to_string(),
            dimensions: DEFAULT_DIMENSIONS,
            model_path: Some(onnx_path.display().to_string()),
            model_dir: Some(model_dir.display().to_string()),
        });
    }

    Ok(health_from_runtime(&app))
}

/// 删除指定目录下的模型文件（onnx / tokenizer / 临时 .download）。
fn remove_model_files_in_dir(model_dir: &Path) -> Result<(), String> {
    if !model_dir.exists() {
        return Ok(());
    }
    let onnx_path = model_dir.join(ONNX_FILE_NAME);
    let tokenizer_path = model_dir.join(TOKENIZER_FILE_NAME);
    let tmp_onnx = download_tmp_path(&onnx_path);
    let tmp_tok = download_tmp_path(&tokenizer_path);

    for path in [&onnx_path, &tokenizer_path, &tmp_onnx, &tmp_tok] {
        if path.exists() {
            std::fs::remove_file(path).map_err(|e| {
                format!("remove {}: {}", path.display(), e)
            })?;
            log::info!("[embed] removed {}", path.display());
        }
    }
    // 目录空则尝试删除（非致命；Windows 上目录非空会失败，可忽略）
    let _ = std::fs::remove_dir(model_dir);
    Ok(())
}

/// 删除本地语义模型（~/.ccgui + 旧 Application Support 副本）并卸载 runtime。
#[tauri::command]
pub(crate) async fn project_memory_embed_remove(
    app: tauri::AppHandle,
) -> Result<ProjectMemoryEmbedHealth, String> {
    __reset_embedding_runtime_for_tests();

    // 1) 标准路径 ~/.ccgui/models/embedding
    if let Some(model_dir) = embed_model_data_dir(&app) {
        remove_model_files_in_dir(&model_dir)?;
    }

    // 2) 旧 Tauri app_data 副本（否则 migrate 会把文件再拷回 ~/.ccgui）
    if let Some(legacy_dir) = embed_model_legacy_app_data_dir(&app) {
        if let Err(e) = remove_model_files_in_dir(&legacy_dir) {
            log::warn!("[embed] remove legacy dir failed: {}", e);
        }
    }

    Ok(health_from_runtime(&app))
}

// ── 测试辅助（依赖注入口） ──

/// 仅测试用：清空缓存的 runtime（下次调用会重新加载）。
#[allow(dead_code)]
pub(crate) fn __reset_embedding_runtime_for_tests() {
    if let Ok(mut guard) = EMBEDDING_RUNTIME.lock() {
        *guard = None;
    }
}
