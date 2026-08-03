## MODIFIED Requirements

### Requirement: Grok CLI MUST Declare Reasoning Effort Support

The engine capability matrix MUST declare Grok CLI `reasoning.effort` as `supported` because Grok runtime command construction supports the user-facing `--reasoning-effort` / `--effort` option (TUI and headless).

#### Scenario: spec fixture marks Grok effort supported
- **WHEN** the capability matrix fixture is read from `openspec/specs/engine-capability-matrix/fixtures/matrix.json`
- **THEN** the `grok.reasoning.effort` cell MUST be `supported`
- **AND** this cell MUST NOT remain `unsupported` while Grok UI exposes a reasoning effort selector

#### Scenario: TypeScript capability projection agrees with Grok support
- **WHEN** TypeScript code resolves Grok capability state for `reasoning.effort`
- **THEN** the projected runtime status MUST be compatible with `supported`
- **AND** UI consumers MUST NOT receive a matrix/runtime disagreement that hides or disables Grok reasoning effort after an engine switch

#### Scenario: Rust capability projection agrees with Grok support
- **WHEN** Rust code resolves `EngineFeatures::grok()` or `capability_state(EngineType::Grok, "reasoning.effort")`
- **THEN** the result MUST report `supported`
- **AND** `npm run check:engine-capability-matrix` MUST fail if Rust, TypeScript, or the spec fixture disagree

#### Scenario: non-Grok unsupported engines remain unsupported
- **WHEN** the matrix is updated for Grok CLI reasoning effort
- **THEN** Gemini, Kimi, and OpenCode `reasoning.effort` cells MUST remain `unsupported`
- **AND** Claude and Codex `reasoning.effort` MUST keep their existing supported behavior
