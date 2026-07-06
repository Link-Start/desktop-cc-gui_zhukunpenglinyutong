const enModes = {
  // Permission modes
  modes: {
    selectMode: "Select Mode",
    default: {
      label: "Default Mode",
      tooltip: "Standard permission behavior",
      description:
        "Requires manual confirmation for each operation, suitable for cautious use",
    },
    plan: {
      label: "Plan Mode",
      tooltip: "Plan mode - read-only analysis",
      description:
        "Uses only read-only tools, generates plan for user approval",
    },
    acceptEdits: {
      label: "Agent Mode",
      tooltip: "Automatically accept file edits",
      description:
        "Automatically accept file creation/editing, reducing confirmation steps",
    },
    bypassPermissions: {
      label: "Auto Mode",
      tooltip: "Bypass all permission checks",
      description:
        "Fully automated, bypassing all permission checks [Use with caution]",
    },
  },

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

  // Codex-specific modes
  codexModes: {
    default: {
      label: "Suggest (approval)",
      tooltip:
        "Codex approval_policy=untrusted \u2013 prompts before editing files or running shell commands.",
      description:
        "Safest option. Every write or command requires your approval.",
    },
    plan: {
      label: "Plan Mode",
      tooltip: "Plan mode - read-only analysis",
      description:
        "Uses only read-only tools, generates plan for user approval",
    },
    acceptEdits: {
      label: "Auto Edit",
      tooltip:
        "Codex approval_policy=auto-edit \u2013 automatically applies file patches, still asks before shell commands.",
      description:
        "Auto-create and edit files via apply_patch while keeping command approvals.",
    },
    bypassPermissions: {
      label: "Full Auto",
      tooltip:
        "Codex approval_policy=never \u2013 runs commands and writes files without prompting (workspace sandbox still enforced).",
      description:
        "Hands-off mode. Codex executes edits and shell commands immediately.",
    },
  },
};

export default enModes;
