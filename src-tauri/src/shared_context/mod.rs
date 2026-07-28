//! Shared Context Compiler（Change C）。
//!
//! Canonical Log 是唯一输入；本模块只生成派生 package，并通过 SharedEventWriter
//! 推进 delivery cursor。Renderer 不参与 checksum、sequence 或 cursor 计算。

mod artifact_store;
mod compiler;
mod delivery;
mod types;

pub use artifact_store::{
    read_artifact, scan_orphan_artifacts, write_artifact, ArtifactReadRequest, ArtifactStoreRecord,
};
pub use compiler::{compile_context, CompileContextRequest};
pub use delivery::{
    accept_delivery, commit_delivery, prepare_delivery, terminal_binding_update,
    AcceptDeliveryRequest, PrepareDeliveryRequest,
};
pub use types::*;
