//! DSH does not own provider profiles in mossx. Keys and catalog live in DSH.

pub(crate) const DSH_LOCAL_PROVIDER_PROFILE_ID: &str = "__dsh_host_catalog__";

pub(crate) fn resolve_dsh_provider_model_config(
    _provider_profile_id: &str,
) -> Result<Option<()>, String> {
    Ok(None)
}
