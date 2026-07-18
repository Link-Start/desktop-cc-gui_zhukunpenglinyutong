## ADDED Requirements

### Requirement: Fast Markdown Worker MUST Have A DOM-Free Module Boundary

Fast Markdown Worker code and every transitive module evaluated inside the Worker MUST NOT require `window`, `document`, mounted DOM, or React instances. The Worker build MUST resolve dependencies through a DOM-free Worker-safe entry when a package exposes different browser and Worker implementations. Sanitization that requires browser DOM MUST execute at an explicit main-thread boundary before HTML is trusted or mounted.

#### Scenario: production Worker compiles ordinary Markdown

- **WHEN** the production-bundled fast Markdown Worker compiles an ordinary Markdown document
- **THEN** it MUST return a serializable compile result without throwing a `window` or `document` ReferenceError
- **AND** `decode-named-character-reference` and `hast-util-from-html-isomorphic` MUST resolve to their DOM-free implementations in the Worker artifact
- **AND** the main thread MUST sanitize the sanitizer-ready HTML before mounting it.

#### Scenario: DOM-bound rich feature is requested

- **WHEN** a Markdown document requires a plugin that cannot run without browser DOM
- **THEN** the adapter MUST route only that compile through the existing main-thread rich fallback
- **AND** it MUST NOT shim a fake DOM inside the Worker
- **AND** the failure or fallback MUST remain local to file preview.

#### Scenario: stale Worker result completes

- **WHEN** a Worker compile result completes after a newer document identity became active
- **THEN** the stale result MUST be ignored before sanitization or mount
- **AND** it MUST NOT enter the trusted HTML cache or overwrite the newer preview.

#### Scenario: stale Worker request enters an error or fallback path

- **WHEN** a Worker request becomes stale before Worker creation fails, returns unavailable, rejects, or times out
- **THEN** the adapter MUST reject the stale request before invoking main-thread compile or sanitization
- **AND** the stale source MUST NOT consume main-thread work or enter the trusted HTML cache.

#### Scenario: Worker response identity does not match its request

- **WHEN** a Worker response has a different cache key, content hash, renderer profile, or inconsistent diagnostics identity
- **THEN** the adapter MUST reject it before main-thread finalization
- **AND** the mismatched artifact MUST NOT enter the trusted HTML cache.

#### Scenario: trusted render is already cached

- **WHEN** the main-thread trusted cache already contains the exact document/profile/options identity
- **THEN** the adapter MUST return that sanitized cache entry before posting another Worker request
- **AND** unsafe Worker artifacts MUST never be written directly into that cache.

#### Scenario: Worker request never settles

- **WHEN** a production precompute request does not resolve within its bounded timeout
- **THEN** the adapter owner MUST reject and remove that request from the pending registry
- **AND** it MUST emit rate-limited content-safe failure evidence before the caller enters its existing fallback
- **AND** a late Worker response MUST NOT revive or cache the timed-out artifact.
