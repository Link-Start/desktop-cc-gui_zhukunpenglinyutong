use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Serialize, Clone)]
pub(crate) struct AppServerEvent {
    pub(crate) workspace_id: String,
    pub(crate) message: Value,
}

#[derive(Debug, Serialize, Clone)]
pub(crate) struct TerminalOutput {
    #[serde(rename = "workspaceId")]
    pub(crate) workspace_id: String,
    #[serde(rename = "terminalId")]
    pub(crate) terminal_id: String,
    pub(crate) data: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AppServerEventDisposition {
    EmitNow,
    DeferredBySharedOwner,
}

pub(crate) trait EventSink: Clone + Send + Sync + 'static {
    /// Runtime owner hook。必须在普通 UI fan-out、background routing 与
    /// SnapshotThrottle 前调用；实现可附加 Shared owner projection。
    fn observe_app_server_event(
        &self,
        _provider_runtime_key: &str,
        _event: &mut AppServerEvent,
    ) -> AppServerEventDisposition {
        AppServerEventDisposition::EmitNow
    }
    fn emit_app_server_event(&self, event: AppServerEvent);
    fn emit_terminal_output(&self, event: TerminalOutput);
}
