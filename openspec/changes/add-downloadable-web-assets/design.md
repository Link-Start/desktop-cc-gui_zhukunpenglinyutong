## Context

`f0b5fe7` removed the duplicate bundled `dist` resource and introduced `assets_export.rs`, which materializes Tauri embedded assets into `<app-data>/web-assets/current` only while spawning a new packaged daemon. This leaves two gaps: the main client still owns the Web frontend bytes, and an already-running daemon never receives the injected environment variable. The desired UX is intentionally smaller: Web Service settings detect a missing assets package and install one platform-neutral ZIP from the matching GitHub Release.

The change crosses React settings, Tauri IPC, Rust filesystem/network code, daemon asset resolution and GitHub Actions. Existing `reqwest`, `sha2`, App Data path resolution, daemon `--data-dir`, settings styles and command facade must be reused.

## Goals / Non-Goals

**Goals:**

- Publish one immutable Web assets archive per App version.
- Detect and install the matching archive from Web Service settings with one explicit user action.
- Reject corrupt, incompatible or unsafe archives before changing the active assets directory.
- Let both newly spawned and already-running local daemons resolve the standard installed directory.
- Preserve development checkout asset discovery and all existing Web Service control/auth behavior.

**Non-Goals:**

- System installers, elevation, component marketplace, background updates or progress percentages.
- Remote daemon installation or management.
- Multiple installed versions, rollback UI or configurable release channels.

## Decisions

### 1. Release artifact contract

The archive name is `ccgui-web-assets_<app-version>.zip`; checksum file is the same name plus `.sha256`. The archive root contains `manifest.json`, `index.html` and the Vite output tree. `manifest.json` uses `{ "schemaVersion": 1, "assetsVersion": "<app-version>", "entrypoint": "index.html" }`.

GitHub Actions builds the frontend once in a dedicated Linux job, creates both files and uploads them as one workflow artifact. The final release job downloads and publishes them beside existing installers. This avoids three identical archives from platform matrices.

Alternative: generate an archive in every platform job. Rejected because content/name collisions can drift and make checksum selection ambiguous.

### 2. Download address and integrity

Rust derives the asset/checksum URL from the desktop package version and the existing canonical GitHub release repository. `MOSSX_WEB_ASSETS_BASE_URL` is an optional override for development/tests and private mirrors; otherwise the base is `https://github.com/zhukunpenglinyutong/desktop-cc-gui/releases/download/v<version>`.

The installer downloads the checksum text first, requires exactly one 64-character hexadecimal SHA-256, downloads the ZIP with a bounded HTTP timeout and rejects non-success status. The checksum protects against corruption and accidental artifact mismatch; it is not claimed as a substitute for GitHub account/release trust.

Alternative: embed checksum into the desktop binary. Rejected because the desktop build completes before the separately produced archive checksum exists, creating an unnecessary cross-job rebuild dependency.

### 3. Installation state and filesystem transaction

The canonical directory remains `<app-data>/web-assets/current`. A valid installation requires:

- `.ccgui-web-assets-version` equal to the current package version;
- `manifest.json` with `schemaVersion=1`, matching `assetsVersion`, and `entrypoint=index.html`;
- a valid Vite `index.html` and an `assets` directory.

Installation extracts into a unique staging directory under `<app-data>/web-assets/`. ZIP entries are accepted only through `enclosed_name()` and regular files/directories; symlinks and path traversal are rejected. After validation, the current directory is renamed to backup, staging is renamed to current, and backup is removed. If activation fails, the previous directory is restored.

Alternative: unzip directly into `current`. Rejected because interrupted downloads/extraction would create a false partially installed state and could destroy a previously working version.

### 4. Cross-layer status contract

`get_web_assets_status` returns:

```text
state: "missing" | "ready" | "failed"
installedVersion: string | null
requiredVersion: string
lastError: string | null
installationRequired: boolean
```

`install_web_assets` performs the operation and returns the same final status. `installationRequired` is true for packaged builds and false for development builds, preserving checkout `dist` fallback. The frontend owns transient `checking` and `installing` states to avoid introducing backend job orchestration. Install is one awaited command; duplicate clicks are disabled. Remote daemon endpoints are not gated by desktop-local assets.

The remote install action remains visible after assets become ready and changes to a repair-oriented “Download and reinstall” label. It reuses the same transactional installer; no delete-first flow is introduced. Every asynchronous assets action projects the existing transient state back onto its trigger button with a spinner, busy label, `aria-busy`, and cross-action disabling.

User-triggered install, local import, and re-check actions also expose a single inline operation log below the assets row. The log reports start, terminal success, or the backend-provided error; automatic mount-time detection stays silent. This is deliberately phase-based feedback because the existing awaited Tauri commands do not expose byte-level progress events.

### 5. Daemon asset resolution

`WebServiceRuntime` receives daemon `data_dir` and probes `<data-dir>/web-assets/current` on each Web Service start in addition to the existing environment/bundle/development candidates. This closes the already-running daemon gap without process restart. The explicit `MOSSX_WEB_ASSETS_DIR` remains highest priority.

The desktop bootstrap also validates the installed directory before setting the environment variable. Missing assets do not prevent daemon RPC startup, but `start_web_server` is blocked by the desktop command/UI until installation is ready. This preserves non-Web daemon capabilities.

### 6. Local package import

Web Service settings exposes a native file picker for `ccgui-web-assets_*.zip`. The backend requires the selected ZIP's adjacent `<archive>.sha256` file and copies the archive into the managed temporary directory before validation. Download and local import then share the same SHA-256, ZIP safety, manifest, version, entrypoint, staging and activation path.

The local path is an explicit user-selected testing/offline input, not a configurable persistent source. Cancellation is a no-op, the selected path is not persisted, and local import does not weaken or replace the normal GitHub Release download flow.

## Risks / Trade-offs

- **[GitHub unavailable or offline]** → return a stable install failure, retain the prior installation and keep retry available.
- **[Checksum hosted beside archive is not an independent signature]** → describe it as integrity protection; continue relying on HTTPS/GitHub Release trust within this minimal scope.
- **[Windows directory rename blocked by an active file handle]** → Web runtime reads files per request and does not retain open handles; activation failure restores backup and surfaces an actionable error.
- **[App and assets versions diverge]** → strict version equality prevents serving an incompatible frontend; independent semantic version ranges remain out of scope.
- **[Release artifact absent]** → install command reports HTTP status and existing assets remain untouched.
- **[Local ZIP or adjacent checksum is missing/tampered]** → reject before activation and retain the prior installation.

## Migration Plan

1. Publish the new archive/checksum with the next normal Release.
2. Updated clients report `missing` when legacy embedded export is absent or stale.
3. User explicitly installs from settings; successful installation activates `current`.
4. Development builds continue resolving checkout `dist` for daemon serving, while settings installation status remains based on the managed directory.

Rollback is file-level: remove the new Release job/commands/UI and restore embedded export bootstrap. Installed files are inert if no runtime resolves them.

## Open Questions

无。本期固定 GitHub Release 为默认源，并保留 `MOSSX_WEB_ASSETS_BASE_URL` 作为非 UI override。
