//! Shared Projection：把 Canonical Fact 单向映射为幕布兼容的 ConversationItem。
//!
//! 本模块是 Wave 3 / A3 的核心：UI 不直接读 `shared_event_log`，而是消费
//! `SharedProjector` 产出的 `ProjectionItem`（与前端 `ConversationItem` JSON 对齐）。

pub mod checkpoint;
pub mod commands;
pub mod comparator;
pub mod legacy_reader;
pub mod projector;
pub mod types;

pub use checkpoint::{get_checkpoint, upsert_checkpoint};
pub use comparator::{MismatchKind, MismatchReport, ShadowComparator};
pub use legacy_reader::LegacySharedReader;
pub use projector::SharedProjector;
pub use types::{ProjectionItem, ProjectionItemKind};

pub const CANVAS_PROJECTION_NAME: &str = "canvas";
// v3: canonical logical-Turn identity wins over later V0 presentation shadows.
// v4: canvas parity — stamp final footer meta + commandExecution bash typing;
//     keep original tool names for edit/read so Messages EditToolBlock still routes.
// v5: process-before-prose order (reasoning/tools → final Text) so Messages
//     process-phase collapse matches Native; forces checkpoint rebuild.
// v6: Codex fileChange changes[] preserved through Shared history projection.
pub const CANVAS_PROJECTION_VERSION: i64 = 6;
