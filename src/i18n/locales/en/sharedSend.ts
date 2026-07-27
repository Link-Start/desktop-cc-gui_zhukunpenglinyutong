// sharedSend — English UI strings (Wave 4 / Change B §14.5 UI state machine)
const sharedSend = {
  sharedSend: {
    preparingContext: "Preparing context for the shared session…",
    degradedTitle: "Degraded context",
    degradedHint:
      "The context projection has omissions. The turn will not be sent without your confirmation.",
    degradedConfirm: "Send anyway",
    awaitingAcceptance: "Delivering… waiting for the runtime to confirm receipt.",
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
    cancel: "Cancel",
  },
};

export default sharedSend;
