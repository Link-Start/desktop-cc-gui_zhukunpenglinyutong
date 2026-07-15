// codexModes — English UI strings
const codexModes = {
  codexModes: {
    default: {
      label: "Suggest (approval)",
      tooltip:
        "Codex approval_policy=untrusted – prompts before editing files or running shell commands.",
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
        "Codex approval_policy=auto-edit – automatically applies file patches, still asks before shell commands.",
      description:
        "Auto-create and edit files via apply_patch while keeping command approvals.",
    },
    bypassPermissions: {
      label: "Full Auto",
      tooltip:
        "Codex approval_policy=never – runs commands and writes files without prompting (workspace sandbox still enforced).",
      description:
        "Hands-off mode. Codex executes edits and shell commands immediately.",
    },
  },
};

export default codexModes;
