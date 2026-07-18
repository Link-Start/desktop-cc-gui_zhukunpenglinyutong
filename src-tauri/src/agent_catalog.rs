use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::Manager;

use crate::types::AppSettings;

const PROVIDER_ID: &str = "agency-agents";
const CATALOG_DIR: &str = "agent-catalogs";
const SOURCE_URL: &str = "https://github.com/msitarzewski/agency-agents";
const SOURCE_REVISION: &str = "459dce837db3bdfdc4763d3fefd1fd854e73c8f1";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocalizedText {
    en: String,
    #[serde(rename = "zh-CN")]
    zh_cn: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogDivision {
    id: String,
    order: usize,
    count: usize,
    icon: Option<String>,
    color: Option<String>,
    label: LocalizedText,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogManifest {
    schema_version: u32,
    provider_id: String,
    display_name: String,
    source_url: String,
    source_revision: String,
    license: String,
    division_count: usize,
    agent_count: usize,
    divisions: Vec<CatalogDivision>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogAgent {
    id: String,
    provider_id: String,
    division_id: String,
    source_path: String,
    source_revision: String,
    prompt_path: String,
    prompt_hash: String,
    name: LocalizedText,
    description: LocalizedText,
    color: Option<String>,
    emoji: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogAgentsDocument {
    schema_version: u32,
    agents: Vec<CatalogAgent>,
}

#[derive(Debug, Clone)]
struct LoadedCatalog {
    root: PathBuf,
    manifest: CatalogManifest,
    agents: Vec<CatalogAgent>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BuiltInAgentDivisionView {
    id: String,
    order: usize,
    count: usize,
    enabled_count: usize,
    icon: Option<String>,
    color: Option<String>,
    label: String,
    label_en: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BuiltInAgentView {
    id: String,
    provider_id: String,
    division_id: String,
    name: String,
    name_en: String,
    description: String,
    description_en: String,
    color: Option<String>,
    emoji: Option<String>,
    source_path: String,
    source_revision: String,
    prompt_hash: String,
    enabled: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BuiltInAgentCatalogView {
    provider_id: String,
    display_name: String,
    source_url: String,
    source_revision: String,
    license: String,
    divisions: Vec<BuiltInAgentDivisionView>,
    agents: Vec<BuiltInAgentView>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BuiltInAgentPrompt {
    id: String,
    provider_id: String,
    source_revision: String,
    prompt_hash: String,
    prompt: String,
}

pub(crate) fn normalized_enabled_builtin_agent_ids(ids: &[String]) -> Vec<String> {
    let mut normalized: Vec<String> = ids
        .iter()
        .filter_map(|id| {
            let trimmed = id.trim();
            if validate_agent_id(trimmed).is_ok() {
                Some(trimmed.to_string())
            } else {
                None
            }
        })
        .collect();
    normalized.sort();
    normalized.dedup();
    normalized
}

fn validate_agent_id(id: &str) -> Result<(), String> {
    let Some(path) = id.strip_prefix("agency-agents:") else {
        return Err("built-in agent id must start with `agency-agents:`".to_string());
    };
    validate_safe_relative_path(path, "built-in agent id")
}

fn validate_safe_relative_path(value: &str, label: &str) -> Result<(), String> {
    if value.trim() != value || value.is_empty() || value.contains('\\') || value.contains(':') {
        return Err(format!("unsafe {} `{}`", label, value));
    }
    let path = Path::new(value);
    if path.is_absolute() {
        return Err(format!("unsafe {} `{}`", label, value));
    }
    for component in path.components() {
        if matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_) | Component::CurDir
        ) {
            return Err(format!("unsafe {} `{}`", label, value));
        }
    }
    Ok(())
}

fn app_resource_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().resource_dir().ok()
}

fn default_catalog_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join(CATALOG_DIR)
        .join(PROVIDER_ID)
}

fn catalog_root_candidates(resource_dir: Option<&Path>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(root) = resource_dir {
        candidates.push(root.join(CATALOG_DIR).join(PROVIDER_ID));
        candidates.push(root.join("resources").join(CATALOG_DIR).join(PROVIDER_ID));
    }
    if let Ok(executable) = std::env::current_exe() {
        if let Some(executable_dir) = executable.parent() {
            if cfg!(target_os = "macos") {
                if let Some(contents_dir) = executable_dir.parent() {
                    candidates.push(
                        contents_dir
                            .join("Resources")
                            .join(CATALOG_DIR)
                            .join(PROVIDER_ID),
                    );
                }
            }
            candidates.push(executable_dir.join(CATALOG_DIR).join(PROVIDER_ID));
        }
    }
    candidates.push(default_catalog_root());
    candidates
}

fn resolve_catalog_root(resource_dir: Option<&Path>) -> Result<PathBuf, String> {
    catalog_root_candidates(resource_dir)
        .into_iter()
        .find(|candidate| candidate.join("manifest.json").is_file())
        .ok_or_else(|| "Agency Agents catalog resource is unavailable".to_string())
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path, label: &str) -> Result<T, String> {
    let raw =
        fs::read_to_string(path).map_err(|error| format!("failed to read {}: {}", label, error))?;
    serde_json::from_str(&raw).map_err(|error| format!("invalid {}: {}", label, error))
}

fn load_catalog(resource_dir: Option<&Path>) -> Result<LoadedCatalog, String> {
    load_catalog_from_root(resolve_catalog_root(resource_dir)?)
}

fn load_catalog_from_root(root: PathBuf) -> Result<LoadedCatalog, String> {
    let manifest: CatalogManifest =
        read_json(&root.join("manifest.json"), "agent catalog manifest")?;
    let document: CatalogAgentsDocument =
        read_json(&root.join("agents.json"), "agent catalog entries")?;
    if manifest.schema_version != 1 || document.schema_version != 1 {
        return Err("unsupported agent catalog schema version".to_string());
    }
    if manifest.provider_id != PROVIDER_ID
        || manifest.source_url != SOURCE_URL
        || manifest.source_revision != SOURCE_REVISION
        || manifest.license != "MIT"
    {
        return Err("unsupported agent catalog identity or license".to_string());
    }
    if manifest.division_count != manifest.divisions.len()
        || manifest.agent_count != document.agents.len()
    {
        return Err("agent catalog manifest count mismatch".to_string());
    }

    let division_ids: HashSet<&str> = manifest
        .divisions
        .iter()
        .map(|division| division.id.as_str())
        .collect();
    let mut agent_ids = HashSet::new();
    for agent in &document.agents {
        validate_agent_id(&agent.id)?;
        validate_safe_relative_path(&agent.prompt_path, "agent prompt path")?;
        if agent.provider_id != PROVIDER_ID
            || agent.source_revision != manifest.source_revision
            || !division_ids.contains(agent.division_id.as_str())
            || !agent_ids.insert(agent.id.as_str())
        {
            return Err(format!("invalid agent catalog entry `{}`", agent.id));
        }
    }

    Ok(LoadedCatalog {
        root,
        manifest,
        agents: document.agents,
    })
}

fn use_chinese_catalog(locale: &str) -> bool {
    let normalized = locale.trim().to_ascii_lowercase();
    normalized == "zh" || normalized.starts_with("zh-")
}

fn localized_text<'a>(value: &'a LocalizedText, locale: &str) -> &'a str {
    if use_chinese_catalog(locale) {
        value.zh_cn.as_str()
    } else {
        value.en.as_str()
    }
}

fn build_catalog_view(
    catalog: &LoadedCatalog,
    locale: &str,
    enabled_ids: &[String],
) -> BuiltInAgentCatalogView {
    let enabled: HashSet<&str> = enabled_ids.iter().map(String::as_str).collect();
    let divisions = catalog
        .manifest
        .divisions
        .iter()
        .map(|division| BuiltInAgentDivisionView {
            id: division.id.clone(),
            order: division.order,
            count: division.count,
            enabled_count: catalog
                .agents
                .iter()
                .filter(|agent| {
                    agent.division_id == division.id && enabled.contains(agent.id.as_str())
                })
                .count(),
            icon: division.icon.clone(),
            color: division.color.clone(),
            label: localized_text(&division.label, locale).to_string(),
            label_en: division.label.en.clone(),
        })
        .collect();
    let agents = catalog
        .agents
        .iter()
        .map(|agent| BuiltInAgentView {
            id: agent.id.clone(),
            provider_id: agent.provider_id.clone(),
            division_id: agent.division_id.clone(),
            name: localized_text(&agent.name, locale).to_string(),
            name_en: agent.name.en.clone(),
            description: localized_text(&agent.description, locale).to_string(),
            description_en: agent.description.en.clone(),
            color: agent.color.clone(),
            emoji: agent.emoji.clone(),
            source_path: agent.source_path.clone(),
            source_revision: agent.source_revision.clone(),
            prompt_hash: agent.prompt_hash.clone(),
            enabled: enabled.contains(agent.id.as_str()),
        })
        .collect();

    BuiltInAgentCatalogView {
        provider_id: catalog.manifest.provider_id.clone(),
        display_name: catalog.manifest.display_name.clone(),
        source_url: catalog.manifest.source_url.clone(),
        source_revision: catalog.manifest.source_revision.clone(),
        license: catalog.manifest.license.clone(),
        divisions,
        agents,
    }
}

fn resolve_prompt(catalog: &LoadedCatalog, agent_id: &str) -> Result<BuiltInAgentPrompt, String> {
    validate_agent_id(agent_id)?;
    let agent = catalog
        .agents
        .iter()
        .find(|entry| entry.id == agent_id)
        .ok_or_else(|| format!("unknown built-in agent id `{}`", agent_id))?;
    let prompt_path = catalog.root.join(&agent.prompt_path);
    let prompt = fs::read_to_string(&prompt_path)
        .map_err(|error| format!("failed to read built-in agent prompt: {}", error))?;
    if prompt.trim().is_empty() {
        return Err(format!("built-in agent prompt `{}` is empty", agent_id));
    }
    let actual_hash = format!("{:x}", Sha256::digest(prompt.as_bytes()));
    if !actual_hash.eq_ignore_ascii_case(&agent.prompt_hash) {
        return Err(format!(
            "built-in agent prompt hash mismatch for `{}`",
            agent_id
        ));
    }
    Ok(BuiltInAgentPrompt {
        id: agent.id.clone(),
        provider_id: agent.provider_id.clone(),
        source_revision: agent.source_revision.clone(),
        prompt_hash: agent.prompt_hash.clone(),
        prompt,
    })
}

fn resolve_enabled_prompt(
    catalog: &LoadedCatalog,
    enabled_ids: &[String],
    agent_id: &str,
) -> Result<BuiltInAgentPrompt, String> {
    if !enabled_ids.iter().any(|id| id == agent_id) {
        return Err(format!("built-in agent `{}` is disabled", agent_id));
    }
    resolve_prompt(catalog, agent_id)
}

#[tauri::command]
pub(crate) async fn list_built_in_agents(
    locale: String,
    state: tauri::State<'_, crate::state::AppState>,
    app: tauri::AppHandle,
) -> Result<BuiltInAgentCatalogView, String> {
    let settings = state.app_settings.lock().await.clone();
    let enabled = normalized_enabled_builtin_agent_ids(&settings.enabled_builtin_agent_ids);
    let catalog = load_catalog(app_resource_dir(&app).as_deref())?;
    Ok(build_catalog_view(&catalog, &locale, &enabled))
}

#[tauri::command]
pub(crate) async fn set_built_in_agent_enabled(
    agent_id: String,
    enabled: bool,
    state: tauri::State<'_, crate::state::AppState>,
    app: tauri::AppHandle,
) -> Result<AppSettings, String> {
    let agent_id = agent_id.trim().to_string();
    let catalog = load_catalog(app_resource_dir(&app).as_deref())?;
    if !catalog.agents.iter().any(|agent| agent.id == agent_id) {
        return Err(format!("unknown built-in agent id `{}`", agent_id));
    }
    let mut settings = state.app_settings.lock().await.clone();
    settings.enabled_builtin_agent_ids =
        normalized_enabled_builtin_agent_ids(&settings.enabled_builtin_agent_ids);
    settings
        .enabled_builtin_agent_ids
        .retain(|id| id != &agent_id);
    if enabled {
        settings.enabled_builtin_agent_ids.push(agent_id);
        settings.enabled_builtin_agent_ids =
            normalized_enabled_builtin_agent_ids(&settings.enabled_builtin_agent_ids);
    }
    crate::shared::settings_core::update_app_settings_core(
        settings,
        &state.app_settings,
        &state.settings_path,
    )
    .await
}

#[tauri::command]
pub(crate) async fn set_built_in_agent_division_enabled(
    division_id: String,
    enabled: bool,
    state: tauri::State<'_, crate::state::AppState>,
    app: tauri::AppHandle,
) -> Result<AppSettings, String> {
    let division_id = division_id.trim();
    let catalog = load_catalog(app_resource_dir(&app).as_deref())?;
    if !catalog
        .manifest
        .divisions
        .iter()
        .any(|division| division.id == division_id)
    {
        return Err(format!("unknown built-in agent division `{}`", division_id));
    }
    let division_agent_ids: HashSet<&str> = catalog
        .agents
        .iter()
        .filter(|agent| agent.division_id == division_id)
        .map(|agent| agent.id.as_str())
        .collect();
    let mut settings = state.app_settings.lock().await.clone();
    settings.enabled_builtin_agent_ids =
        normalized_enabled_builtin_agent_ids(&settings.enabled_builtin_agent_ids);
    settings
        .enabled_builtin_agent_ids
        .retain(|id| !division_agent_ids.contains(id.as_str()));
    if enabled {
        settings
            .enabled_builtin_agent_ids
            .extend(division_agent_ids.into_iter().map(ToString::to_string));
        settings.enabled_builtin_agent_ids =
            normalized_enabled_builtin_agent_ids(&settings.enabled_builtin_agent_ids);
    }
    crate::shared::settings_core::update_app_settings_core(
        settings,
        &state.app_settings,
        &state.settings_path,
    )
    .await
}

#[tauri::command]
pub(crate) async fn get_built_in_agent_prompt(
    agent_id: String,
    app: tauri::AppHandle,
) -> Result<BuiltInAgentPrompt, String> {
    let catalog = load_catalog(app_resource_dir(&app).as_deref())?;
    resolve_prompt(&catalog, agent_id.trim())
}

#[tauri::command]
pub(crate) async fn resolve_enabled_built_in_agent(
    agent_id: String,
    state: tauri::State<'_, crate::state::AppState>,
    app: tauri::AppHandle,
) -> Result<BuiltInAgentPrompt, String> {
    let agent_id = agent_id.trim().to_string();
    let settings = state.app_settings.lock().await.clone();
    let enabled = normalized_enabled_builtin_agent_ids(&settings.enabled_builtin_agent_ids);
    let catalog = load_catalog(app_resource_dir(&app).as_deref())?;
    resolve_enabled_prompt(&catalog, &enabled, &agent_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn prompt_fixture(prompt: &str, expected_hash: &str) -> (LoadedCatalog, PathBuf) {
        let bundled = load_catalog_from_root(default_catalog_root()).expect("catalog");
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "ccgui-agent-catalog-{}-{}",
            std::process::id(),
            suffix
        ));
        fs::create_dir_all(&root).expect("fixture dir");
        fs::write(root.join("prompt.md"), prompt).expect("fixture prompt");
        let mut agent = bundled.agents[0].clone();
        agent.prompt_path = "prompt.md".to_string();
        agent.prompt_hash = expected_hash.to_string();
        (
            LoadedCatalog {
                root: root.clone(),
                manifest: bundled.manifest,
                agents: vec![agent],
            },
            root,
        )
    }

    #[test]
    fn normalizes_enabled_ids_deterministically() {
        let ids = vec![
            " agency-agents:engineering/engineering-ai-engineer ".to_string(),
            "invalid".to_string(),
            "agency-agents:engineering/engineering-ai-engineer".to_string(),
            "agency-agents:design/design-ui-designer".to_string(),
        ];
        assert_eq!(
            normalized_enabled_builtin_agent_ids(&ids),
            vec![
                "agency-agents:design/design-ui-designer".to_string(),
                "agency-agents:engineering/engineering-ai-engineer".to_string(),
            ]
        );
    }

    #[test]
    fn bundled_catalog_has_expected_counts_and_localization() {
        let catalog = load_catalog_from_root(default_catalog_root()).expect("catalog");
        assert_eq!(catalog.manifest.divisions.len(), 17);
        assert_eq!(catalog.agents.len(), 248);
        assert!(catalog.agents.iter().all(|agent| {
            !agent.name.zh_cn.trim().is_empty() && !agent.description.zh_cn.trim().is_empty()
        }));
    }

    #[test]
    fn rejects_tampered_catalog_source_identity() {
        let bundled_root = default_catalog_root();
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "ccgui-agent-catalog-identity-{}-{}",
            std::process::id(),
            suffix
        ));
        fs::create_dir_all(&root).expect("fixture dir");
        let mut manifest: serde_json::Value =
            read_json(&bundled_root.join("manifest.json"), "fixture manifest")
                .expect("manifest");
        manifest["sourceUrl"] = serde_json::Value::String(
            "javascript:alert(1)".to_string(),
        );
        fs::write(
            root.join("manifest.json"),
            serde_json::to_vec(&manifest).expect("serialize manifest"),
        )
        .expect("write manifest");
        fs::copy(
            bundled_root.join("agents.json"),
            root.join("agents.json"),
        )
        .expect("copy agents");

        assert!(load_catalog_from_root(root.clone())
            .expect_err("tampered source identity must fail")
            .contains("identity"));
        fs::remove_dir_all(root).expect("remove identity fixture");
    }

    #[test]
    fn prompt_resolution_checks_hash() {
        let catalog = load_catalog_from_root(default_catalog_root()).expect("catalog");
        let prompt = resolve_prompt(&catalog, &catalog.agents[0].id).expect("prompt");
        assert!(!prompt.prompt.trim().is_empty());
        assert_eq!(prompt.prompt_hash.len(), 64);
    }

    #[test]
    fn rejects_unsafe_ids_and_invalid_prompt_bodies() {
        assert!(validate_agent_id("agency-agents:../secret").is_err());
        assert!(validate_safe_relative_path("/absolute/prompt.md", "prompt").is_err());

        let (empty_catalog, empty_root) = prompt_fixture("", &format!("{:x}", Sha256::digest([])));
        assert!(resolve_prompt(&empty_catalog, &empty_catalog.agents[0].id)
            .expect_err("empty prompt must fail")
            .contains("empty"));
        fs::remove_dir_all(empty_root).expect("remove empty fixture");

        let (mismatch_catalog, mismatch_root) = prompt_fixture("prompt", &"0".repeat(64));
        assert!(
            resolve_prompt(&mismatch_catalog, &mismatch_catalog.agents[0].id)
                .expect_err("hash mismatch must fail")
                .contains("hash mismatch")
        );
        fs::remove_dir_all(mismatch_root).expect("remove mismatch fixture");
    }

    #[test]
    fn enabled_prompt_resolution_fails_closed() {
        let catalog = load_catalog_from_root(default_catalog_root()).expect("catalog");
        let agent_id = catalog.agents[0].id.clone();
        assert!(resolve_enabled_prompt(&catalog, &[], &agent_id)
            .expect_err("disabled agent must fail")
            .contains("disabled"));
        let unknown_id = "agency-agents:engineering/not-real".to_string();
        assert!(
            resolve_enabled_prompt(&catalog, &[unknown_id.clone()], &unknown_id)
                .expect_err("unknown agent must fail")
                .contains("unknown")
        );
    }

    #[test]
    fn chinese_locale_resolves_for_both_chinese_variants() {
        let value = LocalizedText {
            en: "Engineering".to_string(),
            zh_cn: "工程研发".to_string(),
        };
        assert_eq!(localized_text(&value, "zh"), "工程研发");
        assert_eq!(localized_text(&value, "zh-TW"), "工程研发");
        assert_eq!(localized_text(&value, "ja"), "Engineering");
    }
}
