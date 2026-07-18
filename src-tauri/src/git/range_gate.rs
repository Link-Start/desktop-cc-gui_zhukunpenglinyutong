use crate::types::{GitPrRangeGate, GitPrRangeGateSeverity};
use crate::utils::normalize_git_path;

pub(crate) const PR_RANGE_MAX_CHANGED_FILES: usize = 240;
pub(crate) const PR_RANGE_COMPLETE_DIFF_MAX_FILES: usize = 300;
pub(crate) const PR_RANGE_SUSPICIOUS_THRESHOLD: usize = 32;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum PrRangeGateDecision {
    Pass {
        changed_files: usize,
    },
    ConfirmationRequired {
        category: String,
        reason: String,
        range_gate: GitPrRangeGate,
    },
    Blocked {
        category: String,
        reason: String,
    },
}

fn is_suspicious_range_path(path: &str) -> bool {
    let normalized = normalize_git_path(path).to_lowercase();
    normalized == "readme.md" || normalized == "readme.zh-cn.md" || normalized == "license"
}

pub(crate) fn parse_pr_range_fingerprint(revisions: &str) -> Option<String> {
    let mut revision_lines = revisions
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty());
    let base_revision = revision_lines.next()?;
    let head_revision = revision_lines.next()?;
    if revision_lines.next().is_some() {
        return None;
    }
    Some(format!("{base_revision}...{head_revision}"))
}

pub(crate) fn evaluate_pr_range_gate(
    changed_paths: &[String],
    allow_large_range: bool,
    confirmed_range_fingerprint: Option<&str>,
    current_range_fingerprint: &str,
) -> PrRangeGateDecision {
    if changed_paths.is_empty() {
        return PrRangeGateDecision::Blocked {
            category: "range-empty".to_string(),
            reason: "Range gate blocked: `upstream/<base>...HEAD` has no changed files."
                .to_string(),
        };
    }

    let suspicious_files = changed_paths
        .iter()
        .filter(|path| is_suspicious_range_path(path))
        .cloned()
        .collect::<Vec<_>>();
    if !suspicious_files.is_empty() && changed_paths.len() >= PR_RANGE_SUSPICIOUS_THRESHOLD {
        return PrRangeGateDecision::Blocked {
            category: "range-suspicious".to_string(),
            reason: format!(
                "Range gate blocked: suspicious root files detected ({}). Re-check branch base before creating PR.",
                suspicious_files.join(", ")
            ),
        };
    }

    let authorization_matches = allow_large_range
        && confirmed_range_fingerprint.map(str::trim) == Some(current_range_fingerprint);
    if changed_paths.len() <= PR_RANGE_MAX_CHANGED_FILES || authorization_matches {
        return PrRangeGateDecision::Pass {
            changed_files: changed_paths.len(),
        };
    }

    let severity = if changed_paths.len() > PR_RANGE_COMPLETE_DIFF_MAX_FILES {
        GitPrRangeGateSeverity::DiffIncomplete
    } else {
        GitPrRangeGateSeverity::Large
    };
    let reason = match severity {
        GitPrRangeGateSeverity::Large => format!(
            "Range gate confirmation required: {} changed files exceed review threshold {}.",
            changed_paths.len(),
            PR_RANGE_MAX_CHANGED_FILES
        ),
        GitPrRangeGateSeverity::DiffIncomplete => format!(
            "Range gate confirmation required: {} changed files exceed GitHub's complete diff display limit {}.",
            changed_paths.len(),
            PR_RANGE_COMPLETE_DIFF_MAX_FILES
        ),
    };

    PrRangeGateDecision::ConfirmationRequired {
        category: "range-confirmation-required".to_string(),
        reason,
        range_gate: GitPrRangeGate {
            changed_files: changed_paths.len(),
            threshold: PR_RANGE_MAX_CHANGED_FILES,
            severity,
            requires_confirmation: true,
            range_fingerprint: current_range_fingerprint.to_string(),
        },
    }
}
