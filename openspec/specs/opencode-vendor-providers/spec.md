# opencode-vendor-providers Specification

## Purpose

TBD - created by archiving change. Update Purpose for `opencode-vendor-providers`.

## Requirements

### Requirement: OpenCode Vendor Provider CRUD

The vendor settings panel SHALL provide an OpenCode tab to create, update, delete, and test provider profiles stored in the ccgui `config.json` `opencode` section, equivalent to the Kimi/Grok vendor surfaces.

#### Scenario: create a provider profile

- **WHEN** the user saves an OpenCode provider with name, base_url, api_key, and model list
- **THEN** the profile SHALL persist in ccgui config and appear in the provider list and sidebar provider menus

### Requirement: Provider Injection Via OPENCODE_CONFIG_CONTENT

When a turn runs under an OpenCode provider profile, backend SHALL inject the provider through the `OPENCODE_CONFIG_CONTENT` environment variable using an `@ai-sdk/openai-compatible` provider entry, and MUST NOT write the user's `~/.opencode` configuration files.

#### Scenario: send under a vendor profile

- **WHEN** the user sends a message with a vendor provider profile selected
- **THEN** the spawned CLI SHALL receive `OPENCODE_CONFIG_CONTENT` containing a managed provider entry (stable key `ccgui`) with the profile's baseURL, apiKey, and models
- **AND** the turn SHALL pass `--model ccgui/<model>` so the managed provider's credentials are used

#### Scenario: unsupported provider kind

- **WHEN** a profile targets a non openai-compatible upstream
- **THEN** the UI SHALL mark it unsupported rather than silently misconfiguring the CLI
