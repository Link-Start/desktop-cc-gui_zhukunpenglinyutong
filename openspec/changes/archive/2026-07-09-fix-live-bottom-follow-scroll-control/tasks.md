# Tasks

## 1. Floating scroll control

- [x] 1.1 Add `ScrollControl` with back-to-top and back-to-bottom actions.
- [x] 1.2 Move bottom navigation out of `MessagesAnchorRail`.
- [x] 1.3 Add localized accessible labels for the floating control.

## 2. Bottom-follow behavior

- [x] 2.1 Drive live bottom-follow from actual timeline height changes through `ResizeObserver`.
- [x] 2.2 Gate bottom-follow by streaming, settle repin, and initial bottom pin windows.
- [x] 2.3 Release bottom-follow when the user intentionally scrolls away.
- [x] 2.4 Replace bottom sentinel `scrollIntoView` with direct container `scrollTop` writes.

## 3. Adjacent rendering fixes

- [x] 3.1 Strip `cat -n` prefixes before rendering Read tool markdown output.
- [x] 3.2 Tighten tool marker shell body radius.
- [x] 3.3 Make the ResizeObserver test mock configurable and triggerable.

## 4. Verification

- [x] 4.1 Add focused `ScrollControl` tests.
- [x] 4.2 Add/extend `Messages.live-behavior` tests for content-height bottom-follow.
- [x] 4.3 Run focused messages tests and TypeScript validation.
