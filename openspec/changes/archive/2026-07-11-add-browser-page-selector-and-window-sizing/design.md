## Context

Browser Agent already has three important building blocks: a Rust-owned Browser Agent renderer window, a read-only capture script that produces bounded page facts, and a frontend BrowserContextAttachment path used by Composer and message sending. The missing piece is a user-visible selector flow that binds a chosen page element to that existing context path. Current specs still describe a right-side companion split, while the implementation and user-facing docs have moved to detached Browser Dock and a separate renderer window.

## Goals / Non-Goals

**Goals:**
- Treat detached Browser Dock window + single renderer window as the current Browser Agent primary runtime.
- Increase Browser Agent renderer default size while preserving minimum usable dimensions.
- Add a read-only element selection flow that appends structured browser evidence into the active Composer.
- Keep Browser Agent selector evidence engine-agnostic and privacy-bounded.

**Non-Goals:**
- No browser automation execution beyond read-only selection/capture.
- No screenshots or raw DOM injection.
- No persistent DOM inspector/editor beyond bounded multi-select evidence capture.
- No new dependency or global UI framework change.

## Decisions

1. **Selector evidence uses BrowserContextAttachment, not raw Composer text.**
   - Option A: insert selected text into the draft. This is small but loses URL/title/viewport/stale/privacy context.
   - Option B: attach a BrowserContextAttachment with annotation evidence. This preserves the existing evidence and prompt formatting contract. Choose B.

2. **Selector mode is injected into the renderer page by toolbar action.**
   - Option A: frontend BrowserDock owns DOM selection. It cannot inspect external renderer page DOM directly across WebView boundary.
   - Option B: Rust toolbar bridge injects a bounded script into the active renderer, captures selected element facts, then emits an event to main. Choose B.

3. **Selector session supports repeated picks without becoming a DOM editor.**
   - Option A: persistent inspector mode supports repeated picks, editing, and manual annotation management. More powerful but heavier and riskier.
   - Option B: click selector button, pick multiple elements in one bounded session, append each selection to Composer, exit with `Esc`. This matches the requested workflow while staying read-only. Choose B.

4. **Window sizing changes stay in Rust renderer window construction.**
   - The native renderer is created by `WebviewWindowBuilder`, so the canonical default size belongs beside `create_browser_agent_window`.

5. **Selector precision is semantic-first, not event-target-first.**
   - Option A: use `event.target` directly. This is fragile because layout containers and page roots win whenever the pointer lands on whitespace or wrapped content.
   - Option B: inspect `document.elementsFromPoint()`, score candidates, and prefer visible semantic leaf elements such as links, buttons, headings, paragraphs, list items, table cells, images, and form controls. Choose B.
   - The hover UI should render like an inspector: a clean blue outline, subtle fill, dimmed page backdrop, and compact metadata card that avoids covering the target when possible.

## Data Flow

```text
Browser toolbar selector button
  -> toolbar bridge action "select"
  -> Rust injects bounded multi-select selector JS into browser-agent-window
  -> elementsFromPoint() selects the best semantic candidate under the pointer
  -> selected element facts are sent through a safe bridge URL/event per click
  -> Rust emits browser-agent://attach-current-context to main with selector annotation payload
  -> Composer/browser context hook captures or reuses the current session snapshot
  -> annotation evidence is appended into BrowserContextAttachment
  -> Composer preview shows selected element list plus expandable page context
```

## Risks / Trade-offs

- **Cross-WebView event drift** -> Keep event payload small and typed; reuse existing `browser-agent://attach-current-context`.
- **Sensitive selected text** -> Run all selector text through existing Browser Agent sanitization before AI-visible prompt formatting.
- **Page CSP / script limits** -> Use WebView `eval` from the native runtime; fall back to normal attach if selector injection fails.
- **Spec/runtime mismatch recurrence** -> Delta explicitly names detached Browser Dock as primary runtime.

## Migration Plan

1. Add OpenSpec deltas and validate them.
2. Add selector payload types and attachment command support.
3. Extend Rust toolbar bridge with selector button and injection handler.
4. Adjust renderer window default size.
5. Add focused tests and run validation.
6. Extend selector session from one-shot to append-only multi-select; keep `Esc` as explicit exit and keep page mutation blocked.

Rollback is bounded: disable the selector toolbar action and keep the window sizing/spec alignment if selector behavior needs further iteration.
