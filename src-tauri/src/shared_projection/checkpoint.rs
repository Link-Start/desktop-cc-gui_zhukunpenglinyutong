//! Projection checkpoint 管理。

use crate::shared_event_log::{ProjectionCheckpointRow, SharedEventWriter, StoreError};

/// Projection checkpoint 记录。
pub type ProjectionCheckpoint = ProjectionCheckpointRow;

/// 读取指定 projection 的 checkpoint。
pub fn get_checkpoint(
    writer: &SharedEventWriter,
    session_id: &str,
    projection_name: &str,
) -> Result<Option<ProjectionCheckpoint>, StoreError> {
    writer.get_projection_checkpoint(session_id, projection_name)
}

/// 写入/更新 checkpoint。
pub fn upsert_checkpoint(
    writer: &SharedEventWriter,
    checkpoint: &ProjectionCheckpoint,
) -> Result<(), StoreError> {
    writer.upsert_projection_checkpoint(checkpoint)
}
