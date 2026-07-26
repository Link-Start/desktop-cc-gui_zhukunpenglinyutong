## REMOVED Requirements

### Requirement: OpenCode Non-Streaming UX Hint (MODIFIED)

**Reason**: OpenCode is soft-retired and no longer has a production conversation UI.

**Migration**: Remove the unreachable waiting panel/timer; historical readers do not render active processing UX.

### Requirement: OpenCode Terminal Completion Robustness (MODIFIED)

**Reason**: Production OpenCode execution is fail-closed under retirement policy.

**Migration**: Keep parser behavior only inside bounded compatibility tests until hard-delete.

### Requirement: OpenCode Dead Code Forward Compatibility (NEW)

**Reason**: Retaining speculative dead handlers conflicts with repository dead-code and retirement policy.

**Migration**: Preserve only handlers proven reachable by compatibility fixtures.

### Requirement: OpenCode Provider Status Stability (NEW)

**Reason**: Provider status cannot gate a retired, unreachable send surface.

**Migration**: Remove OpenCode provider UI projection from production root state.
