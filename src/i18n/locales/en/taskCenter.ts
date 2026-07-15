// taskCenter — English UI strings
const taskCenter = {
  taskCenter: {
    title: "Task Center",
    eyebrow: "Agent Runs",
    workspaceHero: "Run needing attention now",
    statusFilter: "Status",
    engineFilter: "Engine",
    filterAll: "All",
    empty: "No task runs yet",
    summary: "{{attention}} of {{total}} runs need attention",
    openedFromProjectMap:
      "Opened the linked Run from the Project Map work queue. This page shows the real TaskRun detail; if no conversation action appears, this Run is not linked to a real session yet.",
    trigger: "Trigger",
    updatedAt: "Updated",
    currentStep: "Current step",
    latestOutput: "Latest output",
    diagnostics: "Diagnostics",
    artifacts: "Artifacts",
    browserEvidence: "Browser evidence",
    unavailable: "Unavailable",
    noArtifacts: "No artifacts yet",
    noBrowserEvidence: "No browser evidence linked",
    browserEvidenceCandidates: "candidates",
    source: {
      kanban: "kanban",
      orchestration: "orchestration",
    },
    browserEvidenceState: {
      available: "available",
      stale: "stale",
      expired: "expired",
      degraded: "degraded",
      deleted: "deleted",
      unsupported: "unsupported",
    },
    status: {
      queued: "Queued",
      planning: "Planning",
      running: "Running",
      waiting_input: "Waiting for input",
      blocked: "Blocked",
      failed: "Failed",
      completed: "Completed",
      canceled: "Canceled",
    },
    action: {
      openConversation: "Open conversation",
      openOrchestrationTask: "Open orchestration task",
      retry: "Retry",
      resume: "Resume",
      cancel: "Cancel",
      fork: "Fork run",
    },
    nextStep: {
      monitor:
        "This run is still progressing. Monitor the current step or cancel if needed.",
      openConversation:
        "Open the linked conversation next to provide input or inspect the latest output.",
      resume:
        "This run is blocked. Resume it first to continue the current path.",
      retry: "This run failed. Retry it next or inspect the failure summary.",
      wait: "No action is needed right now. Let the run settle first.",
      review:
        "Review diagnostics and artifacts first, then decide the next move.",
      fork: "You can fork a new run from the current result to continue.",
    },
  },
};

export default taskCenter;
