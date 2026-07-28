use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::shared_event_log::deterministic_json_bytes;

use super::ContextPackage;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactStoreRecord {
    pub artifact_id: String,
    pub workspace_id: String,
    pub session_id: String,
    pub checksum: String,
    pub media_type: String,
    pub created_at: i64,
    pub reference_only: bool,
    pub package: ContextPackage,
}

#[derive(Debug, Clone)]
pub struct ArtifactReadRequest {
    pub workspace_id: String,
    pub session_id: String,
    pub artifact_id: String,
    pub checksum: String,
}

fn safe_segment(value: &str, field: &str) -> Result<(), String> {
    if value.is_empty()
        || value == "."
        || value == ".."
        || value.contains('/')
        || value.contains('\\')
    {
        return Err(format!("invalid {field}"));
    }
    Ok(())
}

fn workspace_hash(workspace_id: &str) -> String {
    Sha256::digest(workspace_id.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()
}

fn artifact_dir(root: &Path, workspace_id: &str, session_id: &str) -> Result<PathBuf, String> {
    safe_segment(session_id, "session id")?;
    Ok(root
        .join("shared-context-artifacts")
        .join(workspace_hash(workspace_id))
        .join(session_id))
}

fn artifact_path(
    root: &Path,
    workspace_id: &str,
    session_id: &str,
    artifact_id: &str,
) -> Result<PathBuf, String> {
    safe_segment(artifact_id, "artifact id")?;
    Ok(artifact_dir(root, workspace_id, session_id)?.join(format!("{artifact_id}.json")))
}

pub fn write_artifact(
    root: &Path,
    workspace_id: &str,
    session_id: &str,
    package: &ContextPackage,
    created_at: i64,
) -> Result<ArtifactStoreRecord, String> {
    let artifact_id = package.package_id.trim_start_matches("sha256:").to_string();
    let record = ArtifactStoreRecord {
        artifact_id: artifact_id.clone(),
        workspace_id: workspace_id.to_string(),
        session_id: session_id.to_string(),
        checksum: package.manifest.source_checksum.clone(),
        media_type: "application/vnd.mossx.context-package+json".to_string(),
        created_at,
        reference_only: true,
        package: package.clone(),
    };
    let bytes = deterministic_json_bytes(
        &serde_json::to_value(&record).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    let destination = artifact_path(root, workspace_id, session_id, &artifact_id)?;
    let directory = destination
        .parent()
        .ok_or_else(|| "artifact directory unavailable".to_string())?;
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    if destination.exists() {
        return read_artifact(
            root,
            &ArtifactReadRequest {
                workspace_id: workspace_id.to_string(),
                session_id: session_id.to_string(),
                artifact_id,
                checksum: record.checksum.clone(),
            },
        );
    }
    let temporary = directory.join(format!(".{}.{}.tmp", record.artifact_id, Uuid::new_v4()));
    let mut file = File::create(&temporary).map_err(|error| error.to_string())?;
    file.write_all(&bytes).map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())?;
    fs::rename(&temporary, &destination).map_err(|error| error.to_string())?;
    File::open(directory)
        .and_then(|directory_file| directory_file.sync_all())
        .map_err(|error| error.to_string())?;
    Ok(record)
}

pub fn read_artifact(
    root: &Path,
    request: &ArtifactReadRequest,
) -> Result<ArtifactStoreRecord, String> {
    let path = artifact_path(
        root,
        &request.workspace_id,
        &request.session_id,
        &request.artifact_id,
    )?;
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let record: ArtifactStoreRecord =
        serde_json::from_slice(&bytes).map_err(|error| error.to_string())?;
    if record.workspace_id != request.workspace_id
        || record.session_id != request.session_id
        || record.artifact_id != request.artifact_id
        || record.checksum != request.checksum
        || !record.reference_only
    {
        return Err("artifact ownership or checksum mismatch".to_string());
    }
    Ok(record)
}

pub fn scan_orphan_artifacts(
    root: &Path,
    is_referenced: impl Fn(&ArtifactStoreRecord) -> bool,
) -> Result<Vec<String>, String> {
    let base = root.join("shared-context-artifacts");
    if !base.exists() {
        return Ok(Vec::new());
    }
    let mut orphans = Vec::new();
    fn walk(
        directory: &Path,
        output: &mut Vec<String>,
        is_referenced: &impl Fn(&ArtifactStoreRecord) -> bool,
    ) -> Result<(), String> {
        for entry in fs::read_dir(directory).map_err(|error| error.to_string())? {
            let path = entry.map_err(|error| error.to_string())?.path();
            if path.is_dir() {
                walk(&path, output, is_referenced)?;
            } else if path.extension().and_then(|value| value.to_str()) == Some("tmp") {
                output.push(path.to_string_lossy().to_string());
            } else if path.extension().and_then(|value| value.to_str()) == Some("json") {
                let record = fs::read(&path)
                    .ok()
                    .and_then(|bytes| serde_json::from_slice::<ArtifactStoreRecord>(&bytes).ok());
                if record
                    .as_ref()
                    .map(|record| !is_referenced(record))
                    .unwrap_or(true)
                {
                    output.push(path.to_string_lossy().to_string());
                }
            }
        }
        Ok(())
    }
    walk(&base, &mut orphans, &is_referenced)?;
    orphans.sort();
    Ok(orphans)
}
