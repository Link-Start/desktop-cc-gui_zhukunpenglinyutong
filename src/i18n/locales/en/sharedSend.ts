// sharedSend — English UI strings (Wave 4 / Change B §14.5 UI state machine)
const sharedSend = {
  sharedSend: {
    preparingContext: "Preparing context for the shared session…",
    degradedTitle: "Some context will be omitted",
    degradedHint:
      "Some history cannot be transferred safely. Confirm to continue.",
    degradedConfirm: "Continue sending",
    degradedDetails: "View details",
    degradedMode: "Transfer mode: {{mode}}",
    degradedTokenEstimate:
      "Estimated context size: {{source}} → {{package}} tokens",
    unknownDetail: "Unrecognized protocol value: {{value}}",
    modeNativeDelta: "Native incremental context",
    modeNativeHistoryImport: "Native history import",
    modeNativeHistoryClone: "Native session clone",
    modePortableTranscript: "Portable transcript",
    modeCheckpoint: "Compressed checkpoint",
    dispositionRetrievable: "Retrievable on demand",
    dispositionNotRetrievable: "Not retrievable",
    omissionImageHistory:
      "Images are not supported by the destination history.",
    omissionAssistantOutcome:
      "The assistant turn ended as {{outcome}} and will not be replayed as successful.",
    omissionPrivateReasoning:
      "Provider-private reasoning cannot be transferred.",
    omissionAssistantArtifact:
      "Assistant artifacts remain references and are not injected as text.",
    omissionPrivateBlock:
      "An unsupported private assistant block was omitted.",
    omissionToolHistory:
      "Tool calls and results were omitted together because the destination does not support tool history.",
    omissionHistoricalControl:
      "Historical control actions are reference-only and will not run again.",
    omissionDeterministicFold:
      "Long content was folded to fit the context budget.",
    omissionCheckpointBudget:
      "The oldest complete turn was omitted to fit the context budget.",
    omissionDestinationOwned:
      "Content already present in the destination's native history was not duplicated.",
    omissionUnknown: "Unrecognized omission ({{category}}): {{reason}}",
    outcomeCompleted: "completed",
    outcomeFailed: "failed",
    outcomeCancelled: "cancelled",
    outcomeReplaced: "replaced",
    outcomeUnknown: "unknown",
    awaitingAcceptance:
      "Request sent. Waiting for the CLI to confirm it started processing…",
    cancelUnsupported:
      "This adapter cannot cancel a pending delivery; wait for the runtime verdict.",
    cancelPending: "Confirming the cancel outcome…",
    settling: "Saving the result…",
    recoveryTitle: "Recovery required",
    recoveryHint:
      "The last send had an ambiguous acknowledgement, so this shared session is locked. Probe the durable evidence, or explicitly rebuild the binding.",
    recoveryProbe: "Probe",
    recoveryProbing: "Probing…",
    recoveryRebuild: "Rebuild binding",
    recoveryProbeHeld:
      "Probe found an accepted but uncommitted attempt. The session stays locked to preserve ordering.",
    recoveryProbeCleared: "Probe found no pending attempt. The session is unlocked.",
    targetUnavailable: "The selected target is unavailable.",
    targetUnavailableReason: "The selected target is unavailable: {{reason}}",
    selectionPersistFailedTitle: "Target selection was not saved",
    selectionPersistFailedMessage:
      "The current in-memory selection is preserved, but restart recovery may use the previous target: {{reason}}",
    cancel: "Cancel",
  },
};

export default sharedSend;
