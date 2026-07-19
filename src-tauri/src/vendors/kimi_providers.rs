//! Kimi CLI vendor/provider management.
//!
//! Provider definitions live in ccgui's `config.json` under the `kimi` section
//! (same pattern as claude/codex providers). Switching a provider materializes
//! it into `~/.kimi-code/config.toml` under namespaced keys so the managed
//! `managed:kimi-code` entries stay untouched:
//!
//! - `providers."ccgui:<id>"` with `type` / `base_url` / `api_key`
//! - `models."ccgui/<model>"` referencing that provider
//! - `default_model = "ccgui/<model>"`
//!
//! The special `__local_config_toml__` provider means "leave config.toml alone".

use std::path::PathBuf;
use std::time::Duration;

use serde_json::Value;

use crate::types::KimiProviderConfig;

use super::commands::{
    derive_model_list_candidates, extract_vendor_model_ids, next_provider_created_at, read_config,
    set_provider_created_at, updated_provider_created_at, write_config, VendorModelListResult,
};

const LOCAL_KIMI_PROVIDER_ID: &str = "__local_config_toml__";
const LOCAL_KIMI_PROVIDER_NAME: &str = "Local config.toml";
const LOCAL_KIMI_PROVIDER_REMARK: &str =
    "Use configuration directly from ~/.kimi-code/config.toml";
const KIMI_PROVIDER_TOML_PREFIX: &str = "ccgui:";
const KIMI_MODEL_TOML_PREFIX: &str = "ccgui/";
const DEFAULT_KIMI_PROVIDER_TYPE: &str = "openai";

fn kimi_config_toml_path() -> Result<PathBuf, String> {
    if let Some(home) = std::env::var_os("KIMI_CODE_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(home).join("config.toml"));
    }
    let home = dirs::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    Ok(home.join(".kimi-code").join("config.toml"))
}

fn build_local_provider(is_active: bool) -> KimiProviderConfig {
    KimiProviderConfig {
        id: LOCAL_KIMI_PROVIDER_ID.to_string(),
        name: LOCAL_KIMI_PROVIDER_NAME.to_string(),
        remark: Some(LOCAL_KIMI_PROVIDER_REMARK.to_string()),
        website_url: None,
        created_at: Some(0),
        sort_order: None,
        is_active,
        is_local_provider: Some(true),
        base_url: String::new(),
        api_key: String::new(),
        model: String::new(),
        provider_type: None,
        max_context_size: None,
        display_name: None,
    }
}

fn value_to_kimi_provider(
    id: &str,
    value: &Value,
    is_active: bool,
) -> Result<KimiProviderConfig, String> {
    let read_string = |key: &str| {
        value
            .get(key)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    };
    Ok(KimiProviderConfig {
        id: id.to_string(),
        name: read_string("name"),
        remark: value
            .get("remark")
            .and_then(|v| v.as_str())
            .map(String::from),
        website_url: value
            .get("websiteUrl")
            .and_then(|v| v.as_str())
            .map(String::from),
        created_at: value.get("createdAt").and_then(|v| v.as_i64()),
        sort_order: value.get("sortOrder").and_then(|v| v.as_i64()),
        is_active,
        is_local_provider: value.get("isLocalProvider").and_then(|v| v.as_bool()),
        base_url: read_string("baseUrl"),
        api_key: read_string("apiKey"),
        model: read_string("model"),
        provider_type: value
            .get("providerType")
            .and_then(|v| v.as_str())
            .map(String::from),
        max_context_size: value.get("maxContextSize").and_then(|v| v.as_i64()),
        display_name: value
            .get("displayName")
            .and_then(|v| v.as_str())
            .map(String::from),
    })
}

fn kimi_provider_to_value(provider: &KimiProviderConfig) -> Value {
    let mut map = serde_json::Map::new();
    map.insert("id".into(), Value::String(provider.id.clone()));
    map.insert("name".into(), Value::String(provider.name.clone()));
    if let Some(ref remark) = provider.remark {
        map.insert("remark".into(), Value::String(remark.clone()));
    }
    if let Some(ref url) = provider.website_url {
        map.insert("websiteUrl".into(), Value::String(url.clone()));
    }
    if let Some(ts) = provider.created_at {
        map.insert("createdAt".into(), Value::Number(ts.into()));
    }
    if let Some(order) = provider.sort_order {
        map.insert("sortOrder".into(), Value::Number(order.into()));
    }
    if let Some(local) = provider.is_local_provider {
        map.insert("isLocalProvider".into(), Value::Bool(local));
    }
    map.insert("baseUrl".into(), Value::String(provider.base_url.clone()));
    map.insert("apiKey".into(), Value::String(provider.api_key.clone()));
    map.insert("model".into(), Value::String(provider.model.clone()));
    if let Some(ref provider_type) = provider.provider_type {
        map.insert(
            "providerType".into(),
            Value::String(provider_type.clone()),
        );
    }
    if let Some(max_context_size) = provider.max_context_size {
        map.insert(
            "maxContextSize".into(),
            Value::Number(max_context_size.into()),
        );
    }
    if let Some(ref display_name) = provider.display_name {
        map.insert(
            "displayName".into(),
            Value::String(display_name.clone()),
        );
    }
    Value::Object(map)
}

fn sort_kimi_providers(providers: &mut [KimiProviderConfig]) {
    providers.sort_by(|a, b| {
        a.sort_order
            .unwrap_or(i64::MAX)
            .cmp(&b.sort_order.unwrap_or(i64::MAX))
            .then_with(|| a.created_at.unwrap_or(0).cmp(&b.created_at.unwrap_or(0)))
            .then_with(|| a.id.cmp(&b.id))
    });
}

/// Materialize the given provider into ~/.kimi-code/config.toml.
/// The original file is backed up to config.toml.bak before rewriting.
fn apply_provider_to_kimi_config(provider: &KimiProviderConfig) -> Result<(), String> {
    let path = kimi_config_toml_path()?;
    let original = std::fs::read_to_string(&path).unwrap_or_default();
    let mut doc: toml::Table = if original.trim().is_empty() {
        toml::Table::new()
    } else {
        toml::from_str(&original)
            .map_err(|error| format!("Failed to parse {}: {}", path.display(), error))?
    };

    let provider_toml_id = format!("{}{}", KIMI_PROVIDER_TOML_PREFIX, provider.id);
    let model_toml_alias = format!("{}{}", KIMI_MODEL_TOML_PREFIX, provider.model.trim());
    if provider.model.trim().is_empty() {
        return Err("Kimi provider model is required".to_string());
    }

    let mut provider_table = toml::Table::new();
    provider_table.insert(
        "type".to_string(),
        toml::Value::String(
            provider
                .provider_type
                .clone()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| DEFAULT_KIMI_PROVIDER_TYPE.to_string()),
        ),
    );
    provider_table.insert(
        "base_url".to_string(),
        toml::Value::String(provider.base_url.trim().to_string()),
    );
    if !provider.api_key.trim().is_empty() {
        provider_table.insert(
            "api_key".to_string(),
            toml::Value::String(provider.api_key.trim().to_string()),
        );
    }

    let mut model_table = toml::Table::new();
    model_table.insert(
        "provider".to_string(),
        toml::Value::String(provider_toml_id.clone()),
    );
    model_table.insert(
        "model".to_string(),
        toml::Value::String(provider.model.trim().to_string()),
    );
    if let Some(max_context_size) = provider.max_context_size {
        model_table.insert(
            "max_context_size".to_string(),
            toml::Value::Integer(max_context_size),
        );
    }
    if let Some(ref display_name) = provider.display_name {
        if !display_name.trim().is_empty() {
            model_table.insert(
                "display_name".to_string(),
                toml::Value::String(display_name.trim().to_string()),
            );
        }
    }

    let providers = doc
        .entry("providers")
        .or_insert_with(|| toml::Value::Table(toml::Table::new()));
    let providers = providers
        .as_table_mut()
        .ok_or_else(|| "`providers` in ~/.kimi-code/config.toml is not a table".to_string())?;
    providers.insert(provider_toml_id, toml::Value::Table(provider_table));

    let models = doc
        .entry("models")
        .or_insert_with(|| toml::Value::Table(toml::Table::new()));
    let models = models
        .as_table_mut()
        .ok_or_else(|| "`models` in ~/.kimi-code/config.toml is not a table".to_string())?;
    models.insert(model_toml_alias.clone(), toml::Value::Table(model_table));

    doc.insert(
        "default_model".to_string(),
        toml::Value::String(model_toml_alias),
    );

    let rendered = toml::to_string_pretty(&doc)
        .map_err(|error| format!("Failed to serialize ~/.kimi-code/config.toml: {}", error))?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create ~/.kimi-code dir: {}", error))?;
    }
    if path.exists() {
        let backup_path = path.with_extension("toml.bak");
        std::fs::copy(&path, &backup_path).map_err(|error| {
            format!(
                "Failed to back up ~/.kimi-code/config.toml to {}: {}",
                backup_path.display(),
                error
            )
        })?;
    }

    let tmp_path = path.with_extension("toml.tmp");
    std::fs::write(&tmp_path, rendered)
        .map_err(|error| format!("Failed to write ~/.kimi-code/config.toml temp file: {}", error))?;
    std::fs::rename(&tmp_path, &path)
        .map_err(|error| format!("Failed to replace ~/.kimi-code/config.toml: {}", error))
}

/// Remove `ccgui:`-namespaced entries for the given provider from config.toml.
/// Best-effort: parse/write failures are swallowed so provider deletion never
/// gets blocked by an unrelated config.toml problem.
fn cleanup_provider_from_kimi_config(provider_id: &str) {
    let Ok(path) = kimi_config_toml_path() else {
        return;
    };
    let Ok(original) = std::fs::read_to_string(&path) else {
        return;
    };
    if original.trim().is_empty() {
        return;
    }
    let Ok(mut doc) = toml::from_str::<toml::Table>(&original) else {
        return;
    };

    let provider_toml_id = format!("{}{}", KIMI_PROVIDER_TOML_PREFIX, provider_id);
    let mut dirty = false;

    if let Some(providers) = doc.get_mut("providers").and_then(|v| v.as_table_mut()) {
        dirty |= providers.remove(&provider_toml_id).is_some();
    }

    let mut removed_aliases = Vec::new();
    if let Some(models) = doc.get_mut("models").and_then(|v| v.as_table_mut()) {
        let dangling: Vec<String> = models
            .iter()
            .filter(|(_, model)| {
                model.get("provider").and_then(|v| v.as_str()) == Some(provider_toml_id.as_str())
            })
            .map(|(alias, _)| alias.clone())
            .collect();
        for alias in &dangling {
            models.remove(alias);
        }
        removed_aliases = dangling;
        dirty |= !removed_aliases.is_empty();
    }

    if let Some(default_model) = doc.get("default_model").and_then(|v| v.as_str()) {
        if removed_aliases.iter().any(|alias| alias == default_model) {
            doc.remove("default_model");
            dirty = true;
        }
    }

    if !dirty {
        return;
    }
    if let Ok(rendered) = toml::to_string_pretty(&doc) {
        let tmp_path = path.with_extension("toml.tmp");
        if std::fs::write(&tmp_path, rendered).is_ok() {
            let _ = std::fs::rename(&tmp_path, &path);
        }
    }
}

// ==================== Kimi Provider Commands ====================

#[tauri::command]
pub(crate) async fn vendor_get_kimi_providers() -> Result<Vec<KimiProviderConfig>, String> {
    let config = read_config()?;
    let current = config.kimi.current.as_deref();
    let mut regular_providers: Vec<KimiProviderConfig> = config
        .kimi
        .providers
        .iter()
        .filter_map(|(id, value)| {
            if id == LOCAL_KIMI_PROVIDER_ID {
                return None;
            }
            let is_active = current == Some(id.as_str());
            value_to_kimi_provider(id, value, is_active).ok()
        })
        .collect();
    sort_kimi_providers(&mut regular_providers);

    let mut providers = Vec::with_capacity(regular_providers.len() + 1);
    providers.push(build_local_provider(
        current == Some(LOCAL_KIMI_PROVIDER_ID),
    ));
    providers.extend(regular_providers);

    Ok(providers)
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct KimiCurrentConfig {
    api_key: String,
    base_url: String,
    auth_type: String,
    default_model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    provider_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    provider_name: Option<String>,
}

#[tauri::command]
pub(crate) async fn vendor_get_current_kimi_config() -> Result<KimiCurrentConfig, String> {
    let path = kimi_config_toml_path()?;
    let raw = std::fs::read_to_string(&path).unwrap_or_default();
    let doc: toml::Table = if raw.trim().is_empty() {
        toml::Table::new()
    } else {
        toml::from_str(&raw)
            .map_err(|error| format!("Failed to parse {}: {}", path.display(), error))?
    };

    let default_model = doc
        .get("default_model")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let provider_toml_id = doc
        .get("models")
        .and_then(|v| v.as_table())
        .and_then(|models| models.get(&default_model))
        .and_then(|model| model.get("provider"))
        .and_then(|v| v.as_str())
        .map(String::from);

    let (mut api_key, mut base_url) = (String::new(), String::new());
    if let Some(ref provider_id) = provider_toml_id {
        if let Some(provider) = doc
            .get("providers")
            .and_then(|v| v.as_table())
            .and_then(|providers| providers.get(provider_id))
            .and_then(|v| v.as_table())
        {
            api_key = provider
                .get("api_key")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            base_url = provider
                .get("base_url")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
        }
    }

    let config = read_config()?;
    let provider_id = config.kimi.current.clone();
    let provider_name = provider_id.as_ref().and_then(|id| {
        if id == LOCAL_KIMI_PROVIDER_ID {
            return Some(LOCAL_KIMI_PROVIDER_NAME.to_string());
        }
        config
            .kimi
            .providers
            .get(id)
            .and_then(|provider| provider.get("name"))
            .and_then(|name| name.as_str())
            .map(String::from)
    });

    Ok(KimiCurrentConfig {
        auth_type: if api_key.is_empty() {
            "none".to_string()
        } else {
            "api_key".to_string()
        },
        api_key,
        base_url,
        default_model,
        provider_id,
        provider_name,
    })
}

#[tauri::command]
pub(crate) async fn vendor_add_kimi_provider(provider: KimiProviderConfig) -> Result<(), String> {
    if provider.id == LOCAL_KIMI_PROVIDER_ID {
        return Err("Reserved provider id".to_string());
    }
    let mut config = read_config()?;
    if config.kimi.providers.contains_key(&provider.id) {
        return Err(format!("Provider with id {} already exists", provider.id));
    }
    let created_at = provider
        .created_at
        .unwrap_or_else(|| next_provider_created_at(&config.kimi.providers));
    let mut provider_value = kimi_provider_to_value(&provider);
    set_provider_created_at(&mut provider_value, created_at);
    config
        .kimi
        .providers
        .insert(provider.id.clone(), provider_value);
    write_config(&config)
}

#[tauri::command]
pub(crate) async fn vendor_update_kimi_provider(
    id: String,
    updates: KimiProviderConfig,
) -> Result<(), String> {
    if id == LOCAL_KIMI_PROVIDER_ID {
        return Err("Local config.toml provider cannot be updated".to_string());
    }
    let mut config = read_config()?;
    if !config.kimi.providers.contains_key(&id) {
        return Err(format!("Provider {} not found", id));
    }
    let existing_created_at =
        updated_provider_created_at(config.kimi.providers.get(&id), updates.created_at);
    let mut provider_value = kimi_provider_to_value(&updates);
    if let Some(created_at) = existing_created_at {
        set_provider_created_at(&mut provider_value, created_at);
    }
    let is_current = config.kimi.current.as_deref() == Some(id.as_str());
    config.kimi.providers.insert(id.clone(), provider_value);
    write_config(&config)?;

    // Keep the materialized config.toml in sync when editing the active provider.
    if is_current {
        apply_provider_to_kimi_config(&updates)?;
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn vendor_delete_kimi_provider(id: String) -> Result<(), String> {
    if id == LOCAL_KIMI_PROVIDER_ID {
        return Err("Local config.toml provider cannot be deleted".to_string());
    }
    let mut config = read_config()?;
    if config.kimi.providers.remove(&id).is_none() {
        return Err(format!("Provider {} not found", id));
    }
    if config.kimi.current.as_ref() == Some(&id) {
        config.kimi.current = None;
    }
    write_config(&config)?;
    cleanup_provider_from_kimi_config(&id);
    Ok(())
}

#[tauri::command]
pub(crate) async fn vendor_switch_kimi_provider(id: String) -> Result<(), String> {
    let mut config = read_config()?;
    if id == LOCAL_KIMI_PROVIDER_ID {
        config.kimi.current = Some(id);
        write_config(&config)?;
        return Ok(());
    }
    let provider_value = config
        .kimi
        .providers
        .get(&id)
        .ok_or_else(|| format!("Provider {} not found", id))?
        .clone();
    let provider = value_to_kimi_provider(&id, &provider_value, true)?;
    config.kimi.current = Some(id.clone());
    write_config(&config)?;

    apply_provider_to_kimi_config(&provider)?;

    Ok(())
}

#[tauri::command]
pub(crate) async fn vendor_fetch_kimi_models(
    base_url: String,
    api_key: String,
) -> Result<VendorModelListResult, String> {
    if base_url.trim().is_empty() {
        return Err("API URL is required".to_string());
    }

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| format!("Failed to build HTTP client: {error}"))?;
    let api_key = api_key.trim().to_string();
    let mut last_error: Option<String> = None;

    for endpoint in derive_model_list_candidates(&base_url) {
        let response = match client
            .get(&endpoint)
            .header("Authorization", format!("Bearer {api_key}"))
            .header("x-api-key", api_key.as_str())
            .send()
            .await
        {
            Ok(response) => response,
            Err(error) => {
                last_error = Some(format!("{endpoint}: {error}"));
                continue;
            }
        };

        let status = response.status();
        if !status.is_success() {
            last_error = Some(format!("{endpoint} returned HTTP {status}"));
            continue;
        }

        let body = match response.text().await {
            Ok(body) => body,
            Err(error) => {
                last_error = Some(format!("{endpoint}: failed to read response body: {error}"));
                continue;
            }
        };

        let value = match serde_json::from_str::<Value>(&body) {
            Ok(value) => value,
            Err(error) => {
                last_error = Some(format!(
                    "{endpoint}: failed to parse JSON response: {error}"
                ));
                continue;
            }
        };

        return Ok(VendorModelListResult {
            models: extract_vendor_model_ids(&value),
            endpoint,
        });
    }

    Err(format!(
        "Failed to fetch models: {}",
        last_error.unwrap_or_else(|| "no candidate endpoint succeeded".to_string())
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn sample_provider() -> KimiProviderConfig {
        KimiProviderConfig {
            id: "moonshot".to_string(),
            name: "Moonshot".to_string(),
            remark: None,
            website_url: None,
            created_at: Some(1),
            sort_order: None,
            is_active: false,
            is_local_provider: None,
            base_url: "https://api.moonshot.cn/v1".to_string(),
            api_key: "sk-test".to_string(),
            model: "kimi-k2".to_string(),
            provider_type: None,
            max_context_size: Some(262144),
            display_name: Some("Kimi K2".to_string()),
        }
    }

    #[test]
    fn provider_value_round_trips_all_fields() {
        let provider = sample_provider();
        let value = kimi_provider_to_value(&provider);
        let parsed = value_to_kimi_provider(&provider.id, &value, true).expect("round-trip");
        assert_eq!(parsed.name, "Moonshot");
        assert_eq!(parsed.base_url, "https://api.moonshot.cn/v1");
        assert_eq!(parsed.api_key, "sk-test");
        assert_eq!(parsed.model, "kimi-k2");
        assert_eq!(parsed.max_context_size, Some(262144));
        assert_eq!(parsed.display_name.as_deref(), Some("Kimi K2"));
        assert!(parsed.is_active);
    }

    #[test]
    fn local_provider_uses_reserved_id() {
        let local = build_local_provider(true);
        assert_eq!(local.id, LOCAL_KIMI_PROVIDER_ID);
        assert!(local.is_active);
        assert_eq!(local.is_local_provider, Some(true));
    }

    #[test]
    fn kimi_section_defaults_are_empty() {
        let section: super::super::commands::KimiSection = Default::default();
        assert!(section.providers.is_empty());
        assert!(section.current.is_none());
        let _: HashMap<String, Value> = section.providers;
    }
}
