// claudeModes — English UI strings
const claudeModes = {
  claudeModes: {
    default: {
      label: "Suggest Mode (Preview)",
      tooltip:
        "Claude Code preview approval mode. Some flows may still degrade while the full approval bridge is being completed.",
      description:
        "Now available as a preview for validating Claude's default permission flow. If a degraded path is hit, the UI should guide users back to Plan mode.",
    },
    plan: {
      label: "Plan Mode",
      tooltip: "Claude Code read-only analysis mode.",
      description:
        "Uses read-only tools for analysis and planning before taking action.",
    },
    acceptEdits: {
      label: "Auto Edit",
      tooltip:
        "Claude Code auto-edit mode. Not enabled in the current rollout phase.",
      description:
        "This mode stays unavailable until Claude approval semantics are verified.",
    },
    bypassPermissions: {
      label: "Full Auto",
      tooltip: "Claude Code mode that skips permission checks.",
      description:
        "Hands-off execution for file writes and commands without approvals. Use with care.",
    },
  },
};

export default claudeModes;
