## MODIFIED Requirements

### Requirement: Phase 2 inherits Browser Dock MVP baseline

Browser Agent Page Understanding SHALL inherit the Phase 1 Browser Dock MVP baseline, including the top-level toolbar opener, detached Browser Dock window, single native WebView renderer, active-tab ownership, engine-agnostic attachments, default built-in Browser Agent preference, explicit disable setting, cross-platform capability degradation, large-file governance, and privacy-safe defaults.

#### Scenario: Phase 2 keeps Browser Dock runtime stable
- **WHEN** Browser Agent Page Understanding features are enabled
- **THEN** Browser Dock SHALL still render through the detached Browser Dock flow with multi-tab UI backed by one native renderer
- **AND** page-understanding features SHALL NOT require the main conversation window to navigate away from the app route

#### Scenario: Inactive tabs do not leak into AI context
- **WHEN** multiple Browser Dock tabs are open and the user attaches browser context
- **THEN** the attachment SHALL describe only the active tab unless the user explicitly switches tabs and captures again

## ADDED Requirements

### Requirement: Browser page selector SHALL inject selected element evidence into Composer

Browser Agent Page Understanding SHALL provide a read-only page selector that lets the user choose one or more visible page elements and injects structured evidence for those elements into the current Composer as BrowserContextAttachment evidence.

#### Scenario: User selects a page element for chat context
- **WHEN** the user activates the Browser Dock selector control
- **AND** clicks a visible page element in the active Browser Agent renderer
- **THEN** the system SHALL capture bounded page context from the active browser session
- **AND** the system SHALL attach browser context to the current Composer without requiring manual text entry
- **AND** the attachment SHALL include structured evidence for the selected element, including sanitized text or label, element role or tag, URL, title, viewport-relative bounds, and capture time when available
- **AND** Composer preview SHALL make the selected element evidence the primary visible content instead of leading with full-page snapshot text

#### Scenario: User selects multiple page elements for one chat context
- **WHEN** selector mode is active
- **AND** the user clicks multiple visible page elements in the active Browser Agent renderer
- **THEN** each click SHALL append a separate structured selected-element evidence item to the current Composer BrowserContextAttachment
- **AND** later selections SHALL NOT overwrite earlier selections for the same active browser session and workspace
- **AND** Composer preview SHALL show the selected element count and a compact list of selected element labels or text
- **AND** expanded capture details and AI-visible prompt context SHALL preserve the selected elements in selection order before full-page snapshot text

#### Scenario: Selector mode is explicit and bounded
- **WHEN** selector mode is active
- **THEN** the page SHALL show a visible hover or selection affordance for candidate elements
- **AND** selector mode SHALL remain active after a successful selection so the user can select another element
- **AND** selector mode SHALL exit after explicit cancel
- **AND** selector mode SHALL NOT click links, submit forms, type into fields, or otherwise mutate the page state

#### Scenario: Selector prefers precise semantic targets
- **WHEN** the pointer is over nested page content
- **THEN** selector mode SHALL prefer the smallest visible semantic element under the pointer, such as links, buttons, headings, paragraphs, list items, table cells, images, and form controls
- **AND** selector mode SHALL avoid broad layout containers such as `html`, `body`, `main`, `section`, `article`, and generic `div` elements when a better child candidate is available
- **AND** the hover affordance SHALL include a compact readable metadata card with the chosen element identity, dimensions, and label or text when available

#### Scenario: Selected element preview stays focused after injection
- **WHEN** a selector-created BrowserContextAttachment is shown above Composer or later rendered as a sent-message browser context summary
- **THEN** the primary visible card SHALL show the selected element labels or text, role or tag, viewport bounds, selector hints, selected element count, and source page
- **AND** broad page summary, primary content, readable blocks, and page element counts SHALL remain available only in expanded capture details
- **AND** the preview SHALL NOT lead with unrelated full-page snapshot text when selected element evidence is available

#### Scenario: Selected element evidence follows privacy rules
- **WHEN** selected element text, labels, placeholders, hrefs, or nearby text contain secret-like data
- **THEN** the AI-visible attachment SHALL use the existing Browser Agent sanitization and redaction rules
- **AND** the system SHALL NOT expose raw DOM, cookies, headers, storage, scripts, styles, hidden input values, or password values

#### Scenario: Selector injection degrades visibly
- **WHEN** selector script injection, page capture, or Composer handoff fails
- **THEN** the system SHALL surface a recoverable diagnostic rather than silently pretending the page was attached
- **AND** the user SHALL be able to retry normal browser context attach or selector mode
