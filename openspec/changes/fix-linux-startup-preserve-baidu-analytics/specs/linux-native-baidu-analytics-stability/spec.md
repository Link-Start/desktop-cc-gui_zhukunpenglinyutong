## ADDED Requirements

### Requirement: Linux native analytics MUST bypass the unsafe WebKit network path without disabling PV/UV

Linux native Tauri production MUST keep Baidu Tongji enabled while preventing every known `hm.baidu.com` script/beacon request owned by this feature from entering `WebKitNetworkProcess`. The official `hm.js` MUST remain the payload authority; the renderer MUST NOT replace it with a locally maintained parameter implementation.

#### Scenario: Linux native production main window starts

- **WHEN** the production main renderer runs in Linux native Tauri rather than Web Service mode
- **THEN** it MUST initialize the existing `_hmt` queue and load the fixed official `hm.js` through native transport
- **AND** it MUST NOT append an external `hm.baidu.com` script element or create a WebKit-owned `hm.baidu.com` request
- **AND** the official script MUST still generate the initial pageview payload.

#### Scenario: official script emits a pageview beacon

- **WHEN** current `hm.js` assigns an `http(s)://hm.baidu.com/hm.gif` URL to an Image
- **THEN** the renderer MUST forward that exact candidate to the narrow native command
- **AND** non-matching Image URLs MUST retain native browser behavior
- **AND** the native command MUST send the beacon over HTTPS without WebKit NetworkProcess participation.

#### Scenario: analytics transport fails

- **WHEN** native DNS, TLS, timeout, HTTP, persistence or script evaluation fails
- **THEN** the failure MUST be redacted and diagnosable
- **AND** React bootstrap and renderer-ready progression MUST continue
- **AND** the system MUST NOT fall back to the known-crashing WebKit request.

### Requirement: Native analytics transport MUST preserve visitor identity and request facts

The native bridge MUST preserve the browser-script-generated identifiers and relevant HTTP request facts needed for PV/UV semantics. Anonymous identifiers MUST remain private and MUST NOT be printed in logs.

#### Scenario: official script generates a pageview

- **WHEN** the native bridge receives a pageview candidate
- **THEN** the query MUST contain the built-in site id and a non-empty official-script-generated `hca`
- **AND** the native request MUST use the bounded real WebView User-Agent plus the backend-owned fixed Tauri HTTP Referer needed to obtain a non-empty official script
- **AND** it MUST preserve the remaining official query fields without locally reimplementing them.

#### Scenario: Baidu returns HMACCOUNT

- **WHEN** a fixed script or beacon response contains a valid `Set-Cookie: HMACCOUNT=...`
- **THEN** the native state MUST persist only the bounded anonymous value using lock + atomic write
- **AND** later fixed requests and later app launches MUST send the same cookie until Baidu replaces it
- **AND** logs MUST NOT contain the cookie value, full beacon URL or query.

#### Scenario: visitor cookie persistence is missing or corrupted

- **WHEN** the internal analytics record is missing
- **THEN** the first request MAY omit the cookie and MUST persist a valid response value
- **WHEN** the record is corrupted
- **THEN** it MUST be quarantined before fallback and MUST NOT block app startup.

### Requirement: Native analytics commands MUST remain a narrow fixed-purpose boundary

The analytics bridge MUST NOT expose a generic network proxy or script evaluator to renderer-controlled endpoints.

#### Scenario: renderer requests a beacon

- **WHEN** `send_baidu_tongji_beacon` is invoked
- **THEN** backend validation MUST require main-window caller, bounded input, `http/https`, exact `hm.baidu.com`, exact `/hm.gif`, built-in site id and non-empty `hca`
- **AND** request method, final HTTPS endpoint and accepted headers MUST be backend-owned.

#### Scenario: renderer requests official script loading

- **WHEN** `load_baidu_tongji_script` is invoked
- **THEN** backend MUST fetch only the compiled-in `hm.js` URL for the compiled-in site id
- **AND** backend MUST own the fixed Tauri HTTP Referer rather than accepting an arbitrary renderer-supplied referer
- **AND** response status/size/transport marker MUST pass validation before evaluation
- **AND** secondary windows MUST be rejected.

#### Scenario: caller supplies invalid input

- **WHEN** URL host/path/site id, User-Agent or input size violates the contract
- **THEN** the command MUST reject before external network side effects
- **AND** the error MUST identify the rejected action without echoing sensitive query content.

### Requirement: Unaffected analytics runtimes MUST retain existing behavior

The Linux native workaround MUST NOT change environments that do not use the affected WebKitGTK NetworkProcess path.

#### Scenario: Windows, macOS or Linux Web Service production starts

- **WHEN** the production main window runs outside Linux native Tauri
- **THEN** the existing external `hm.js` injection behavior MUST remain
- **AND** the site id and one-main-window PV contract MUST remain unchanged.

#### Scenario: development or secondary window starts

- **WHEN** the build is not production or the current window is not main
- **THEN** no Baidu analytics path MUST initialize
- **AND** no native analytics command MUST be invoked.

### Requirement: Linux release verification MUST prove both analytics delivery and a visible stable renderer

Release acceptance MUST combine transport evidence with the original user-visible startup path; unit tests or a live PID alone are insufficient.

#### Scenario: isolated profile launches twice

- **WHEN** the same Linux native artifact launches twice against one isolated profile
- **THEN** both launches MUST load the official script and receive beacon HTTP success
- **AND** the beacon MUST report a non-empty `hca`
- **AND** the second launch MUST report visitor-cookie reuse without logging its value.

#### Scenario: direct ELF and AppImage start

- **WHEN** custom-protocol release ELF and bundled AppImage are launched
- **THEN** diagnostics MUST reach render-committed and renderer-ready
- **AND** screenshot/geometry/pixel evidence MUST rule out white, black, transparent and ErrorBoundary-only content
- **AND** no new launch-timestamp-following WebKitNetworkProcess/libsoup crash MAY exist.

#### Scenario: application-list-equivalent launcher starts the AppImage

- **WHEN** a temporary launcher reproduces the user's application-list path for the worktree artifact
- **THEN** it MUST satisfy the same analytics, renderer and crash evidence contract
- **AND** verification MUST NOT overwrite the user's existing launcher or main-worktree artifact.
