use std::collections::{BTreeMap, BTreeSet};

use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::project_map_relations::ScannedFile;

fn stable_hash(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    let digest = hasher.finalize();
    digest
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn module_label(path: &str) -> String {
    let segments = path.split('/').collect::<Vec<_>>();
    if segments.len() >= 3 && segments[0] == "src" && segments[1] == "features" {
        return format!("frontend:{}", segments[2]);
    }
    if segments.len() >= 3 && segments[0] == "src-tauri" && segments[1] == "src" {
        return format!("backend:{}", segments[2].trim_end_matches(".rs"));
    }
    segments.first().copied().unwrap_or("root").to_string()
}

fn first_quoted_value(text: &str) -> Option<String> {
    let mut chars = text.char_indices();
    while let Some((index, character)) = chars.next() {
        if character != '\'' && character != '"' {
            continue;
        }
        let quote = character;
        let start = index + quote.len_utf8();
        let end = text[start..].find(quote)?;
        return Some(text[start..start + end].to_string());
    }
    None
}

fn java_declared_type(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("//") {
            continue;
        }
        let tokens = trimmed
            .split(|character: char| !character.is_ascii_alphanumeric() && character != '_')
            .filter(|token| !token.is_empty())
            .collect::<Vec<_>>();
        for (index, token) in tokens.iter().enumerate() {
            if matches!(*token, "class" | "interface" | "enum" | "record") {
                return tokens.get(index + 1).map(|value| (*value).to_string());
            }
        }
    }
    None
}

#[derive(Debug, Clone)]
struct ApiRouteAnnotation {
    method: Option<String>,
    path: Option<String>,
    framework: String,
    confidence: String,
    parser_source: String,
}

#[derive(Debug, Clone)]
struct ApiRouteCandidate {
    protocol: String,
    language: String,
    framework: Option<String>,
    method: Option<String>,
    path: Option<String>,
    operation_name: Option<String>,
    handler_symbol: Option<String>,
    source_file: String,
    line: usize,
    excerpt: String,
    confidence: String,
    parser_source: String,
    module_label: String,
    controller_label: String,
    parameter_overrides: Vec<ApiParameter>,
    request_body_override: Option<ApiRequestBody>,
    response_overrides: Vec<ApiResponse>,
    request_schema_override: Option<ApiSchemaRef>,
    response_schema_override: Option<ApiSchemaRef>,
    description: Option<String>,
    usage_scenario: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct ApiGroupBuild {
    id: String,
    label: String,
    level: String,
    parent_id: Option<String>,
    endpoint_ids: BTreeSet<String>,
    child_group_ids: BTreeSet<String>,
    protocol_counts: BTreeMap<String, usize>,
    language_counts: BTreeMap<String, usize>,
    confidence_counts: BTreeMap<String, usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiEvidence {
    path: String,
    line: usize,
    excerpt: String,
    redacted: bool,
    parser_source: String,
    extractor_version: String,
    observed_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiSchemaRef {
    id: String,
    name: String,
    language: String,
    source_file: String,
    evidence: Vec<ApiEvidence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiParameter {
    name: String,
    location: String,
    required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    schema: Option<ApiSchemaRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    default_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    example: Option<String>,
    evidence: Vec<ApiEvidence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiRequestBody {
    #[serde(skip_serializing_if = "Option::is_none")]
    content_type: Option<String>,
    required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    schema: Option<ApiSchemaRef>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    examples: Vec<String>,
    evidence: Vec<ApiEvidence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    status_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    schema: Option<ApiSchemaRef>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    examples: Vec<String>,
    is_error: bool,
    evidence: Vec<ApiEvidence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiEndpoint {
    id: String,
    protocol: String,
    language: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    framework: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    operation_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    handler_symbol: Option<String>,
    source_file: String,
    parameters: Vec<ApiParameter>,
    #[serde(skip_serializing_if = "Option::is_none")]
    request_body: Option<ApiRequestBody>,
    responses: Vec<ApiResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    request_schema: Option<ApiSchemaRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_schema: Option<ApiSchemaRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    usage_scenario: Option<String>,
    group_ids: Vec<String>,
    call_chain_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    call_chain_unavailable_reason: Option<String>,
    confidence: String,
    evidence: Vec<ApiEvidence>,
    #[serde(skip_serializing_if = "Option::is_none")]
    canonical_identity: Option<String>,
    identity_kind: String,
    ambiguous_identity: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiGroup {
    id: String,
    label: String,
    level: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    parent_id: Option<String>,
    endpoint_ids: Vec<String>,
    child_group_ids: Vec<String>,
    protocol_counts: BTreeMap<String, usize>,
    language_counts: BTreeMap<String, usize>,
    confidence_counts: BTreeMap<String, usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiCallChainEdge {
    id: String,
    source_symbol: String,
    target_symbol: String,
    source_file: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    line: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    excerpt: Option<String>,
    direction: String,
    kind: String,
    confidence: String,
    evidence: Vec<ApiEvidence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiCallChain {
    id: String,
    endpoint_id: String,
    edges: Vec<ApiCallChainEdge>,
    max_depth: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    truncated_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiSkippedSummary {
    reason: String,
    count: usize,
}

#[derive(Debug, Clone, Copy)]
struct ApiAdapterDescriptor {
    language: &'static str,
    parser_source: &'static str,
    frameworks: &'static [&'static str],
    extractor: fn(&ScannedFile, &str) -> Vec<ApiRouteCandidate>,
}

#[derive(Debug, Clone, Default)]
struct ApiAdapterCoverageBuild {
    file_count: usize,
    endpoint_count: usize,
    no_candidate_count: usize,
    unsupported_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiAdapterCoverage {
    language: String,
    parser_source: String,
    frameworks: Vec<String>,
    status: String,
    file_count: usize,
    endpoint_count: usize,
    no_candidate_count: usize,
    unsupported_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiContractGraph {
    schema_version: u8,
    generated_at: String,
    storage_key: String,
    scan_run_id: String,
    workspace_fingerprint: String,
    endpoints: Vec<ApiEndpoint>,
    groups: Vec<ApiGroup>,
    schemas: Vec<ApiSchemaRef>,
    call_chains: Vec<ApiCallChain>,
    adapters: Vec<ApiAdapterCoverage>,
    stale: Value,
    repair: Value,
    skipped: Vec<ApiSkippedSummary>,
}

const API_CONTRACT_MAX_FILE_BYTES: u64 = 1_000_000;

fn api_adapter_descriptor_for_language(language: &str) -> Option<ApiAdapterDescriptor> {
    match language {
        "java" => Some(ApiAdapterDescriptor {
            language: "java",
            parser_source: "fallback-pattern",
            frameworks: &["Spring MVC", "WebFlux", "JAX-RS", "Micronaut", "Quarkus"],
            extractor: extract_java_api_candidates,
        }),
        "kotlin" => Some(ApiAdapterDescriptor {
            language: "kotlin",
            parser_source: "fallback-pattern",
            frameworks: &["Spring MVC", "WebFlux", "JAX-RS", "Micronaut", "Quarkus"],
            extractor: extract_java_api_candidates,
        }),
        "python" => Some(ApiAdapterDescriptor {
            language: "python",
            parser_source: "fallback-pattern",
            frameworks: &["FastAPI", "Flask", "Django", "DRF"],
            extractor: extract_python_api_candidates,
        }),
        "go" => Some(ApiAdapterDescriptor {
            language: "go",
            parser_source: "fallback-pattern",
            frameworks: &["net/http", "Gin", "Echo", "Fiber", "Chi", "gRPC"],
            extractor: extract_go_api_candidates,
        }),
        "typescript" | "vue" | "svelte" => Some(ApiAdapterDescriptor {
            language: "typescript",
            parser_source: "fallback-pattern",
            frameworks: &["Express", "Koa", "Fastify", "NestJS", "Next API routes"],
            extractor: extract_typescript_api_candidates,
        }),
        "javascript" => Some(ApiAdapterDescriptor {
            language: "javascript",
            parser_source: "fallback-pattern",
            frameworks: &["Express", "Koa", "Fastify", "NestJS", "Next API routes"],
            extractor: extract_typescript_api_candidates,
        }),
        "csharp" => Some(ApiAdapterDescriptor {
            language: "csharp",
            parser_source: "fallback-pattern",
            frameworks: &["ASP.NET Core Controller", "ASP.NET Core Minimal API"],
            extractor: extract_csharp_api_candidates,
        }),
        "rust" => Some(ApiAdapterDescriptor {
            language: "rust",
            parser_source: "fallback-pattern",
            frameworks: &["Axum", "Actix Web", "Rocket", "Warp"],
            extractor: extract_rust_api_candidates,
        }),
        "c" => Some(ApiAdapterDescriptor {
            language: "c",
            parser_source: "fallback-pattern",
            frameworks: &["Mongoose", "CivetWeb", "libmicrohttpd", "handler table", "C ABI"],
            extractor: extract_c_family_api_candidates,
        }),
        "cpp" => Some(ApiAdapterDescriptor {
            language: "cpp",
            parser_source: "fallback-pattern",
            frameworks: &["Drogon", "Crow", "Oat++", "Pistache", "RESTinio", "Boost.Beast", "gRPC"],
            extractor: extract_c_family_api_candidates,
        }),
        _ => None,
    }
}

fn declared_api_adapter_descriptors() -> Vec<ApiAdapterDescriptor> {
    ["java", "kotlin", "python", "go", "c", "cpp", "typescript", "javascript", "csharp", "rust"]
        .into_iter()
        .flat_map(api_adapter_descriptor_for_language)
        .collect()
}

fn canonical_api_scope_skip_reason(item: &Value) -> String {
    let raw_reason = item
        .get("reason")
        .and_then(Value::as_str)
        .or_else(|| item.get("source").and_then(Value::as_str))
        .unwrap_or("ignored");
    let raw_path = item
        .get("path")
        .and_then(Value::as_str)
        .or_else(|| item.get("relativePath").and_then(Value::as_str))
        .unwrap_or("");
    let combined = format!("{raw_reason} {raw_path}").to_ascii_lowercase();
    if combined.contains("node_modules")
        || combined.contains("/target/")
        || combined.contains("/build/")
        || combined.contains("/dist/")
        || combined.contains("/vendor/")
        || combined.contains("/.git/")
    {
        "dependency-directory".to_string()
    } else if combined.contains("generated") || combined.contains("codegen") {
        "generated-directory".to_string()
    } else if combined.contains("binary") {
        "binary-file".to_string()
    } else if combined.contains("size") || combined.contains("large") || combined.contains("oversized") {
        "oversized-file".to_string()
    } else if combined.contains("ignore") {
        "workspace-ignore".to_string()
    } else {
        "ignored-path".to_string()
    }
}

fn path_has_segment(path: &str, segment: &str) -> bool {
    path.split('/').any(|value| value == segment)
}

fn api_scan_scope_skip_reason(file: &ScannedFile) -> Option<String> {
    let path = file.path.replace('\\', "/").to_ascii_lowercase();
    if path_has_segment(&path, "node_modules")
        || path_has_segment(&path, "target")
        || path_has_segment(&path, "build")
        || path_has_segment(&path, "dist")
        || path_has_segment(&path, "vendor")
        || path_has_segment(&path, ".git")
    {
        return Some("dependency-directory".to_string());
    }
    if path_has_segment(&path, "generated")
        || path_has_segment(&path, "codegen")
        || path.contains(".generated.")
        || path.contains(".gen.")
    {
        return Some("generated-directory".to_string());
    }
    if file.size_bytes > API_CONTRACT_MAX_FILE_BYTES {
        return Some("oversized-file".to_string());
    }
    let parse_status = file.parse_status.to_ascii_lowercase();
    if parse_status.contains("binary") || file.language == "binary" {
        return Some("binary-file".to_string());
    }
    None
}

fn increment_skipped_reason(skipped_by_reason: &mut BTreeMap<String, usize>, reason: impl Into<String>) {
    *skipped_by_reason.entry(reason.into()).or_insert(0) += 1;
}

fn api_workspace_fingerprint(file_contents: &[(ScannedFile, String)]) -> String {
    let mut fingerprints = file_contents
        .iter()
        .map(|(file, _)| format!("{}:{}", file.path, file.content_hash))
        .collect::<Vec<_>>();
    fingerprints.sort();
    stable_hash(&fingerprints.join("|"))
}

fn is_openapi_contract_file(file: &ScannedFile) -> bool {
    let extension = file.extension.to_ascii_lowercase();
    let name = format!("{} {}", file.basename, file.path).to_ascii_lowercase();
    matches!(extension.as_str(), "json" | "yaml" | "yml")
        && (name.contains("openapi") || name.contains("swagger"))
}

fn parse_openapi_document(file: &ScannedFile, content: &str) -> Result<Value, String> {
    match file.extension.to_ascii_lowercase().as_str() {
        "json" => serde_json::from_str(content)
            .map_err(|error| format!("failed to parse OpenAPI JSON {}: {error}", file.path)),
        "yaml" | "yml" => serde_yaml::from_str(content)
            .map_err(|error| format!("failed to parse OpenAPI YAML {}: {error}", file.path)),
        extension => Err(format!("unsupported OpenAPI extension {extension} for {}", file.path)),
    }
}

fn openapi_document_title(document: &Value, file: &ScannedFile) -> String {
    if let Some(title) = document
        .get("info")
        .and_then(|info| info.get("title"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        title.to_string()
    } else {
        file_stem_label(&file.path)
    }
}

fn openapi_line_number(content: &str, path: &str, method: &str) -> usize {
    let method_lower = method.to_ascii_lowercase();
    let mut path_line = None;
    for (index, line) in content.lines().enumerate() {
        let line_number = index + 1;
        if path_line.is_none() && line.contains(path) {
            path_line = Some(line_number);
        }
        let trimmed = line.trim().to_ascii_lowercase();
        if path_line.is_some()
            && (trimmed.starts_with(&format!("{method_lower}:"))
                || trimmed.contains(&format!("\"{method_lower}\""))
                || trimmed.contains(&format!("'{method_lower}'")))
        {
            return line_number;
        }
    }
    path_line.unwrap_or(1)
}

fn openapi_excerpt(content: &str, line: usize, fallback: &str) -> String {
    content
        .lines()
        .nth(line.saturating_sub(1))
        .map(api_trimmed_excerpt)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn openapi_schema_ref_name(schema: &Value, fallback_name: &str) -> String {
    schema
        .get("$ref")
        .and_then(Value::as_str)
        .and_then(|reference| reference.rsplit('/').next())
        .or_else(|| schema.get("title").and_then(Value::as_str))
        .or_else(|| schema.get("type").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback_name)
        .to_string()
}

fn openapi_schema_ref(
    schema: &Value,
    file: &ScannedFile,
    line: usize,
    excerpt: &str,
    generated_at: &str,
    fallback_name: &str,
) -> Option<ApiSchemaRef> {
    if !schema.is_object() {
        return None;
    }
    let name = openapi_schema_ref_name(schema, fallback_name);
    Some(ApiSchemaRef {
        id: format!("api-schema-{}", stable_hash(&format!("{}|{}|{}", file.path, line, name))),
        name,
        language: "unknown".to_string(),
        source_file: file.path.clone(),
        evidence: vec![api_evidence_payload(
            &file.path,
            line,
            excerpt,
            "schema-parser",
            generated_at,
        )],
    })
}

fn openapi_first_content_schema(value: &Value) -> (Option<String>, Option<&Value>) {
    let Some(content) = value.get("content").and_then(Value::as_object) else {
        return (None, None);
    };
    content
        .iter()
        .find_map(|(content_type, media)| {
            media.get("schema")
                .map(|schema| (Some(content_type.clone()), Some(schema)))
        })
        .unwrap_or((None, None))
}

fn openapi_parameter(
    parameter: &Value,
    file: &ScannedFile,
    line: usize,
    excerpt: &str,
    generated_at: &str,
) -> Option<ApiParameter> {
    let name = parameter.get("name").and_then(Value::as_str)?.trim();
    if name.is_empty() {
        return None;
    }
    let location = parameter
        .get("in")
        .and_then(Value::as_str)
        .unwrap_or("query")
        .trim()
        .to_string();
    let schema = parameter
        .get("schema")
        .or_else(|| parameter.get("type").map(|_| parameter))
        .and_then(|schema| openapi_schema_ref(schema, file, line, excerpt, generated_at, name));
    let example = parameter
        .get("example")
        .and_then(Value::as_str)
        .map(|value| redact_api_evidence_excerpt(value).0);
    Some(ApiParameter {
        name: name.to_string(),
        location,
        required: parameter
            .get("required")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        schema,
        default_value: None,
        example,
        evidence: vec![api_evidence_payload(
            &file.path,
            line,
            excerpt,
            "schema-parser",
            generated_at,
        )],
    })
}

fn openapi_parameters(
    path_item: &Value,
    operation: &Value,
    file: &ScannedFile,
    line: usize,
    excerpt: &str,
    generated_at: &str,
) -> Vec<ApiParameter> {
    let mut parameters = Vec::new();
    for source in [path_item.get("parameters"), operation.get("parameters")] {
        let Some(items) = source.and_then(Value::as_array) else {
            continue;
        };
        for item in items {
            if let Some(parameter) = openapi_parameter(item, file, line, excerpt, generated_at) {
                parameters.push(parameter);
            }
        }
    }
    parameters
}

fn openapi_request_body(
    operation: &Value,
    parameters: &[ApiParameter],
    file: &ScannedFile,
    line: usize,
    excerpt: &str,
    generated_at: &str,
) -> Option<ApiRequestBody> {
    if let Some(body) = operation.get("requestBody") {
        let (content_type, schema) = openapi_first_content_schema(body);
        return Some(ApiRequestBody {
            content_type,
            required: body.get("required").and_then(Value::as_bool).unwrap_or(false),
            schema: schema.and_then(|schema| {
                openapi_schema_ref(schema, file, line, excerpt, generated_at, "requestBody")
            }),
            examples: Vec::new(),
            evidence: vec![api_evidence_payload(
                &file.path,
                line,
                excerpt,
                "schema-parser",
                generated_at,
            )],
        });
    }
    parameters
        .iter()
        .find(|parameter| parameter.location == "body")
        .map(|parameter| ApiRequestBody {
            content_type: Some("application/json".to_string()),
            required: parameter.required,
            schema: parameter.schema.clone(),
            examples: Vec::new(),
            evidence: parameter.evidence.clone(),
        })
}

fn openapi_response(
    status_code: &str,
    response: &Value,
    file: &ScannedFile,
    line: usize,
    excerpt: &str,
    generated_at: &str,
) -> ApiResponse {
    let (content_type, schema) = openapi_first_content_schema(response);
    let swagger_schema = response.get("schema");
    let schema = schema
        .or(swagger_schema)
        .and_then(|schema| openapi_schema_ref(schema, file, line, excerpt, generated_at, status_code));
    let is_error = status_code == "default"
        || status_code
            .parse::<u16>()
            .map(|code| code >= 400)
            .unwrap_or(false);
    ApiResponse {
        status_code: Some(status_code.to_string()),
        content_type,
        schema,
        examples: Vec::new(),
        is_error,
        evidence: vec![api_evidence_payload(
            &file.path,
            line,
            excerpt,
            "schema-parser",
            generated_at,
        )],
    }
}

fn openapi_responses(
    operation: &Value,
    file: &ScannedFile,
    line: usize,
    excerpt: &str,
    generated_at: &str,
) -> Vec<ApiResponse> {
    let Some(responses) = operation.get("responses").and_then(Value::as_object) else {
        return Vec::new();
    };
    responses
        .iter()
        .map(|(status_code, response)| {
            openapi_response(status_code, response, file, line, excerpt, generated_at)
        })
        .collect()
}

fn extract_openapi_contract_candidates(
    file: &ScannedFile,
    content: &str,
    generated_at: &str,
) -> Result<Vec<ApiRouteCandidate>, String> {
    let document = parse_openapi_document(file, content)?;
    let Some(paths) = document.get("paths").and_then(Value::as_object) else {
        return Ok(Vec::new());
    };
    let title = openapi_document_title(&document, file);
    let base_path = document
        .get("basePath")
        .and_then(Value::as_str)
        .map(str::to_string);
    let mut candidates = Vec::new();
    for (raw_path, path_item) in paths {
        let Some(path_item_object) = path_item.as_object() else {
            continue;
        };
        for method in ["get", "post", "put", "delete", "patch", "options", "head", "trace"] {
            let Some(operation) = path_item_object.get(method) else {
                continue;
            };
            let line = openapi_line_number(content, raw_path, method);
            let excerpt = openapi_excerpt(content, line, &format!("{} {}", method.to_ascii_uppercase(), raw_path));
            let parameters = openapi_parameters(path_item, operation, file, line, &excerpt, generated_at);
            let request_body = openapi_request_body(operation, &parameters, file, line, &excerpt, generated_at);
            let responses = openapi_responses(operation, file, line, &excerpt, generated_at);
            let operation_name = operation
                .get("operationId")
                .and_then(Value::as_str)
                .map(str::to_string);
            let tag = operation
                .get("tags")
                .and_then(Value::as_array)
                .and_then(|tags| tags.first())
                .and_then(Value::as_str)
                .map(str::to_string);
            let description = operation
                .get("summary")
                .and_then(Value::as_str)
                .or_else(|| operation.get("description").and_then(Value::as_str))
                .map(str::to_string);
            let path = base_path
                .as_deref()
                .and_then(|prefix| join_api_paths(prefix, Some(raw_path.clone())))
                .or_else(|| normalize_api_path(Some(raw_path.clone())));
            let response_schema = responses.iter().find_map(|response| response.schema.clone());
            candidates.push(ApiRouteCandidate {
                protocol: "http".to_string(),
                language: "unknown".to_string(),
                framework: Some(if document.get("swagger").is_some() {
                    "Swagger".to_string()
                } else {
                    "OpenAPI".to_string()
                }),
                method: Some(method.to_ascii_uppercase()),
                path,
                operation_name,
                handler_symbol: None,
                source_file: file.path.clone(),
                line,
                excerpt,
                confidence: "spec".to_string(),
                parser_source: "schema-parser".to_string(),
                module_label: format!("api-contract:{title}"),
                controller_label: tag.unwrap_or_else(|| title.clone()),
                parameter_overrides: parameters,
                request_schema_override: request_body.as_ref().and_then(|body| body.schema.clone()),
                request_body_override: request_body,
                response_schema_override: response_schema,
                response_overrides: responses,
                description,
                usage_scenario: None,
            });
        }
    }
    Ok(candidates)
}

fn is_proto_contract_file(file: &ScannedFile) -> bool {
    file.extension.eq_ignore_ascii_case("proto")
}

fn is_graphql_contract_file(file: &ScannedFile) -> bool {
    matches!(file.extension.to_ascii_lowercase().as_str(), "graphql" | "gql")
}

fn api_contract_schema_ref_from_name(
    name: &str,
    file: &ScannedFile,
    line: usize,
    excerpt: &str,
    parser_source: &str,
    generated_at: &str,
) -> Option<ApiSchemaRef> {
    let normalized = name
        .trim()
        .trim_start_matches('&')
        .trim_start_matches('[')
        .trim_end_matches(']')
        .trim_end_matches('!')
        .trim();
    if normalized.is_empty() {
        return None;
    }
    Some(ApiSchemaRef {
        id: format!("api-schema-{}", stable_hash(&format!("{}|{}|{}", file.path, line, normalized))),
        name: normalized.to_string(),
        language: "unknown".to_string(),
        source_file: file.path.clone(),
        evidence: vec![api_evidence_payload(
            &file.path,
            line,
            excerpt,
            parser_source,
            generated_at,
        )],
    })
}

fn proto_package_name(content: &str) -> Option<String> {
    content.lines().find_map(|line| {
        let trimmed = line.trim();
        trimmed
            .strip_prefix("package ")
            .map(|tail| tail.trim_end_matches(';').trim().to_string())
            .filter(|value| !value.is_empty())
    })
}

fn proto_rpc_signature(line: &str) -> Option<(String, String, String)> {
    let trimmed = line.trim();
    let rpc_tail = trimmed.strip_prefix("rpc ")?;
    let method = rpc_tail.split_whitespace().next()?.trim();
    let request_start = trimmed.find('(')?;
    let request_end = trimmed[request_start + 1..].find(')')? + request_start + 1;
    let request_type = trimmed[request_start + 1..request_end].trim();
    let returns_index = trimmed.find("returns")?;
    let response_start = trimmed[returns_index..].find('(')? + returns_index;
    let response_end = trimmed[response_start + 1..].find(')')? + response_start + 1;
    let response_type = trimmed[response_start + 1..response_end].trim();
    if method.is_empty() || request_type.is_empty() || response_type.is_empty() {
        return None;
    }
    Some((method.to_string(), request_type.to_string(), response_type.to_string()))
}

fn extract_proto_contract_candidates(
    file: &ScannedFile,
    content: &str,
    generated_at: &str,
) -> Vec<ApiRouteCandidate> {
    let package_name = proto_package_name(content).unwrap_or_else(|| module_label(&file.path));
    let mut service_name: Option<String> = None;
    let mut candidates = Vec::new();
    for (line_index, line) in content.lines().enumerate() {
        let line_number = line_index + 1;
        let trimmed = line.trim();
        if let Some(tail) = trimmed.strip_prefix("service ") {
            service_name = tail
                .split(|character: char| character.is_whitespace() || character == '{')
                .next()
                .map(str::to_string)
                .filter(|value| !value.is_empty());
            continue;
        }
        if trimmed.starts_with('}') {
            service_name = None;
            continue;
        }
        let Some(service) = service_name.clone() else {
            continue;
        };
        let Some((method, request_type, response_type)) = proto_rpc_signature(trimmed) else {
            continue;
        };
        let excerpt = api_trimmed_excerpt(line);
        let request_schema = api_contract_schema_ref_from_name(
            &request_type,
            file,
            line_number,
            &excerpt,
            "descriptor",
            generated_at,
        );
        let response_schema = api_contract_schema_ref_from_name(
            &response_type,
            file,
            line_number,
            &excerpt,
            "descriptor",
            generated_at,
        );
        let operation_name = format!("{service}.{method}");
        candidates.push(ApiRouteCandidate {
            protocol: "grpc".to_string(),
            language: "unknown".to_string(),
            framework: Some("gRPC".to_string()),
            method: None,
            path: None,
            operation_name: Some(operation_name.clone()),
            handler_symbol: Some(operation_name),
            source_file: file.path.clone(),
            line: line_number,
            excerpt,
            confidence: "spec".to_string(),
            parser_source: "descriptor".to_string(),
            module_label: package_name.clone(),
            controller_label: service,
            parameter_overrides: Vec::new(),
            request_body_override: Some(ApiRequestBody {
                content_type: Some("application/grpc".to_string()),
                required: true,
                schema: request_schema.clone(),
                examples: Vec::new(),
                evidence: vec![api_evidence_payload(
                    &file.path,
                    line_number,
                    line,
                    "descriptor",
                    generated_at,
                )],
            }),
            response_overrides: vec![ApiResponse {
                status_code: None,
                content_type: Some("application/grpc".to_string()),
                schema: response_schema.clone(),
                examples: Vec::new(),
                is_error: false,
                evidence: vec![api_evidence_payload(
                    &file.path,
                    line_number,
                    line,
                    "descriptor",
                    generated_at,
                )],
            }],
            request_schema_override: request_schema,
            response_schema_override: response_schema,
            description: None,
            usage_scenario: None,
        });
    }
    candidates
}

fn graphql_field_signature(line: &str) -> Option<(String, Option<String>, String)> {
    let trimmed = line.trim().trim_end_matches(',');
    if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with('}') {
        return None;
    }
    let (left, response_type) = trimmed.split_once(':')?;
    let field_name = left
        .split('(')
        .next()
        .map(str::trim)
        .filter(|value| !value.is_empty())?;
    let args = left
        .split_once('(')
        .and_then(|(_, tail)| tail.rsplit_once(')').map(|(args, _)| args.trim().to_string()))
        .filter(|value| !value.is_empty());
    Some((field_name.to_string(), args, response_type.trim().to_string()))
}

fn extract_graphql_contract_candidates(
    file: &ScannedFile,
    content: &str,
    generated_at: &str,
) -> Vec<ApiRouteCandidate> {
    let mut operation_type: Option<String> = None;
    let mut candidates = Vec::new();
    for (line_index, line) in content.lines().enumerate() {
        let line_number = line_index + 1;
        let trimmed = line.trim();
        for (type_name, operation) in [("type Query", "query"), ("type Mutation", "mutation"), ("type Subscription", "subscription")] {
            if trimmed.starts_with(type_name) {
                operation_type = Some(operation.to_string());
            }
        }
        if trimmed.starts_with('}') {
            operation_type = None;
            continue;
        }
        let Some(operation) = operation_type.clone() else {
            continue;
        };
        let Some((field_name, args, response_type)) = graphql_field_signature(trimmed) else {
            continue;
        };
        let excerpt = api_trimmed_excerpt(line);
        let response_schema = api_contract_schema_ref_from_name(
            &response_type,
            file,
            line_number,
            &excerpt,
            "schema-parser",
            generated_at,
        );
        let parameters = args
            .map(|args| {
                split_api_signature_parameters(&args)
                    .into_iter()
                    .flat_map(|parameter| {
                        let (name, type_name) = parameter.split_once(':')?;
                        Some(ApiParameter {
                            name: name.trim().to_string(),
                            location: "body".to_string(),
                            required: type_name.trim().ends_with('!'),
                            schema: api_contract_schema_ref_from_name(
                                type_name,
                                file,
                                line_number,
                                &excerpt,
                                "schema-parser",
                                generated_at,
                            ),
                            default_value: None,
                            example: None,
                            evidence: vec![api_evidence_payload(
                                &file.path,
                                line_number,
                                &excerpt,
                                "schema-parser",
                                generated_at,
                            )],
                        })
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        candidates.push(ApiRouteCandidate {
            protocol: "graphql".to_string(),
            language: "unknown".to_string(),
            framework: Some("GraphQL".to_string()),
            method: Some(operation.clone()),
            path: None,
            operation_name: Some(field_name.clone()),
            handler_symbol: None,
            source_file: file.path.clone(),
            line: line_number,
            excerpt,
            confidence: "spec".to_string(),
            parser_source: "schema-parser".to_string(),
            module_label: module_label(&file.path),
            controller_label: operation,
            parameter_overrides: parameters,
            request_body_override: None,
            response_overrides: vec![ApiResponse {
                status_code: None,
                content_type: Some("application/graphql-response+json".to_string()),
                schema: response_schema.clone(),
                examples: Vec::new(),
                is_error: false,
                evidence: vec![api_evidence_payload(
                    &file.path,
                    line_number,
                    line,
                    "schema-parser",
                    generated_at,
                )],
            }],
            request_schema_override: None,
            response_schema_override: response_schema,
            description: None,
            usage_scenario: None,
        });
    }
    candidates
}

fn api_trimmed_excerpt(line: &str) -> String {
    line.trim().chars().take(220).collect()
}

fn redact_api_evidence_excerpt(line: &str) -> (String, bool) {
    let excerpt = api_trimmed_excerpt(line);
    let lowered = excerpt.to_ascii_lowercase();
    let contains_sensitive_marker = [
        "authorization",
        "set-cookie",
        "cookie",
        "bearer ",
        "token",
        "password",
        "passwd",
        "secret",
        "api_key",
        "api-key",
        "api key",
        "apikey",
        "private_key",
        "private-key",
        "private key",
        "credential",
    ]
    .iter()
    .any(|marker| lowered.contains(marker));
    if contains_sensitive_marker {
        ("[redacted sensitive API evidence]".to_string(), true)
    } else {
        (excerpt, false)
    }
}

fn api_evidence_payload(
    source_file: &str,
    line: usize,
    excerpt: &str,
    parser_source: &str,
    generated_at: &str,
) -> ApiEvidence {
    let (safe_excerpt, redacted) = redact_api_evidence_excerpt(excerpt);
    ApiEvidence {
        path: source_file.to_string(),
        line,
        excerpt: safe_excerpt,
        redacted,
        parser_source: parser_source.to_string(),
        extractor_version: "project-map-api-contract-v1".to_string(),
        observed_at: generated_at.to_string(),
    }
}

fn normalize_api_path(value: Option<String>) -> Option<String> {
    let raw = value?.trim().to_string();
    if raw.is_empty() {
        return Some("/".to_string());
    }
    if raw.starts_with('/') {
        Some(raw)
    } else {
        Some(format!("/{raw}"))
    }
}

fn join_api_paths(prefix: &str, path: Option<String>) -> Option<String> {
    let path = normalize_api_path(path)?;
    let prefix = normalize_api_path(Some(prefix.to_string())).unwrap_or_else(|| "/".to_string());
    if prefix == "/" {
        return Some(path);
    }
    if path == "/" {
        return Some(prefix);
    }
    Some(format!(
        "{}/{}",
        prefix.trim_end_matches('/'),
        path.trim_start_matches('/')
    ))
}

fn parse_api_methods_from_line(line: &str) -> Vec<String> {
    let upper = line.to_ascii_uppercase();
    ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]
        .iter()
        .filter(|method| upper.contains(**method))
        .map(|method| method.to_string())
        .collect()
}

fn handler_after_first_comma(line: &str) -> Option<String> {
    let (_, tail) = line.split_once(',')?;
    let raw = tail
        .split([',', ')', ']'])
        .next()
        .unwrap_or(tail)
        .trim()
        .trim_start_matches('&')
        .trim_start_matches('*')
        .trim();
    if raw.is_empty() {
        None
    } else {
        Some(raw.to_string())
    }
}

fn handler_name_before_parenthesis(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if trimmed.starts_with('@') || trimmed.starts_with('#') || trimmed.starts_with('[') {
        return None;
    }
    let before_parenthesis = trimmed.split_once('(')?.0.trim();
    let token = before_parenthesis
        .split_whitespace()
        .last()?
        .trim_matches(|character: char| !character.is_alphanumeric() && character != '_' && character != '$');
    if token.is_empty()
        || matches!(
            token,
            "if" | "for" | "while" | "switch" | "catch" | "return" | "new" | "class"
        )
    {
        None
    } else {
        Some(token.to_string())
    }
}

fn file_stem_label(path: &str) -> String {
    path.rsplit('/')
        .next()
        .unwrap_or(path)
        .split('.')
        .next()
        .unwrap_or(path)
        .to_string()
}

fn api_module_label(file: &ScannedFile) -> String {
    let path = file.path.replace('\\', "/");
    if let Some(package_path) = path
        .strip_prefix("src/main/java/")
        .or_else(|| path.strip_prefix("src/main/kotlin/"))
        .and_then(|tail| tail.rsplit_once('/').map(|(directory, _)| directory.replace('/', ".")))
    {
        if !package_path.is_empty() {
            return package_path;
        }
    }
    module_label(&file.path)
}

fn push_api_route_candidate(
    candidates: &mut Vec<ApiRouteCandidate>,
    file: &ScannedFile,
    annotation: ApiRouteAnnotation,
    line: usize,
    excerpt: &str,
    handler_symbol: Option<String>,
    controller_label: Option<String>,
) {
    let method = annotation.method.map(|value| value.to_ascii_uppercase());
    let path = normalize_api_path(annotation.path);
    let handler_symbol = handler_symbol.filter(|value| !value.trim().is_empty());
    let controller_label = controller_label
        .filter(|value| !value.trim().is_empty())
        .or_else(|| handler_symbol.clone())
        .unwrap_or_else(|| file_stem_label(&file.path));
    candidates.push(ApiRouteCandidate {
        protocol: "http".to_string(),
        language: file.language.clone(),
        framework: Some(annotation.framework),
        method,
        path,
        operation_name: None,
        handler_symbol,
        source_file: file.path.clone(),
        line,
        excerpt: api_trimmed_excerpt(excerpt),
        confidence: annotation.confidence,
        parser_source: annotation.parser_source,
        module_label: api_module_label(file),
        controller_label,
        parameter_overrides: Vec::new(),
        request_body_override: None,
        response_overrides: Vec::new(),
        request_schema_override: None,
        response_schema_override: None,
        description: None,
        usage_scenario: None,
    });
}

fn spring_route_annotation(line: &str) -> Option<ApiRouteAnnotation> {
    let trimmed = line.trim();
    let route = if trimmed.contains("@GetMapping") {
        Some(("GET", "Spring MVC"))
    } else if trimmed.contains("@PostMapping") {
        Some(("POST", "Spring MVC"))
    } else if trimmed.contains("@PutMapping") {
        Some(("PUT", "Spring MVC"))
    } else if trimmed.contains("@DeleteMapping") {
        Some(("DELETE", "Spring MVC"))
    } else if trimmed.contains("@PatchMapping") {
        Some(("PATCH", "Spring MVC"))
    } else if trimmed.contains("@Get(") || trimmed.contains("@io.micronaut.http.annotation.Get") {
        Some(("GET", "Micronaut"))
    } else if trimmed.contains("@Post(") || trimmed.contains("@io.micronaut.http.annotation.Post") {
        Some(("POST", "Micronaut"))
    } else if trimmed.contains("@Put(") || trimmed.contains("@io.micronaut.http.annotation.Put") {
        Some(("PUT", "Micronaut"))
    } else if trimmed.contains("@Delete(") || trimmed.contains("@io.micronaut.http.annotation.Delete") {
        Some(("DELETE", "Micronaut"))
    } else if trimmed == "@GET" || trimmed.contains("@GET ") {
        Some(("GET", "JAX-RS"))
    } else if trimmed == "@POST" || trimmed.contains("@POST ") {
        Some(("POST", "JAX-RS"))
    } else if trimmed == "@PUT" || trimmed.contains("@PUT ") {
        Some(("PUT", "JAX-RS"))
    } else if trimmed == "@DELETE" || trimmed.contains("@DELETE ") {
        Some(("DELETE", "JAX-RS"))
    } else if trimmed == "@PATCH" || trimmed.contains("@PATCH ") {
        Some(("PATCH", "JAX-RS"))
    } else if trimmed.contains("@RequestMapping") {
        None
    } else if trimmed.contains("@Path(") {
        None
    } else if trimmed.contains("@Controller(") {
        None
    } else {
        return None;
    };
    let method = route
        .map(|(method, _)| method.to_string())
        .or_else(|| parse_api_methods_from_line(trimmed).first().cloned());
    Some(ApiRouteAnnotation {
        method,
        path: first_quoted_value(trimmed),
        framework: route.map(|(_, framework)| framework).unwrap_or_else(|| {
            if trimmed.contains("@Path(") {
                "JAX-RS"
            } else if trimmed.contains("@Controller(") {
                "Micronaut"
            } else {
                "Spring MVC"
            }
        }).to_string(),
        confidence: if trimmed.contains("@RequestMapping")
            || trimmed.contains("@Path(")
            || trimmed.contains("@Controller(")
        {
            "medium"
        } else {
            "high"
        }
        .to_string(),
        parser_source: "fallback-pattern".to_string(),
    })
}

fn merge_java_route_annotations(annotations: Vec<ApiRouteAnnotation>) -> Vec<ApiRouteAnnotation> {
    if annotations.len() <= 1 {
        return annotations;
    }
    let method = annotations.iter().find_map(|annotation| annotation.method.clone());
    let path = annotations.iter().rev().find_map(|annotation| annotation.path.clone());
    let framework = annotations
        .iter()
        .find(|annotation| annotation.method.is_some())
        .or_else(|| annotations.first())
        .map(|annotation| annotation.framework.clone())
        .unwrap_or_else(|| "JAX-RS".to_string());
    let confidence = if method.is_some() && path.is_some() {
        "high"
    } else {
        "medium"
    }
    .to_string();
    vec![ApiRouteAnnotation {
        method,
        path,
        framework,
        confidence,
        parser_source: "fallback-pattern".to_string(),
    }]
}

fn extract_java_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    let mut candidates = Vec::new();
    let class_name = java_declared_type(content).unwrap_or_else(|| file_stem_label(&file.path));
    let mut class_prefix = "/".to_string();
    let mut pending_annotations = Vec::<ApiRouteAnnotation>::new();

    for (line_index, line) in content.lines().enumerate() {
        let line_number = line_index + 1;
        if let Some(annotation) = spring_route_annotation(line) {
            if let Some(method_name) = handler_name_before_parenthesis(line) {
                let mut route = annotation;
                route.path = join_api_paths(&class_prefix, route.path);
                push_api_route_candidate(
                    &mut candidates,
                    file,
                    route,
                    line_number,
                    line,
                    Some(format!("{class_name}.{method_name}")),
                    Some(class_name.clone()),
                );
            } else {
                pending_annotations.push(annotation);
            }
            continue;
        }

        let trimmed = line.trim();
        if !pending_annotations.is_empty()
            && (trimmed.contains(" class ") || trimmed.starts_with("class ") || trimmed.contains(" interface "))
        {
            if let Some(prefix) = pending_annotations
                .iter()
                .rev()
                .find_map(|annotation| annotation.path.clone())
                .and_then(|path| normalize_api_path(Some(path)))
            {
                class_prefix = prefix;
            }
            pending_annotations.clear();
            continue;
        }

        if pending_annotations.is_empty() {
            continue;
        }
        let Some(method_name) = handler_name_before_parenthesis(line) else {
            continue;
        };
        let annotations = merge_java_route_annotations(pending_annotations.drain(..).collect());
        for mut annotation in annotations {
            annotation.path = join_api_paths(&class_prefix, annotation.path);
            push_api_route_candidate(
                &mut candidates,
                file,
                annotation,
                line_number,
                line,
                Some(format!("{class_name}.{method_name}")),
                Some(class_name.clone()),
            );
        }
    }

    candidates
}

fn python_route_annotation(line: &str) -> Option<ApiRouteAnnotation> {
    let trimmed = line.trim();
    if !trimmed.starts_with('@') {
        return None;
    }
    let lower = trimmed.to_ascii_lowercase();
    for (needle, method, framework) in [
        (".get(", "GET", "FastAPI"),
        (".post(", "POST", "FastAPI"),
        (".put(", "PUT", "FastAPI"),
        (".delete(", "DELETE", "FastAPI"),
        (".patch(", "PATCH", "FastAPI"),
    ] {
        if lower.contains(needle) {
            return Some(ApiRouteAnnotation {
                method: Some(method.to_string()),
                path: first_quoted_value(trimmed),
                framework: framework.to_string(),
                confidence: "high".to_string(),
                parser_source: "fallback-pattern".to_string(),
            });
        }
    }
    if lower.contains(".route(") {
        return Some(ApiRouteAnnotation {
            method: parse_api_methods_from_line(trimmed).first().cloned(),
            path: first_quoted_value(trimmed),
            framework: "Flask".to_string(),
            confidence: "medium".to_string(),
            parser_source: "fallback-pattern".to_string(),
        });
    }
    if lower.contains("@api_view(") {
        return Some(ApiRouteAnnotation {
            method: parse_api_methods_from_line(trimmed).first().cloned(),
            path: None,
            framework: "DRF".to_string(),
            confidence: "medium".to_string(),
            parser_source: "fallback-pattern".to_string(),
        });
    }
    if lower.contains("@action(") {
        let path = trimmed
            .split("url_path")
            .nth(1)
            .and_then(first_quoted_value)
            .or_else(|| first_quoted_value(trimmed));
        return Some(ApiRouteAnnotation {
            method: parse_api_methods_from_line(trimmed).first().cloned(),
            path,
            framework: "DRF".to_string(),
            confidence: "medium".to_string(),
            parser_source: "fallback-pattern".to_string(),
        });
    }
    None
}

fn extract_python_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    let mut candidates = Vec::new();
    let mut pending_annotations = Vec::<ApiRouteAnnotation>::new();
    for (line_index, line) in content.lines().enumerate() {
        let line_number = line_index + 1;
        let trimmed = line.trim();
        if let Some(annotation) = python_route_annotation(line) {
            pending_annotations.push(annotation);
            continue;
        }
        if !pending_annotations.is_empty() && trimmed.starts_with("def ") {
            let handler = trimmed
                .strip_prefix("def ")
                .and_then(|tail| tail.split_once('(').map(|(name, _)| name.trim().to_string()));
            for annotation in pending_annotations.drain(..) {
                push_api_route_candidate(
                    &mut candidates,
                    file,
                    annotation,
                    line_number,
                    line,
                    handler.clone(),
                    Some(file_stem_label(&file.path)),
                );
            }
            continue;
        }
        if trimmed.starts_with("path(") || trimmed.contains(" path(") || trimmed.starts_with("re_path(") {
            push_api_route_candidate(
                &mut candidates,
                file,
                ApiRouteAnnotation {
                    method: None,
                    path: first_quoted_value(trimmed),
                    framework: "Django".to_string(),
                    confidence: "medium".to_string(),
                    parser_source: "fallback-pattern".to_string(),
                },
                line_number,
                line,
                handler_after_first_comma(line),
                Some(file_stem_label(&file.path)),
            );
        }
    }
    candidates
}

fn extract_line_call_api_candidates(
    file: &ScannedFile,
    content: &str,
    framework: &str,
    methods: &[(&str, &str)],
) -> Vec<ApiRouteCandidate> {
    let mut candidates = Vec::new();
    for (line_index, line) in content.lines().enumerate() {
        let lower = line.to_ascii_lowercase();
        for &(needle, method) in methods {
            if !lower.contains(needle) {
                continue;
            }
            let quoted_path = first_quoted_value(line);
            let route_like_path = quoted_path
                .as_deref()
                .map(|path| path.starts_with('/') || path.starts_with(':') || path.contains('{'))
                .unwrap_or(false);
            let route_like_context = lower.contains("router")
                || lower.contains("route")
                || lower.contains("app.")
                || lower.contains("server")
                || lower.contains("http")
                || lower.trim_start().starts_with('@')
                || lower.trim_start().starts_with('[')
                || lower.contains("mapget")
                || lower.contains("mappost")
                || lower.contains("mapput")
                || lower.contains("mapdelete")
                || lower.contains("mappatch")
                || lower.contains("crow_route")
                || lower.contains("mg_http_match_uri");
            if !route_like_path && !route_like_context {
                continue;
            }
            push_api_route_candidate(
                &mut candidates,
                file,
                ApiRouteAnnotation {
                    method: Some((*method).to_string()),
                    path: quoted_path,
                    framework: framework.to_string(),
                    confidence: "medium".to_string(),
                    parser_source: "fallback-pattern".to_string(),
                },
                line_index + 1,
                line,
                handler_after_first_comma(line),
                Some(file_stem_label(&file.path)),
            );
        }
    }
    candidates
}

fn extract_go_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    let mut candidates = extract_line_call_api_candidates(
        file,
        content,
        "Go router",
        &[
            (".get(", "GET"),
            (".post(", "POST"),
            (".put(", "PUT"),
            (".delete(", "DELETE"),
            (".patch(", "PATCH"),
            (".handlefunc(", ""),
            (".handle(", ""),
            (".methodfunc(", ""),
        ],
    );
    for candidate in &mut candidates {
        if candidate.method.as_deref() == Some("") {
            candidate.method = None;
            candidate.framework = Some("net/http".to_string());
        }
    }
    for (line_index, line) in content.lines().enumerate() {
        let trimmed = line.trim();
        if !(trimmed.contains("Register") && trimmed.contains("Server(")) {
            continue;
        }
        push_api_route_candidate(
            &mut candidates,
            file,
            ApiRouteAnnotation {
                method: None,
                path: None,
                framework: "gRPC".to_string(),
                confidence: "medium".to_string(),
                parser_source: "fallback-pattern".to_string(),
            },
            line_index + 1,
            line,
            handler_after_first_comma(line),
            Some(file_stem_label(&file.path)),
        );
    }
    candidates
}

fn extract_typescript_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    let mut candidates = extract_line_call_api_candidates(
        file,
        content,
        "Node router",
        &[
            (".get(", "GET"),
            (".post(", "POST"),
            (".put(", "PUT"),
            (".delete(", "DELETE"),
            (".patch(", "PATCH"),
            ("@get(", "GET"),
            ("@post(", "POST"),
            ("@put(", "PUT"),
            ("@delete(", "DELETE"),
            ("@patch(", "PATCH"),
        ],
    );
    for candidate in &mut candidates {
        if candidate.excerpt.trim_start().starts_with('@') {
            candidate.framework = Some("NestJS".to_string());
        }
    }
    let normalized_path = file.path.replace('\\', "/");
    if normalized_path.contains("/pages/api/") || normalized_path.contains("/app/api/") {
        let api_path = normalized_path
            .split("/pages/api/")
            .nth(1)
            .or_else(|| normalized_path.split("/app/api/").nth(1))
            .map(|tail| {
                let without_extension = tail.rsplit_once('.').map(|(stem, _)| stem).unwrap_or(tail);
                format!("/api/{}", without_extension.replace("/route", "").replace("[", ":").replace("]", ""))
            });
        if let Some(path) = api_path {
            push_api_route_candidate(
                &mut candidates,
                file,
                ApiRouteAnnotation {
                    method: None,
                    path: Some(path),
                    framework: "Next API routes".to_string(),
                    confidence: "medium".to_string(),
                    parser_source: "fallback-pattern".to_string(),
                },
                1,
                "Next API route file path",
                Some(file_stem_label(&file.path)),
                Some("Next API routes".to_string()),
            );
        }
    }
    candidates
}

fn extract_csharp_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    let mut candidates = extract_line_call_api_candidates(
        file,
        content,
        "ASP.NET Core",
        &[
            ("mapget(", "GET"),
            ("mappost(", "POST"),
            ("mapput(", "PUT"),
            ("mapdelete(", "DELETE"),
            ("mappatch(", "PATCH"),
            ("mapmethods(", ""),
            ("[route(", ""),
            ("[httpget", "GET"),
            ("[httppost", "POST"),
            ("[httpput", "PUT"),
            ("[httpdelete", "DELETE"),
            ("[httppatch", "PATCH"),
        ],
    );
    for candidate in &mut candidates {
        if candidate.path.is_none() && candidate.excerpt.contains('(') {
            candidate.path = Some("/".to_string());
        }
    }
    candidates
}

fn extract_rust_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    extract_line_call_api_candidates(
        file,
        content,
        "Rust web",
        &[
            (".route(", ""),
            ("web::resource(", ""),
            ("warp::path(", ""),
            ("#[get(", "GET"),
            ("#[post(", "POST"),
            ("#[put(", "PUT"),
            ("#[delete(", "DELETE"),
            ("#[patch(", "PATCH"),
        ],
    )
    .into_iter()
    .map(|mut candidate| {
        if candidate.method.as_deref() == Some("") {
            candidate.method = parse_api_methods_from_line(&candidate.excerpt).first().cloned();
            candidate.framework = Some("Axum/Rocket".to_string());
        }
        candidate
    })
    .collect()
}

fn extract_c_family_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    let framework = if file.language == "c" { "C HTTP handler" } else { "C++ HTTP framework" };
    let mut candidates = extract_line_call_api_candidates(
        file,
        content,
        framework,
        &[
            ("crow_route(", ""),
            ("drogon::app().registerhandler(", ""),
            ("registerhandler(", ""),
            ("addhandler(", ""),
            ("add_route(", ""),
            ("routes::get(", "GET"),
            ("routes::post(", "POST"),
            ("http_endpoint(", ""),
            ("microhttpd", ""),
            (".get(", "GET"),
            (".post(", "POST"),
            (".put(", "PUT"),
            (".delete(", "DELETE"),
            ("mg_http_match_uri(", ""),
            ("mg_set_request_handler(", ""),
            ("mg_http_reply(", ""),
        ],
    );
    for candidate in &mut candidates {
        if candidate.method.as_deref() == Some("") {
            candidate.method = None;
            candidate.confidence = "low".to_string();
        }
    }
    candidates
}

fn extract_project_api_candidates(file: &ScannedFile, content: &str) -> Vec<ApiRouteCandidate> {
    api_adapter_descriptor_for_language(&file.language)
        .map(|descriptor| (descriptor.extractor)(file, content))
        .unwrap_or_default()
}

fn api_path_parameters(path: Option<&str>, candidate: &ApiRouteCandidate, generated_at: &str) -> Vec<ApiParameter> {
    let Some(path) = path else {
        return Vec::new();
    };
    let mut parameters = Vec::new();
    let mut seen = BTreeSet::new();
    for segment in path.split('/') {
        let name = if segment.starts_with('{') && segment.ends_with('}') {
            segment.trim_start_matches('{').trim_end_matches('}').to_string()
        } else if let Some(name) = segment.strip_prefix(':') {
            name.to_string()
        } else if segment.starts_with('<') && segment.ends_with('>') {
            segment.trim_start_matches('<').trim_end_matches('>').to_string()
        } else {
            continue;
        };
        if name.is_empty() || !seen.insert(name.clone()) {
            continue;
        }
        parameters.push(ApiParameter {
            name,
            location: "path".to_string(),
            required: true,
            schema: None,
            default_value: None,
            example: None,
            evidence: vec![api_evidence(candidate, generated_at)],
        });
    }
    parameters
}

fn api_evidence(candidate: &ApiRouteCandidate, generated_at: &str) -> ApiEvidence {
    api_evidence_payload(
        &candidate.source_file,
        candidate.line,
        &candidate.excerpt,
        &candidate.parser_source,
        generated_at,
    )
}

fn api_schema_ref_json(type_name: &str, candidate: &ApiRouteCandidate, generated_at: &str) -> Option<ApiSchemaRef> {
    let normalized = type_name
        .trim()
        .trim_start_matches("final ")
        .trim_start_matches("const ")
        .trim()
        .trim_end_matches("...")
        .trim();
    if normalized.is_empty() || matches!(normalized, "void" | "Void" | "Unit") {
        return None;
    }
    Some(ApiSchemaRef {
        id: format!("api-schema-{}", stable_hash(&format!("{}|{}", candidate.source_file, normalized))),
        name: normalized.to_string(),
        language: candidate.language.clone(),
        source_file: candidate.source_file.clone(),
        evidence: vec![api_evidence(candidate, generated_at)],
    })
}

fn api_signature_parameter_text(signature: &str) -> Option<String> {
    let start = signature.find('(')?;
    let end = signature.rfind(')')?;
    if end <= start {
        return None;
    }
    Some(signature[start + 1..end].to_string())
}

fn split_api_signature_parameters(value: &str) -> Vec<String> {
    let mut parameters = Vec::new();
    let mut current = String::new();
    let mut angle_depth = 0usize;
    let mut paren_depth = 0usize;
    for character in value.chars() {
        match character {
            '<' => {
                angle_depth += 1;
                current.push(character);
            }
            '>' => {
                angle_depth = angle_depth.saturating_sub(1);
                current.push(character);
            }
            '(' => {
                paren_depth += 1;
                current.push(character);
            }
            ')' => {
                paren_depth = paren_depth.saturating_sub(1);
                current.push(character);
            }
            ',' if angle_depth == 0 && paren_depth == 0 => {
                let trimmed = current.trim();
                if !trimmed.is_empty() {
                    parameters.push(trimmed.to_string());
                }
                current.clear();
            }
            _ => current.push(character),
        }
    }
    let trimmed = current.trim();
    if !trimmed.is_empty() {
        parameters.push(trimmed.to_string());
    }
    parameters
}

fn api_parameter_location_from_signature(parameter: &str) -> Option<&'static str> {
    if parameter.contains("@PathVariable") {
        Some("path")
    } else if parameter.contains("@RequestParam") {
        Some("query")
    } else if parameter.contains("@RequestHeader") {
        Some("header")
    } else if parameter.contains("@CookieValue") {
        Some("cookie")
    } else {
        None
    }
}

fn strip_java_annotations(value: &str) -> String {
    let mut output = String::new();
    let mut chars = value.chars().peekable();
    while let Some(character) = chars.next() {
        if character != '@' {
            output.push(character);
            continue;
        }
        while let Some(next) = chars.peek().copied() {
            if next.is_whitespace() || next == '(' {
                break;
            }
            chars.next();
        }
        if chars.peek() == Some(&'(') {
            let mut depth = 0usize;
            for next in chars.by_ref() {
                if next == '(' {
                    depth += 1;
                } else if next == ')' {
                    depth = depth.saturating_sub(1);
                    if depth == 0 {
                        break;
                    }
                }
            }
        }
        output.push(' ');
    }
    output
}

fn api_parameter_name_and_type(parameter: &str) -> Option<(String, String)> {
    let explicit_name = first_quoted_value(parameter);
    let cleaned = strip_java_annotations(parameter)
        .replace("final ", " ")
        .replace("const ", " ")
        .replace("...", " ");
    let tokens = cleaned
        .split_whitespace()
        .filter(|token| !matches!(*token, "public" | "private" | "protected" | "static" | "final"))
        .collect::<Vec<_>>();
    let fallback_name = tokens.last()?.trim_matches(|character: char| {
        !character.is_alphanumeric() && character != '_'
    });
    let name = explicit_name.unwrap_or_else(|| fallback_name.to_string());
    if name.is_empty() {
        return None;
    }
    let type_name = tokens
        .iter()
        .rev()
        .skip(1)
        .next()
        .copied()
        .unwrap_or("unknown")
        .trim()
        .to_string();
    Some((name, type_name))
}

fn api_signature_parameters(candidate: &ApiRouteCandidate, generated_at: &str) -> Vec<ApiParameter> {
    let Some(parameters_text) = api_signature_parameter_text(&candidate.excerpt) else {
        return Vec::new();
    };
    split_api_signature_parameters(&parameters_text)
        .into_iter()
        .flat_map(|parameter| {
            let Some(location) = api_parameter_location_from_signature(&parameter) else {
                return Vec::new();
            };
            let Some((name, type_name)) = api_parameter_name_and_type(&parameter) else {
                return Vec::new();
            };
            vec![ApiParameter {
                name,
                location: location.to_string(),
                required: location == "path",
                schema: api_schema_ref_json(&type_name, candidate, generated_at),
                default_value: None,
                example: None,
                evidence: vec![api_evidence(candidate, generated_at)],
            }]
        })
        .collect()
}

fn api_request_body(candidate: &ApiRouteCandidate, generated_at: &str) -> Option<ApiRequestBody> {
    let parameters_text = api_signature_parameter_text(&candidate.excerpt)?;
    split_api_signature_parameters(&parameters_text)
        .into_iter()
        .find(|parameter| parameter.contains("@RequestBody"))
        .and_then(|parameter| api_parameter_name_and_type(&parameter))
        .map(|(_, type_name)| ApiRequestBody {
            content_type: Some("application/json".to_string()),
            required: true,
            schema: api_schema_ref_json(&type_name, candidate, generated_at),
            examples: Vec::new(),
            evidence: vec![api_evidence(candidate, generated_at)],
        })
}

fn api_signature_response(candidate: &ApiRouteCandidate, generated_at: &str) -> Vec<ApiResponse> {
    let Some(handler_symbol) = candidate.handler_symbol.as_deref() else {
        return Vec::new();
    };
    let Some(method_name) = handler_symbol.rsplit('.').next() else {
        return Vec::new();
    };
    let Some((prefix, _)) = candidate.excerpt.split_once(&format!("{method_name}(")) else {
        return Vec::new();
    };
    let return_type = prefix
        .split_whitespace()
        .rev()
        .find(|token| !matches!(*token, "public" | "private" | "protected" | "static" | "final" | "async"));
    let Some(return_type) = return_type else {
        return Vec::new();
    };
    if matches!(return_type, "void" | "Void") {
        return Vec::new();
    }
    vec![ApiResponse {
        status_code: Some("200".to_string()),
        content_type: Some("application/json".to_string()),
        schema: api_schema_ref_json(return_type, candidate, generated_at),
        examples: Vec::new(),
        is_error: false,
        evidence: vec![api_evidence(candidate, generated_at)],
    }]
}

fn api_endpoint_instance_identity(candidate: &ApiRouteCandidate) -> String {
    let fingerprint = format!(
        "source-candidate|{}|{}|{}|{}|{}|{}",
        candidate.protocol,
        candidate.method.as_deref().unwrap_or("*").to_ascii_uppercase(),
        candidate.path.as_deref().unwrap_or("").to_ascii_lowercase(),
        candidate.source_file.to_ascii_lowercase(),
        candidate.line,
        candidate.handler_symbol.as_deref().unwrap_or("")
    );
    fingerprint
}

fn normalized_api_identity_path(path: Option<&str>) -> Option<String> {
    let path = normalize_api_path(path.map(str::to_string))?;
    let mut normalized_segments = Vec::new();
    for segment in path.split('/') {
        if segment.is_empty() {
            continue;
        }
        let normalized = if segment.starts_with('{') && segment.ends_with('}') {
            "{}".to_string()
        } else if segment.starts_with(':') || segment.starts_with('<') && segment.ends_with('>') {
            "{}".to_string()
        } else {
            segment.to_ascii_lowercase()
        };
        normalized_segments.push(normalized);
    }
    if normalized_segments.is_empty() {
        Some("/".to_string())
    } else {
        Some(format!("/{}", normalized_segments.join("/")))
    }
}

fn api_endpoint_identity_kind(candidate: &ApiRouteCandidate) -> String {
    match candidate.protocol.as_str() {
        "http" => "http",
        "grpc" => "grpc",
        "graphql" => "graphql",
        "c-abi" => "c-abi",
        "rpc" => "generic-rpc",
        _ => "source-candidate",
    }
    .to_string()
}

fn canonical_api_endpoint_identity(candidate: &ApiRouteCandidate) -> Option<String> {
    match candidate.protocol.as_str() {
        "http" => {
            let path = normalized_api_identity_path(candidate.path.as_deref())?;
            Some(format!(
                "http|{}|{}",
                candidate.method.as_deref().unwrap_or("*").to_ascii_uppercase(),
                path
            ))
        }
        "grpc" => candidate.operation_name.as_ref().or(candidate.handler_symbol.as_ref()).map(|operation| {
            format!(
                "grpc|{}|{}|{}",
                candidate.module_label.to_ascii_lowercase(),
                candidate.controller_label.to_ascii_lowercase(),
                operation
            )
        }),
        "graphql" => candidate.operation_name.as_ref().map(|operation| {
            format!(
                "graphql|{}|{}",
                candidate.method.as_deref().unwrap_or("operation").to_ascii_lowercase(),
                operation
            )
        }),
        "c-abi" | "rpc" => candidate.handler_symbol.as_ref().map(|symbol| {
            format!(
                "{}|{}|{}",
                api_endpoint_identity_kind(candidate),
                symbol,
                candidate.source_file.to_ascii_lowercase()
            )
        }),
        _ => None,
    }
}

fn api_endpoint_merge_identity(candidate: &ApiRouteCandidate) -> String {
    canonical_api_endpoint_identity(candidate)
        .unwrap_or_else(|| api_endpoint_instance_identity(candidate))
}

fn api_endpoint_id_from_identity(identity: &str) -> String {
    format!("api-endpoint-{}", stable_hash(identity))
}

fn api_confidence_rank(value: &str) -> u8 {
    match value {
        "spec" => 4,
        "high" => 3,
        "medium" => 2,
        "low" => 1,
        _ => 0,
    }
}

fn api_parser_source_rank(value: &str) -> u8 {
    match value {
        "schema-parser" | "descriptor" => 4,
        "compiler-api" => 3,
        "syntax-tree-parser" => 2,
        "fallback-pattern" => 1,
        _ => 0,
    }
}

fn api_candidate_priority(candidate: &ApiRouteCandidate) -> (u8, u8) {
    (
        api_confidence_rank(&candidate.confidence),
        api_parser_source_rank(&candidate.parser_source),
    )
}

fn api_call_chain_edge_kind(line: &str) -> Option<String> {
    let lower = line.to_ascii_lowercase();
    if lower.contains("repository") || lower.contains(".repo") || lower.contains("dao.") {
        Some("repository".to_string())
    } else if lower.contains("model") || lower.contains("entity") {
        Some("model".to_string())
    } else if lower.contains("fetch(")
        || lower.contains("axios.")
        || lower.contains("http.")
        || lower.contains("request(")
        || lower.contains("resttemplate")
    {
        Some("outbound-http".to_string())
    } else if lower.contains("grpc") || lower.contains("rpc") || lower.contains("stub.") {
        Some("rpc".to_string())
    } else if lower.contains("service") || lower.contains("usecase") || lower.contains("manager") {
        Some("service".to_string())
    } else {
        None
    }
}

fn api_call_chain_target_symbol(line: &str) -> Option<String> {
    let before_parenthesis = line.split_once('(')?.0.trim();
    let token = before_parenthesis
        .split(|character: char| character.is_whitespace() || character == '=' || character == ':' || character == ',')
        .last()?
        .trim_matches(|character: char| {
            !character.is_alphanumeric() && !matches!(character, '_' | '.' | ':' | '-')
        });
    if token.is_empty() || matches!(token, "if" | "for" | "while" | "switch" | "return") {
        None
    } else {
        Some(token.to_string())
    }
}

fn extract_api_call_chain(
    endpoint_id: &str,
    candidate: &ApiRouteCandidate,
    content: &str,
    generated_at: &str,
) -> Option<ApiCallChain> {
    let source_symbol = candidate
        .handler_symbol
        .clone()
        .or_else(|| candidate.operation_name.clone())?;
    let mut edges = Vec::new();
    let start_index = candidate.line.saturating_sub(1);
    for (offset, line) in content.lines().skip(start_index).take(80).enumerate() {
        let Some(kind) = api_call_chain_edge_kind(line) else {
            continue;
        };
        let Some(target_symbol) = api_call_chain_target_symbol(line) else {
            continue;
        };
        if target_symbol == source_symbol {
            continue;
        }
        let line_number = candidate.line + offset;
        let excerpt = api_trimmed_excerpt(line);
        edges.push(ApiCallChainEdge {
            id: format!(
                "api-chain-edge-{}",
                stable_hash(&format!("{}|{}|{}|{}", endpoint_id, source_symbol, target_symbol, line_number))
            ),
            source_symbol: source_symbol.clone(),
            target_symbol,
            source_file: candidate.source_file.clone(),
            line: Some(line_number),
            excerpt: Some(excerpt.clone()),
            direction: "forward".to_string(),
            kind,
            confidence: "low".to_string(),
            evidence: vec![api_evidence_payload(
                &candidate.source_file,
                line_number,
                &excerpt,
                &candidate.parser_source,
                generated_at,
            )],
        });
        if edges.len() >= 10 {
            break;
        }
    }
    if edges.is_empty() {
        return None;
    }
    Some(ApiCallChain {
        id: format!("api-chain-{}", stable_hash(endpoint_id)),
        endpoint_id: endpoint_id.to_string(),
        edges,
        max_depth: 1,
        truncated_reason: Some("max-depth-1-conservative-scan".to_string()),
    })
}

fn api_group_id(level: &str, label: &str, parent_id: Option<&str>) -> String {
    format!(
        "api-group-{}",
        stable_hash(&format!(
            "{}|{}|{}",
            level,
            label.to_ascii_lowercase(),
            parent_id.unwrap_or("")
        ))
    )
}

fn increment_api_group_counts(group: &mut ApiGroupBuild, candidate: &ApiRouteCandidate) {
    *group.protocol_counts.entry(candidate.protocol.clone()).or_insert(0) += 1;
    *group.language_counts.entry(candidate.language.clone()).or_insert(0) += 1;
    *group.confidence_counts.entry(candidate.confidence.clone()).or_insert(0) += 1;
}

pub(crate) fn build_api_contract_artifact(
    file_contents: &[(ScannedFile, String)],
    storage_key: &str,
    scan_run_id: &str,
    generated_at: &str,
    ignored_paths: &[Value],
) -> Value {
    let workspace_fingerprint = api_workspace_fingerprint(file_contents);
    let file_content_index = file_contents
        .iter()
        .map(|(file, content)| (file.path.clone(), content.as_str()))
        .collect::<BTreeMap<_, _>>();
    let mut skipped_by_reason = BTreeMap::<String, usize>::new();
    for item in ignored_paths {
        increment_skipped_reason(&mut skipped_by_reason, canonical_api_scope_skip_reason(item));
    }

    let descriptors = declared_api_adapter_descriptors();
    let mut adapter_coverage = descriptors
        .iter()
        .map(|descriptor| (descriptor.language.to_string(), ApiAdapterCoverageBuild::default()))
        .collect::<BTreeMap<_, _>>();
    adapter_coverage
        .entry("openapi".to_string())
        .or_insert_with(ApiAdapterCoverageBuild::default);
    adapter_coverage
        .entry("protobuf".to_string())
        .or_insert_with(ApiAdapterCoverageBuild::default);
    adapter_coverage
        .entry("graphql".to_string())
        .or_insert_with(ApiAdapterCoverageBuild::default);
    let mut adapter_descriptor_index = descriptors
        .iter()
        .map(|descriptor| (descriptor.language.to_string(), *descriptor))
        .collect::<BTreeMap<_, _>>();
    let mut candidates = Vec::<ApiRouteCandidate>::new();
    for (file, content) in file_contents {
        if let Some(reason) = api_scan_scope_skip_reason(file) {
            increment_skipped_reason(&mut skipped_by_reason, reason);
            continue;
        }

        if is_openapi_contract_file(file) {
            let coverage = adapter_coverage.entry("openapi".to_string()).or_default();
            coverage.file_count += 1;
            match extract_openapi_contract_candidates(file, content, generated_at) {
                Ok(file_candidates) => {
                    coverage.endpoint_count += file_candidates.len();
                    if file_candidates.is_empty() {
                        coverage.no_candidate_count += 1;
                        increment_skipped_reason(&mut skipped_by_reason, "adapter-no-candidate:openapi");
                    }
                    candidates.extend(file_candidates);
                }
                Err(_) => {
                    coverage.unsupported_count += 1;
                    increment_skipped_reason(&mut skipped_by_reason, "adapter-unsupported:openapi");
                }
            }
            continue;
        }

        if is_proto_contract_file(file) {
            let coverage = adapter_coverage.entry("protobuf".to_string()).or_default();
            coverage.file_count += 1;
            let file_candidates = extract_proto_contract_candidates(file, content, generated_at);
            coverage.endpoint_count += file_candidates.len();
            if file_candidates.is_empty() {
                coverage.no_candidate_count += 1;
                increment_skipped_reason(&mut skipped_by_reason, "adapter-no-candidate:protobuf");
            }
            candidates.extend(file_candidates);
            continue;
        }

        if is_graphql_contract_file(file) {
            let coverage = adapter_coverage.entry("graphql".to_string()).or_default();
            coverage.file_count += 1;
            let file_candidates = extract_graphql_contract_candidates(file, content, generated_at);
            coverage.endpoint_count += file_candidates.len();
            if file_candidates.is_empty() {
                coverage.no_candidate_count += 1;
                increment_skipped_reason(&mut skipped_by_reason, "adapter-no-candidate:graphql");
            }
            candidates.extend(file_candidates);
            continue;
        }

        let Some(descriptor) = api_adapter_descriptor_for_language(&file.language) else {
            if matches!(
                file.extension.as_str(),
                "proto" | "graphql" | "gql" | "yaml" | "yml" | "json"
            ) {
                increment_skipped_reason(&mut skipped_by_reason, "unsupported-strong-contract-adapter");
            }
            continue;
        };
        adapter_descriptor_index
            .entry(descriptor.language.to_string())
            .or_insert(descriptor);
        let file_candidates = extract_project_api_candidates(file, content);
        let coverage = adapter_coverage
            .entry(descriptor.language.to_string())
            .or_default();
        coverage.file_count += 1;
        coverage.endpoint_count += file_candidates.len();
        if file_candidates.is_empty() {
            coverage.no_candidate_count += 1;
            increment_skipped_reason(
                &mut skipped_by_reason,
                format!("adapter-no-candidate:{}", descriptor.language),
            );
        }
        candidates.extend(file_candidates);
    }
    candidates.sort_by(|left, right| {
        left.source_file
            .cmp(&right.source_file)
            .then(left.line.cmp(&right.line))
            .then(left.path.cmp(&right.path))
    });

    let mut candidate_groups = BTreeMap::<String, Vec<ApiRouteCandidate>>::new();
    for candidate in candidates {
        candidate_groups
            .entry(api_endpoint_merge_identity(&candidate))
            .or_default()
            .push(candidate);
    }

    let mut endpoints = Vec::<ApiEndpoint>::new();
    let mut groups = BTreeMap::<String, ApiGroupBuild>::new();
    let mut schemas = BTreeMap::<String, ApiSchemaRef>::new();
    let mut call_chains = Vec::<ApiCallChain>::new();

    for (merge_identity, candidate_group) in candidate_groups {
        if candidate_group.is_empty() {
            continue;
        }
        let mut primary_index = 0usize;
        for index in 1..candidate_group.len() {
            if api_candidate_priority(&candidate_group[index])
                > api_candidate_priority(&candidate_group[primary_index])
            {
                primary_index = index;
            }
        }
        let candidate = &candidate_group[primary_index];
        let canonical_identity = canonical_api_endpoint_identity(candidate);
        let endpoint_id = api_endpoint_id_from_identity(&merge_identity);
        let group_layers = [
            ("protocol", candidate.protocol.to_ascii_uppercase()),
            ("module", candidate.module_label.clone()),
            ("controller", candidate.controller_label.clone()),
        ];
        let mut parent_id: Option<String> = None;
        let mut group_ids = Vec::new();
        for (level, label) in group_layers {
            let group_id = api_group_id(level, &label, parent_id.as_deref());
            {
                let group = groups.entry(group_id.clone()).or_insert_with(|| ApiGroupBuild {
                    id: group_id.clone(),
                    label: label.clone(),
                    level: level.to_string(),
                    parent_id: parent_id.clone(),
                    ..ApiGroupBuild::default()
                });
                group.endpoint_ids.insert(endpoint_id.clone());
                increment_api_group_counts(group, &candidate);
            }
            if let Some(parent) = parent_id.as_ref().and_then(|id| groups.get_mut(id)) {
                parent.child_group_ids.insert(group_id.clone());
            }
            parent_id = Some(group_id.clone());
            group_ids.push(group_id);
        }
        let mut fallback_parameters = api_path_parameters(candidate.path.as_deref(), &candidate, generated_at);
        fallback_parameters.extend(api_signature_parameters(&candidate, generated_at));
        let parameters = if candidate.parameter_overrides.is_empty() {
            fallback_parameters
        } else {
            candidate.parameter_overrides.clone()
        };
        let request_body = candidate
            .request_body_override
            .clone()
            .or_else(|| api_request_body(&candidate, generated_at));
        let responses = if candidate.response_overrides.is_empty() {
            api_signature_response(&candidate, generated_at)
        } else {
            candidate.response_overrides.clone()
        };
        for parameter in &parameters {
            if let Some(schema) = parameter.schema.clone() {
                schemas.entry(schema.id.clone()).or_insert(schema);
            }
        }
        if let Some(schema) = request_body.as_ref().and_then(|body| body.schema.clone()) {
            schemas.entry(schema.id.clone()).or_insert(schema);
        }
        for response in &responses {
            if let Some(schema) = response.schema.clone() {
                schemas.entry(schema.id.clone()).or_insert(schema);
            }
        }
        let request_schema = candidate
            .request_schema_override
            .clone()
            .or_else(|| request_body.as_ref().and_then(|body| body.schema.clone()));
        let response_schema = candidate
            .response_schema_override
            .clone()
            .or_else(|| responses.iter().find_map(|response| response.schema.clone()));
        let evidence = candidate_group
            .iter()
            .map(|candidate| api_evidence(candidate, generated_at))
            .collect::<Vec<_>>();
        let call_chain = file_content_index
            .get(&candidate.source_file)
            .and_then(|content| extract_api_call_chain(&endpoint_id, candidate, content, generated_at));
        let call_chain_ids = call_chain
            .as_ref()
            .map(|chain| vec![chain.id.clone()])
            .unwrap_or_default();
        let call_chain_unavailable_reason = if call_chain_ids.is_empty() {
            Some("method-chain-evidence-unavailable".to_string())
        } else {
            None
        };
        if let Some(chain) = call_chain {
            call_chains.push(chain);
        }
        endpoints.push(ApiEndpoint {
            id: endpoint_id,
            protocol: candidate.protocol.clone(),
            language: candidate.language.clone(),
            framework: candidate.framework.clone(),
            method: candidate.method.clone(),
            path: candidate.path.clone(),
            operation_name: candidate.operation_name.clone(),
            handler_symbol: candidate.handler_symbol.clone(),
            source_file: candidate.source_file.clone(),
            parameters,
            request_body,
            responses,
            request_schema,
            response_schema,
            description: candidate.description.clone(),
            usage_scenario: candidate.usage_scenario.clone(),
            group_ids,
            call_chain_ids,
            call_chain_unavailable_reason,
            confidence: candidate.confidence.clone(),
            evidence,
            canonical_identity,
            identity_kind: api_endpoint_identity_kind(candidate),
            ambiguous_identity: canonical_api_endpoint_identity(candidate).is_none(),
        });
    }

    let groups = groups
        .into_values()
        .map(|group| ApiGroup {
            id: group.id,
            label: group.label,
            level: group.level,
            parent_id: group.parent_id,
            endpoint_ids: group.endpoint_ids.into_iter().collect::<Vec<_>>(),
            child_group_ids: group.child_group_ids.into_iter().collect::<Vec<_>>(),
            protocol_counts: group.protocol_counts,
            language_counts: group.language_counts,
            confidence_counts: group.confidence_counts,
        })
        .collect::<Vec<_>>();

    let adapters = adapter_coverage
        .into_iter()
        .map(|(language, coverage)| {
            let descriptor = adapter_descriptor_index.get(&language);
            let is_openapi_adapter = language == "openapi";
            let is_protobuf_adapter = language == "protobuf";
            let is_graphql_adapter = language == "graphql";
            let status = if coverage.file_count == 0 {
                "not-present"
            } else if coverage.unsupported_count > 0 && coverage.endpoint_count == 0 {
                "unsupported"
            } else if coverage.endpoint_count == 0 {
                "no-candidate"
            } else {
                "active"
            };
            ApiAdapterCoverage {
                language,
                parser_source: descriptor
                    .map(|value| value.parser_source.to_string())
                    .or_else(|| {
                        if is_openapi_adapter {
                            Some("schema-parser".to_string())
                        } else if is_protobuf_adapter {
                            Some("descriptor".to_string())
                        } else if is_graphql_adapter {
                            Some("schema-parser".to_string())
                        } else {
                            None
                        }
                    })
                    .unwrap_or_else(|| "fallback-pattern".to_string()),
                frameworks: descriptor
                    .map(|value| value.frameworks.iter().map(|framework| (*framework).to_string()).collect())
                    .or_else(|| {
                        if is_openapi_adapter {
                            Some(vec!["OpenAPI".to_string(), "Swagger".to_string()])
                        } else if is_protobuf_adapter {
                            Some(vec!["protobuf".to_string(), "gRPC".to_string()])
                        } else if is_graphql_adapter {
                            Some(vec!["GraphQL schema".to_string()])
                        } else {
                            None
                        }
                    })
                    .unwrap_or_else(Vec::new),
                status: status.to_string(),
                file_count: coverage.file_count,
                endpoint_count: coverage.endpoint_count,
                no_candidate_count: coverage.no_candidate_count,
                unsupported_count: coverage.unsupported_count,
            }
        })
        .collect::<Vec<_>>();

    let graph = ApiContractGraph {
        schema_version: 1,
        generated_at: generated_at.to_string(),
        storage_key: storage_key.to_string(),
        scan_run_id: scan_run_id.to_string(),
        workspace_fingerprint: workspace_fingerprint.clone(),
        endpoints,
        groups,
        schemas: schemas.into_values().collect(),
        call_chains,
        adapters,
        stale: json!({
            "isFresh": true,
            "workspaceFingerprint": workspace_fingerprint,
            "reasons": [],
            "repairSuggestion": Value::Null
        }),
        repair: json!({
            "issues": [],
            "quarantinedArtifacts": [],
            "source": "project-map-api-contract-scan"
        }),
        skipped: skipped_by_reason
            .into_iter()
            .map(|(reason, count)| ApiSkippedSummary { reason, count })
            .collect(),
    };

    serde_json::to_value(graph).unwrap_or_else(|error| {
        json!({
            "schemaVersion": 1,
            "generatedAt": generated_at,
            "storageKey": storage_key,
            "scanRunId": scan_run_id,
            "workspaceFingerprint": "",
            "endpoints": [],
            "groups": [],
            "schemas": [],
            "callChains": [],
            "adapters": [],
            "stale": {
                "isFresh": false,
                "workspaceFingerprint": "",
                "reasons": [{ "message": "failed to serialize API contract graph" }]
            },
            "repair": {
                "issues": [{ "message": format!("failed to serialize API contract graph: {error}") }]
            },
            "skipped": [],
            "error": format!("failed to serialize API contract graph: {error}")
        })
    })
}

#[cfg(test)]
mod tests {
    use super::{build_api_contract_artifact, stable_hash};
    use crate::project_map_relations::ScannedFile;
    use serde_json::Value;

    fn scanned_file(path: &str, extension: &str, language: &str, content: &str) -> ScannedFile {
        ScannedFile {
            id: format!("file-{}", stable_hash(path)),
            path: path.to_string(),
            basename: path.rsplit('/').next().unwrap_or(path).to_string(),
            extension: extension.to_string(),
            language: language.to_string(),
            layer: "api".to_string(),
            role: "route".to_string(),
            size_bytes: content.len() as u64,
            line_count: content.lines().count(),
            content_hash: stable_hash(content),
            parse_status: "parsed".to_string(),
        }
    }

    #[test]
    fn strong_contract_adapters_emit_schema_backed_endpoints() {
        let openapi = r#"
openapi: 3.0.0
info:
  title: Fleet API
paths:
  /vehicles/{id}:
    get:
      operationId: getVehicle
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Vehicle'
"#;
        let proto = r#"
syntax = "proto3";
package fleet.v1;
service VehicleService {
  rpc GetVehicle (GetVehicleRequest) returns (VehicleReply);
}
"#;
        let graphql = r#"
type Query {
  vehicle(id: ID!): Vehicle
}
"#;
        let artifact = build_api_contract_artifact(
            &[
                (scanned_file("openapi.yaml", "yaml", "yaml", openapi), openapi.to_string()),
                (scanned_file("fleet.proto", "proto", "proto", proto), proto.to_string()),
                (scanned_file("schema.graphql", "graphql", "graphql", graphql), graphql.to_string()),
            ],
            "mossx-test",
            "scan-test",
            "2026-06-07T00:00:00Z",
            &[],
        );
        let endpoints = artifact.get("endpoints").and_then(Value::as_array).unwrap();
        assert!(endpoints.iter().any(|endpoint| {
            endpoint.get("protocol").and_then(Value::as_str) == Some("http")
                && endpoint.get("confidence").and_then(Value::as_str) == Some("spec")
        }));
        assert!(endpoints.iter().any(|endpoint| {
            endpoint.get("protocol").and_then(Value::as_str) == Some("grpc")
                && endpoint.get("confidence").and_then(Value::as_str) == Some("spec")
        }));
        assert!(endpoints.iter().any(|endpoint| {
            endpoint.get("protocol").and_then(Value::as_str) == Some("graphql")
                && endpoint.get("confidence").and_then(Value::as_str) == Some("spec")
        }));
        assert!(artifact.get("schemas").and_then(Value::as_array).unwrap().len() >= 3);
        let adapters = artifact.get("adapters").and_then(Value::as_array).unwrap();
        assert!(adapters.iter().any(|adapter| {
            adapter.get("language").and_then(Value::as_str) == Some("openapi")
                && adapter.get("status").and_then(Value::as_str) == Some("active")
        }));
        assert!(adapters.iter().any(|adapter| {
            adapter.get("language").and_then(Value::as_str) == Some("protobuf")
                && adapter.get("status").and_then(Value::as_str) == Some("active")
        }));
        assert!(adapters.iter().any(|adapter| {
            adapter.get("language").and_then(Value::as_str) == Some("graphql")
                && adapter.get("status").and_then(Value::as_str) == Some("active")
        }));
    }

    #[test]
    fn duplicate_http_contract_and_source_candidates_merge_evidence() {
        let openapi = r#"
openapi: 3.0.0
info:
  title: Users API
paths:
  /users:
    get:
      operationId: listUsers
      responses:
        '200':
          description: ok
"#;
        let source = r#"
import express from "express";
const app = express();
app.get("/users", listUsers);
function listUsers(req, res) {
  return userService.listUsers();
}
"#;
        let artifact = build_api_contract_artifact(
            &[
                (scanned_file("openapi.yaml", "yaml", "yaml", openapi), openapi.to_string()),
                (scanned_file("src/routes/users.ts", "ts", "typescript", source), source.to_string()),
            ],
            "mossx-test",
            "scan-test",
            "2026-06-07T00:00:00Z",
            &[],
        );
        let endpoints = artifact.get("endpoints").and_then(Value::as_array).unwrap();
        let users = endpoints
            .iter()
            .filter(|endpoint| {
                endpoint.get("protocol").and_then(Value::as_str) == Some("http")
                    && endpoint.get("method").and_then(Value::as_str) == Some("GET")
                    && endpoint.get("path").and_then(Value::as_str) == Some("/users")
            })
            .collect::<Vec<_>>();
        assert_eq!(users.len(), 1);
        assert!(users[0].get("evidence").and_then(Value::as_array).unwrap().len() >= 2);
        assert!(users[0].get("callChainIds").and_then(Value::as_array).unwrap().len() <= 1);
    }

    #[test]
    fn large_endpoint_fixture_preserves_group_first_artifact_shape() {
        let routes = (0..64)
            .map(|index| {
                format!(
                    "app.post(\"/orders/{index}\", orderController{index});\nfunction orderController{index}(req, res) {{\n  return orderService.createOrder{index}(req.body);\n}}\n"
                )
            })
            .collect::<String>();
        let artifact = build_api_contract_artifact(
            &[(scanned_file("src/routes/orders.ts", "ts", "typescript", &routes), routes)],
            "mossx-large",
            "scan-large",
            "2026-06-07T00:00:00Z",
            &[serde_json::json!({
                "path": "node_modules/express/index.js",
                "reason": "ignored by dependency directory"
            })],
        );
        let endpoints = artifact.get("endpoints").and_then(Value::as_array).unwrap();
        let groups = artifact.get("groups").and_then(Value::as_array).unwrap();
        let call_chains = artifact.get("callChains").and_then(Value::as_array).unwrap();
        assert!(endpoints.len() > 50);
        assert!(groups.iter().any(|group| {
            group.get("level").and_then(Value::as_str) == Some("protocol")
                && group
                    .get("endpointIds")
                    .and_then(Value::as_array)
                    .map(|ids| ids.len() > 50)
                    .unwrap_or(false)
        }));
        assert!(endpoints.iter().all(|endpoint| {
            endpoint
                .get("groupIds")
                .and_then(Value::as_array)
                .map(|ids| ids.len() >= 3)
                .unwrap_or(false)
        }));
        assert!(!call_chains.is_empty());
        assert!(artifact
            .get("skipped")
            .and_then(Value::as_array)
            .unwrap()
            .iter()
            .any(|item| item.get("reason").and_then(Value::as_str) == Some("dependency-directory")));
    }
}
