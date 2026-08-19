# engine-image-input-boundary Specification

## Purpose

Defines cross-engine image input transport, history presentation, and filesystem rendering boundaries for Grok, OpenCode, Kimi, Claude, and Codex.

## Requirements

### Requirement: Grok image transport via prompt-file

The runtime MUST launch Grok with `--prompt-file <path>` when the resolved
engine is Grok and the sanitized image list is non-empty. The file content MUST
be ACP content blocks including:

- one `text` block preserving the non-empty user prompt verbatim (or a minimal
  placeholder if text is empty)
- one `image` block per successfully loaded attachment:
  `{ "type": "image", "mimeType": "<mime>", "data": "<base64>" }`

Argv MUST carry only the staging file path (not the base64 JSON body), so large
screenshots are not subject to OS ARG_MAX / former 700KB soft-cap failures.
Text-only Grok turns MUST keep the legacy `-p` path.

#### Scenario: Grok text-only keeps -p

- **WHEN** a Grok send has no non-empty image attachments
- **THEN** the process args MUST include `-p` / `--single` text prompt
- **AND** MUST NOT require `--prompt-file` or `--prompt-json`

#### Scenario: Grok with local image uses prompt-file

- **WHEN** a Grok send includes a readable local image path
- **THEN** the process args MUST include `--prompt-file` followed by a staging path
- **AND** MUST NOT place the ACP JSON body on `--prompt-json` argv
- **AND** the staging file MUST contain an ACP `image` block with base64 data
- **AND** non-empty user text MUST be preserved verbatim in the ACP `text` block

#### Scenario: Grok image load failure is explicit

- **WHEN** all attached image paths are unreadable or oversized
- **THEN** the send MUST fail with a clear load error before spawning a text-only turn
- **AND** the error MUST NOT include raw `data:` URL payloads or base64 image bytes
- **AND** the error MUST identify the attachment by mime type and approximate size

#### Scenario: Grok oversized paste is rejected before spawn

- **WHEN** the resolved engine is Grok and a pasted data URL decodes above the
  2MiB per-image soft-cap
- **THEN** the client MUST fail the send before calling the engine
- **AND** the user-visible message MUST include the engine label, actual size,
  and the 2MiB limit

### Requirement: Grok history presentation boundary

History loading MUST separate Grok multimodal user text from persisted image
paths. Grok chat history may store those turns as:

```text
<image_files>
1. /abs/path/to/assets/image-....png
</image_files>

<user_query>
user text
</user_query>
```

History load MUST set message `text` to the user_query body and `images` to the
extracted absolute paths. The canvas MUST NOT render the raw `<image_files>`
wrapper as the user bubble body.

#### Scenario: Grok history with image_files block

- **WHEN** a loaded Grok user line contains `<image_files>` and `<user_query>`
- **THEN** `text` MUST equal the user_query body only
- **AND** `images` MUST contain the listed absolute asset paths

### Requirement: OpenCode image attachment via run --file

When engine is OpenCode and images are non-empty, `opencode run` MUST include
one `--file <absolute-path>` argument per resolved image. Data URLs MUST be
materialized to workspace staging files first.

#### Scenario: OpenCode with local image uses -f

- **WHEN** OpenCode send includes a readable local image
- **THEN** process args MUST include `--file` with that path

### Requirement: Kimi headless image-path injection

Kimi headless image support MUST inject absolute paths and
`<image path="...">` tags into the `-p` prompt after a stable mossx marker, and
MUST instruct the agent to call `ReadMediaFile` (print mode uses
`permission: auto`).

#### Scenario: Kimi with local image rewrites prompt

- **WHEN** Kimi send includes a readable local image
- **THEN** the `--prompt` text MUST include the absolute path
- **AND** MUST include a ReadMediaFile instruction and `<image path>` tag
- **AND** MUST include the mossx injection marker for later strip

### Requirement: Kimi history display boundary

History loading MUST strip the Kimi injection block (marker or legacy English
instruction prefix) and restore paths into `images[]`. The canvas MUST consume
that normalized text and render thumbnails instead of tool-instruction text.
Generic frontend presentation MUST NOT heuristically strip marker-like text
from ordinary user-authored messages.

#### Scenario: Kimi history strips injection

- **WHEN** a loaded Kimi user prompt contains the mossx image-injection marker
- **THEN** message `text` MUST exclude the injection block
- **AND** message `images` MUST list the injected absolute paths

#### Scenario: Ordinary marker-like user text remains intact

- **WHEN** an ordinary user-authored message contains a mossx marker or
  `<image_files>` / `<user_query>` example text
- **THEN** generic frontend presentation MUST preserve that text verbatim

### Requirement: Claude and Codex image transport compatibility

Client and backend gates MUST NOT reject Claude or Codex image payloads.
Codex sync MUST continue to pass images through `params_to_codex_input`.

#### Scenario: Claude/Codex image send is not blocked by capability gate

- **WHEN** engine is `claude` or `codex` and images are non-empty
- **THEN** neither client pre-guard nor backend `require_image_support` rejects the send

### Requirement: Reliable filesystem image rendering

User-message image entries that are absolute filesystem paths MUST carry a
`localPath` for LocalImage fallback. Preview roots MUST include the workspace
and Grok home sessions directory so assets under `~/.grok/sessions/**/assets`
can be inlined when asset-protocol conversion fails.

#### Scenario: Non-ASCII workspace staging path loads via fallback

- **WHEN** a user message image is an absolute path under the workspace
  `.mossx/image-staging` directory
- **THEN** the canvas MUST attempt LocalImage disk fallback with workspaceId
- **AND** MUST NOT leave only a broken empty image frame without fallback
