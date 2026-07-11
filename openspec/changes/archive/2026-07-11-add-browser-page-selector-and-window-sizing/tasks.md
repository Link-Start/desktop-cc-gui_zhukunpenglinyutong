## 1. OpenSpec And Contract Setup

- [x] 1.1 Validate proposal/design/spec deltas for Browser Dock detached runtime, default sizing, and selector-to-Composer injection.
- [x] 1.2 Identify exact frontend/backend payload fields for selected element evidence and Composer attachment requests.

## 2. Browser Runtime Implementation

- [x] 2.1 Increase Browser Agent renderer default window size and preserve minimum dimensions in Rust window creation.
- [x] 2.2 Add toolbar selector action and one-shot selector injection bridge in `src-tauri/src/browser_agent/toolbar.rs`.
- [x] 2.3 Emit selected element evidence through the existing Browser Agent main-window attachment event path.
- [x] 2.4 Upgrade selector precision and visual affordance to prefer semantic leaf elements over broad layout containers.
- [x] 2.5 Keep selector mode active for repeated read-only picks until explicit cancel.

## 3. Frontend Attachment Integration

- [x] 3.1 Add selected element evidence types and sanitize/format helpers inside the Browser Agent feature slice.
- [x] 3.2 Extend browser context attachment request handling so selector evidence is merged into the next BrowserContextAttachment.
- [x] 3.3 Ensure Composer displays the resulting BrowserContextAttachment through the existing preview/remove/refresh UI.
- [x] 3.4 Prefer selected element evidence over full-page snapshot text in Composer and sent-message browser context summaries.
- [x] 3.5 Append repeated selector evidence to the current Composer attachment instead of overwriting earlier selections.

## 4. Verification

- [x] 4.1 Add focused tests for selector evidence formatting and attachment merge behavior.
- [x] 4.2 Add Rust focused tests for toolbar selector query parsing or bridge helper behavior.
- [x] 4.3 Run `openspec validate add-browser-page-selector-and-window-sizing --strict --no-interactive`.
- [x] 4.4 Run focused frontend tests and `npm run typecheck`.
- [x] 4.5 Add focused regression coverage for selector precision script behavior and rerun validation gates.
- [x] 4.6 Add focused regression coverage for selected element preview priority.
- [x] 4.7 Add focused regression coverage for multi-select append behavior and selected element list rendering.
