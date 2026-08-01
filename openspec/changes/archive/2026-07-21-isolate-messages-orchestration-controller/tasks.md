## 1. Lock current behavior
- [x] 1.1 Run runtime reconnect、Windows mitigation、live behavior and presentation/history regression suites.
- [x] 1.2 Run virtualized jump、history loading、scroll convergence and transient cleanup suites.
- [x] 1.3 Add focused failing coverage for any ownership contract not protected by existing tests.

## 2. Extract runtime owner
- [x] 2.1 Create `useMessagesRuntimeState` for stream phase、latency/mitigation、blanking/stall、working/finalizing and reconnect lifecycle.
- [x] 2.2 Preserve current timeout values、event subscriptions and cleanup behavior.

## 3. Extract presentation and history owners
- [x] 3.1 Create `useMessagesPresentationState` for stable snapshot、live overrides、grouping、boundaries、summaries and suppression sets.
- [x] 3.2 Preserve independent memo identity for snapshot/live/runtime/navigation/interactions/presentation/slots models.
- [x] 3.3 Create `useMessagesHistoryWindow` for collapsed/full/expanded windows、manual/jump reveal、readable preservation and history-head reset.
- [x] 3.4 Scope deferred presentation/history state by workspace + thread.

## 4. Extract scroll and interaction owners
- [x] 4.1 Create `useMessagesScrollController` for follow、echo suppression、initial settle、convergence、pending jumps and cleanup.
- [x] 4.2 Return stable callbacks/refs without exposing raw setters.
- [x] 4.3 Create `useMessagesInteractions` for copy、toggle、context menu、recovery、fork/rewind、note capture and file-open actions.

## 5. Compose and verify
- [x] 5.1 Reduce `MessagesCore.tsx` to owner composition and keep it below 2200 lines.
- [x] 5.2 Run focused and full messages suites.
- [x] 5.3 Run typecheck、full lint、build、boundary、large-file evidence、diff check and independent review.
- [x] 5.4 Record line counts、review evidence and baseline qualifiers.
