use std::path::PathBuf;

use crate::storage::{with_storage_lock, write_bytes_atomically};

const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";
const MAX_MERMAID_PNG_BYTES: usize = 128 * 1024 * 1024;

fn validate_mermaid_png_payload(png_bytes: &[u8], max_bytes: usize) -> Result<(), String> {
    if png_bytes.len() > max_bytes {
        return Err("Mermaid PNG payload exceeds the 128 MiB export limit.".to_string());
    }
    if !png_bytes.starts_with(PNG_SIGNATURE) {
        return Err("Mermaid PNG payload has an invalid PNG signature.".to_string());
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn save_mermaid_png(path: String, png_bytes: Vec<u8>) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("Mermaid PNG target path is required.".to_string());
    }
    validate_mermaid_png_payload(&png_bytes, MAX_MERMAID_PNG_BYTES)?;

    let target_path = PathBuf::from(path);
    with_storage_lock(&target_path, || {
        write_bytes_atomically(&target_path, &png_bytes)
            .map_err(|error| format!("Failed to save Mermaid PNG: {error}"))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn valid_png_bytes() -> Vec<u8> {
        [PNG_SIGNATURE.as_slice(), b"test-payload"].concat()
    }

    #[test]
    fn saves_valid_png_payload() {
        let target =
            std::env::temp_dir().join(format!("ccgui-mermaid-export-{}.png", Uuid::new_v4()));
        let expected = valid_png_bytes();

        save_mermaid_png(target.to_string_lossy().into_owned(), expected.clone())
            .expect("valid PNG should be saved");

        assert_eq!(
            std::fs::read(&target).expect("saved PNG should exist"),
            expected
        );
        let _ = std::fs::remove_file(target);
    }

    #[test]
    fn rejects_invalid_signature_without_writing() {
        let target = std::env::temp_dir().join(format!(
            "ccgui-invalid-mermaid-export-{}.png",
            Uuid::new_v4()
        ));

        let error = save_mermaid_png(target.to_string_lossy().into_owned(), b"not-a-png".to_vec())
            .expect_err("invalid PNG should be rejected");

        assert!(error.contains("invalid PNG signature"));
        assert!(!target.exists());
    }

    #[test]
    fn rejects_payload_over_configured_budget() {
        let payload = [PNG_SIGNATURE.as_slice(), b"x"].concat();

        let error = validate_mermaid_png_payload(&payload, PNG_SIGNATURE.len())
            .expect_err("oversized PNG should be rejected");

        assert!(error.contains("128 MiB export limit"));
    }
}
