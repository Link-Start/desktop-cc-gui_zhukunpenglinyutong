use serde::Serialize;
use std::time::Duration;

pub(crate) const HTTP_TIMEOUT: Duration = Duration::from_secs(12);
/// 中转首探（Sub2API）超时：失败后还要 fallback，不宜过长。
pub(crate) const RELAY_PRIMARY_TIMEOUT: Duration = Duration::from_secs(8);
/// 中转回退（New API）超时。
pub(crate) const RELAY_FALLBACK_TIMEOUT: Duration = Duration::from_secs(6);
pub(crate) const DEEPSEEK_BALANCE_URL: &str = "https://api.deepseek.com/user/balance";
/// Sub2API planLabel 最大展示长度（HUD 单行）。
pub(crate) const SUB2API_PLAN_LABEL_MAX_CHARS: usize = 40;

/// Kimi CLI (`engine=kimi`) 与交互 `/status` 同源：OAuth 文件 + refresh + `/usages`。
/// **不得**用于 Claude/Codex 绑定 Kimi HTTP 中转（那些走 CodingPlanApi + API key）。
pub(crate) const KIMI_CODE_OAUTH_HOST: &str = "https://auth.kimi.com";
pub(crate) const KIMI_CODE_OAUTH_CLIENT_ID: &str = "17e5f671-d194-4dfb-9706-5516cb48c098";
pub(crate) const KIMI_CODE_USAGE_BASE: &str = "https://api.kimi.com/coding/v1";
/// 提前刷新窗口（秒），对齐 CLI ensureFresh 行为。
pub(crate) const KIMI_CLI_TOKEN_REFRESH_SKEW_SECS: i64 = 60;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CodingPlanProvider {
    Kimi,
    ZhipuCn,
    ZhipuEn,
    MiniMaxCn,
    MiniMaxEn,
    DeepSeek,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodingPlanQuotaWindow {
    pub(crate) id: String,
    pub(crate) used_percent: f64,
    pub(crate) remaining_percent: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) resets_at: Option<String>,
}

/// 余额型供应商（DeepSeek 等）单币种条目。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodingPlanBalanceItem {
    pub(crate) currency: String,
    pub(crate) total_balance: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) granted_balance: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) topped_up_balance: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodingPlanBalanceSnapshot {
    pub(crate) is_available: bool,
    pub(crate) items: Vec<CodingPlanBalanceItem>,
}

/// Sub2API 等中转站用量摘要（供 HUD 多行展示）。
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodingPlanUsageSummary {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) total_requests: Option<u64>,
    /// 已格式化金额字符串，如 `0.014363`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) total_actual_cost: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) total_input_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) total_output_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) total_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) average_duration_ms: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodingPlanQuotaSnapshot {
    /// kimi | minimax | zhipu | deepseek | sub2api | official_cli | unsupported | empty_credentials | error | none
    pub(crate) source: String,
    /// api | cli | official_runtime — 便于 UI/调试看走了哪条路径
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) via: Option<String>,
    pub(crate) success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) plan_label: Option<String>,
    pub(crate) windows: Vec<CodingPlanQuotaWindow>,
    /// 余额型额度（DeepSeek 等）；百分比供应商为 None
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) balance: Option<CodingPlanBalanceSnapshot>,
    /// Sub2API 用量摘要；其它供应商为 None
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) usage_summary: Option<CodingPlanUsageSummary>,
    /// 中转站 origin（如 `https://fufei.mossx.ai`），供 UI 展示「{origin}+sub2api」
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) site_origin: Option<String>,
    pub(crate) queried_at: i64,
}

/// 额度路由：官方 runtime/CLI vs 供应商 Coding Plan API。
#[derive(Debug, Clone)]
pub(crate) enum QuotaRoute {
    /// Codex 官方 / Claude 官方等：前端用 account rateLimits 或空块
    OfficialRuntime { source: &'static str },
    /// 已知 Coding Plan 供应商：用 base_url + key 查 HTTP
    CodingPlanApi { base_url: String, api_key: String },
    /// 无额度可查（官方无 plan / 缺凭据）
    None { reason: String },
}
