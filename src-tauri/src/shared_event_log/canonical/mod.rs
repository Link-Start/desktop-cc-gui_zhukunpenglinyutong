//! Canonical Fact 装配层（Wave 2 / Change A2）。
//!
//! 把 Runtime 事件流转换为符合 Wave 0 Schema 的 canonical fact，
//! 经字段级校验后通过 `SharedEventWriter` 唯一入口落盘。

pub mod assembler;
pub mod shadow_v0;
pub mod sink;
pub mod types;
pub mod validator;

pub use types::{
    ArtifactRef, AtomicToolExchange, CanonicalAssistantBlocks, CanonicalBlock, CanonicalFact,
    CanonicalOmission, CanonicalProviderProfileSource, CanonicalUserInput, ControlFact,
    DeliveryAcceptedFact, DeliveryPreparedFact, Outcome, ProviderPrivateRef,
    ProviderPrivateRefKind, ReasoningSelection, TurnAcceptedFact, TurnCommittedFact,
    TurnExecutionSnapshot, TurnRequestedFact, UsageRecordedFact, UsageShape,
};
pub use validator::{validate_fact, FactValidationError};
