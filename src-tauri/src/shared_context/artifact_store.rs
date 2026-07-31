use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypedArtifactStoreRecord {
    pub artifact_id: String,
    pub workspace_id: String,
    pub session_id: String,
    pub checksum: String,
    pub media_type: String,
    pub created_at: i64,
    pub reference_only: bool,
    pub payload: Value,
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

fn package_checksum(package: &ContextPackage) -> Result<String, String> {
    let bytes = deterministic_json_bytes(
        &serde_json::to_value(package).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    Ok(format!("sha256:{:x}", Sha256::digest(bytes)))
}

#[cfg(unix)]
fn sync_parent_directory(directory: &Path) -> Result<(), String> {
    File::open(directory)
        .and_then(|directory_file| directory_file.sync_all())
        .map_err(|error| error.to_string())
}

#[cfg(not(unix))]
fn sync_parent_directory(_directory: &Path) -> Result<(), String> {
    Ok(())
}

fn write_atomic_json(path: &Path, artifact_id: &str, bytes: &[u8]) -> Result<(), String> {
    let directory = path
        .parent()
        .ok_or_else(|| "artifact directory unavailable".to_string())?;
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    let temporary = directory.join(format!(".{artifact_id}.{}.tmp", Uuid::new_v4()));
    let publish = (|| {
        let mut file = File::options()
            .create_new(true)
            .write(true)
            .open(&temporary)
            .map_err(|error| error.to_string())?;
        file.write_all(bytes).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        match fs::rename(&temporary, path) {
            Ok(()) => sync_parent_directory(directory),
            Err(_) if path.exists() => Ok(()),
            Err(error) => Err(error.to_string()),
        }
    })();
    if publish.is_err() || temporary.exists() {
        let _ = fs::remove_file(&temporary);
    }
    publish
}

fn quarantine_invalid_artifact(path: &Path, artifact_id: &str) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let directory = path
        .parent()
        .ok_or_else(|| "artifact directory unavailable".to_string())?;
    let quarantine = directory.join(format!(".{artifact_id}.{}.corrupt", Uuid::new_v4()));
    match fs::rename(path, quarantine) {
        Ok(()) => Ok(()),
        Err(_) if !path.exists() => Ok(()),
        Err(error) => Err(error.to_string()),
    }
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
        checksum: package_checksum(package)?,
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
    if destination.exists() {
        let request = ArtifactReadRequest {
            workspace_id: workspace_id.to_string(),
            session_id: session_id.to_string(),
            artifact_id: artifact_id.clone(),
            checksum: record.checksum.clone(),
        };
        if let Ok(existing) = read_artifact(root, &request) {
            return Ok(existing);
        }
        quarantine_invalid_artifact(&destination, &artifact_id)?;
    }
    write_atomic_json(&destination, &record.artifact_id, &bytes)?;
    read_artifact(
        root,
        &ArtifactReadRequest {
            workspace_id: workspace_id.to_string(),
            session_id: session_id.to_string(),
            artifact_id,
            checksum: record.checksum,
        },
    )
}

pub fn write_typed_artifact(
    root: &Path,
    workspace_id: &str,
    session_id: &str,
    media_type: &str,
    payload: &Value,
    created_at: i64,
) -> Result<TypedArtifactStoreRecord, String> {
    let payload_bytes = deterministic_json_bytes(payload).map_err(|error| error.to_string())?;
    let checksum = format!("sha256:{:x}", Sha256::digest(&payload_bytes));
    let artifact_id = checksum.trim_start_matches("sha256:").to_string();
    let record = TypedArtifactStoreRecord {
        artifact_id: artifact_id.clone(),
        workspace_id: workspace_id.to_string(),
        session_id: session_id.to_string(),
        checksum,
        media_type: media_type.to_string(),
        created_at,
        reference_only: true,
        payload: payload.clone(),
    };
    let bytes = deterministic_json_bytes(
        &serde_json::to_value(&record).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    let destination = artifact_path(root, workspace_id, session_id, &artifact_id)?;
    if destination.exists() {
        let request = ArtifactReadRequest {
            workspace_id: workspace_id.to_string(),
            session_id: session_id.to_string(),
            artifact_id: artifact_id.clone(),
            checksum: record.checksum.clone(),
        };
        if let Ok(existing) = read_typed_artifact(root, &request) {
            return Ok(existing);
        }
        quarantine_invalid_artifact(&destination, &artifact_id)?;
    }
    write_atomic_json(&destination, &record.artifact_id, &bytes)?;
    read_typed_artifact(
        root,
        &ArtifactReadRequest {
            workspace_id: workspace_id.to_string(),
            session_id: session_id.to_string(),
            artifact_id,
            checksum: record.checksum,
        },
    )
}

pub fn read_typed_artifact(
    root: &Path,
    request: &ArtifactReadRequest,
) -> Result<TypedArtifactStoreRecord, String> {
    let path = artifact_path(
        root,
        &request.workspace_id,
        &request.session_id,
        &request.artifact_id,
    )?;
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let record: TypedArtifactStoreRecord =
        serde_json::from_slice(&bytes).map_err(|error| error.to_string())?;
    if record.workspace_id != request.workspace_id
        || record.session_id != request.session_id
        || record.artifact_id != request.artifact_id
        || record.checksum != request.checksum
        || !record.reference_only
    {
        return Err("artifact ownership or checksum mismatch".to_string());
    }
    let payload_checksum = format!(
        "sha256:{:x}",
        Sha256::digest(
            deterministic_json_bytes(&record.payload).map_err(|error| error.to_string())?
        )
    );
    if payload_checksum != record.checksum {
        return Err("artifact payload checksum mismatch".to_string());
    }
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
    if package_checksum(&record.package)? != record.checksum {
        return Err("artifact payload checksum mismatch".to_string());
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
            } else if matches!(
                path.extension().and_then(|value| value.to_str()),
                Some("tmp" | "corrupt")
            ) {
                output.push(path.to_string_lossy().to_string());
            } else if path.extension().and_then(|value| value.to_str()) == Some("json") {
                let bytes = fs::read(&path).ok();
                if let Some(record) = bytes
                    .as_deref()
                    .and_then(|bytes| serde_json::from_slice::<ArtifactStoreRecord>(bytes).ok())
                {
                    if !is_referenced(&record) {
                        output.push(path.to_string_lossy().to_string());
                    }
                } else if bytes.as_deref().is_some_and(|bytes| {
                    serde_json::from_slice::<TypedArtifactStoreRecord>(bytes).is_err()
                }) {
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::{Arc, Barrier};
    use std::thread;

    fn package() -> ContextPackage {
        serde_json::from_value(json!({
            "schemaVersion": 1,
            "packageId": "sha256:package-a",
            "sessionId": "session-a",
            "bindingKey": "binding-a",
            "source": {
                "kind": "shared-canonical",
                "session_id": "session-a",
                "from_sequence_exclusive": null,
                "through_sequence_inclusive": 1
            },
            "destination": {"engine": "claude"},
            "stablePrefix": "prefix",
            "delta": [],
            "promptPrefix": "prompt",
            "manifest": {
                "compilerVersion": "test",
                "mode": "portable-transcript",
                "modeReason": "test",
                "includedEntryIds": [],
                "omitted": [],
                "throughSequenceInclusive": 1,
                "sourceChecksum": "sha256:source"
            },
            "compression": {
                "estimator": "test",
                "sourceEstimatedTokens": 1,
                "packageEstimatedTokens": 1,
                "perCategory": []
            }
        }))
        .expect("package fixture")
    }

    #[test]
    fn typed_artifact_round_trips_and_is_not_a_legacy_orphan() {
        let root = std::env::temp_dir().join(format!("mossx-typed-artifact-{}", Uuid::new_v4()));
        let written = write_typed_artifact(
            &root,
            "workspace-a",
            "session-a",
            "application/vnd.mossx.native-history+json",
            &json!({"entries": [{"role": "user", "text": "hello"}]}),
            1,
        )
        .expect("write");
        let read = read_typed_artifact(
            &root,
            &ArtifactReadRequest {
                workspace_id: "workspace-a".to_string(),
                session_id: "session-a".to_string(),
                artifact_id: written.artifact_id,
                checksum: written.checksum,
            },
        )
        .expect("read");

        assert_eq!(read.payload["entries"][0]["text"], "hello");
        assert!(scan_orphan_artifacts(&root, |_| true)
            .expect("scan")
            .is_empty());
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn package_artifact_rejects_tampered_payload() {
        let root = std::env::temp_dir().join(format!("mossx-package-artifact-{}", Uuid::new_v4()));
        let written =
            write_artifact(&root, "workspace-a", "session-a", &package(), 1).expect("write");
        let path =
            artifact_path(&root, "workspace-a", "session-a", &written.artifact_id).expect("path");
        let mut record: Value =
            serde_json::from_slice(&fs::read(&path).expect("read raw")).expect("parse raw");
        record["package"]["promptPrefix"] = json!("tampered");
        fs::write(&path, serde_json::to_vec(&record).expect("serialize")).expect("tamper");

        let error = read_artifact(
            &root,
            &ArtifactReadRequest {
                workspace_id: "workspace-a".to_string(),
                session_id: "session-a".to_string(),
                artifact_id: written.artifact_id,
                checksum: written.checksum,
            },
        )
        .expect_err("tamper must fail");
        assert!(error.contains("payload checksum mismatch"));
        let repaired =
            write_artifact(&root, "workspace-a", "session-a", &package(), 2).expect("repair");
        assert_eq!(repaired.package.prompt_prefix, "prompt");
        assert!(scan_orphan_artifacts(&root, |_| true)
            .expect("scan")
            .iter()
            .any(|path| path.ends_with(".corrupt")));
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn concurrent_package_writers_observe_one_valid_artifact() {
        let root = Arc::new(
            std::env::temp_dir().join(format!("mossx-concurrent-artifact-{}", Uuid::new_v4())),
        );
        let barrier = Arc::new(Barrier::new(3));
        let handles = (0..2)
            .map(|created_at| {
                let root = Arc::clone(&root);
                let barrier = Arc::clone(&barrier);
                thread::spawn(move || {
                    barrier.wait();
                    write_artifact(
                        root.as_path(),
                        "workspace-a",
                        "session-a",
                        &package(),
                        created_at,
                    )
                })
            })
            .collect::<Vec<_>>();
        barrier.wait();
        let records = handles
            .into_iter()
            .map(|handle| handle.join().expect("writer").expect("publish"))
            .collect::<Vec<_>>();
        assert_eq!(records[0].checksum, records[1].checksum);
        assert_eq!(records[0].package, records[1].package);
        assert!(scan_orphan_artifacts(root.as_path(), |_| true)
            .expect("scan")
            .is_empty());
        fs::remove_dir_all(root.as_path()).ok();
    }
}
