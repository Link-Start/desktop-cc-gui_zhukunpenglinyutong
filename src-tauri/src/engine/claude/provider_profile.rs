use std::collections::BTreeMap;

use serde_json::Value;

use crate::session_management::EngineProviderBinding;

pub(crate) const CLAUDE_LOCAL_PROVIDER_PROFILE_ID: &str = "__local_settings_json__";

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ClaudeProviderLaunchProfile {
    pub(crate) binding: EngineProviderBinding,
    pub(crate) env: BTreeMap<String, String>,
}

fn read_claude_provider_config() -> Result<Value, String> {
    let path = crate::app_paths::config_file_path()?;
    if !path.exists() {
        return Ok(Value::Object(serde_json::Map::new()));
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read {}: {error}", path.display()))?;
    if content.trim().is_empty() {
        return Ok(Value::Object(serde_json::Map::new()));
    }
    serde_json::from_str(&content)
        .map_err(|error| format!("Failed to parse {}: {error}", path.display()))
}

fn resolve_claude_provider_launch_profile_from_config(
    config: &Value,
    provider_profile_id: &str,
) -> Result<Option<ClaudeProviderLaunchProfile>, String> {
    let provider_profile_id = provider_profile_id.trim();
    if provider_profile_id.is_empty() || provider_profile_id == CLAUDE_LOCAL_PROVIDER_PROFILE_ID {
        return Ok(None);
    }
    let provider = config
        .get("claude")
        .and_then(|claude| claude.get("providers"))
        .and_then(|providers| providers.get(provider_profile_id))
        .ok_or_else(|| format!("Claude provider {provider_profile_id} not found"))?;
    let provider_name = provider
        .get("name")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(provider_profile_id)
        .to_string();
    let env = provider
        .get("settingsConfig")
        .and_then(Value::as_object)
        .and_then(|settings| settings.get("env"))
        .and_then(Value::as_object)
        .ok_or_else(|| {
            format!("Claude provider {provider_profile_id} has no settingsConfig.env object")
        })?;
    let mut launch_env = BTreeMap::new();
    for (key, value) in env {
        let value = value.as_str().ok_or_else(|| {
            format!("Claude provider {provider_profile_id} env {key} must be a string")
        })?;
        launch_env.insert(key.clone(), value.to_string());
    }
    if launch_env.is_empty() {
        return Err(format!(
            "Claude provider {provider_profile_id} settingsConfig.env is empty"
        ));
    }
    Ok(Some(ClaudeProviderLaunchProfile {
        binding: EngineProviderBinding {
            provider_profile_id: provider_profile_id.to_string(),
            provider_profile_source: "managed".to_string(),
            provider_profile_name: provider_name,
            provider_availability: "available".to_string(),
        },
        env: launch_env,
    }))
}

pub(crate) fn resolve_claude_provider_launch_profile(
    provider_profile_id: Option<&str>,
) -> Result<Option<ClaudeProviderLaunchProfile>, String> {
    let Some(provider_profile_id) = provider_profile_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Ok(None);
    };
    if provider_profile_id == CLAUDE_LOCAL_PROVIDER_PROFILE_ID {
        return Ok(None);
    }
    resolve_claude_provider_launch_profile_from_config(
        &read_claude_provider_config()?,
        provider_profile_id,
    )
}

pub(crate) fn resolve_claude_provider_model_env(
    provider_profile_id: &str,
) -> Result<Option<BTreeMap<String, String>>, String> {
    resolve_claude_provider_launch_profile(Some(provider_profile_id))
        .map(|profile| profile.map(|profile| profile.env))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn resolves_managed_env_and_binding() {
        let config = json!({
            "claude": {
                "providers": {
                    "provider-a": {
                        "name": "Provider A",
                        "settingsConfig": {
                            "env": {
                                "ANTHROPIC_AUTH_TOKEN": "secret-token",
                                "ANTHROPIC_BASE_URL": "https://provider.example.test"
                            }
                        }
                    }
                }
            }
        });

        let profile = resolve_claude_provider_launch_profile_from_config(&config, "provider-a")
            .expect("resolve managed profile")
            .expect("managed profile");

        assert_eq!(profile.binding.provider_profile_id, "provider-a");
        assert_eq!(profile.binding.provider_profile_name, "Provider A");
        assert_eq!(
            profile.env.get("ANTHROPIC_BASE_URL").map(String::as_str),
            Some("https://provider.example.test")
        );
    }

    #[test]
    fn treats_local_as_default() {
        assert_eq!(
            resolve_claude_provider_launch_profile_from_config(
                &Value::Null,
                CLAUDE_LOCAL_PROVIDER_PROFILE_ID,
            )
            .expect("resolve local profile"),
            None
        );
    }

    #[test]
    fn rejects_missing_or_invalid_env() {
        let config = json!({
            "claude": {
                "providers": {
                    "missing-env": { "name": "Missing Env" },
                    "invalid-env": {
                        "name": "Invalid Env",
                        "settingsConfig": { "env": { "ANTHROPIC_BASE_URL": 42 } }
                    }
                }
            }
        });

        let missing =
            resolve_claude_provider_launch_profile_from_config(&config, "deleted-provider")
                .expect_err("missing provider must fail");
        let missing_env =
            resolve_claude_provider_launch_profile_from_config(&config, "missing-env")
                .expect_err("missing env must fail");
        let invalid_env =
            resolve_claude_provider_launch_profile_from_config(&config, "invalid-env")
                .expect_err("invalid env must fail");

        assert!(missing.contains("deleted-provider"));
        assert!(missing_env.contains("missing-env"));
        assert!(invalid_env.contains("invalid-env"));
    }
}
