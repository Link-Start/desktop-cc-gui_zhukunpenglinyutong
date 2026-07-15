// modes — English UI strings
const modes = {
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
};

export default modes;
