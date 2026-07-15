// rewind — English UI strings
const rewind = {
  rewind: {
    title: "Rewind Files to Previous State",
    tooltip: "Rewind",
    label: "Rewind",
    tooltipFull: "Restore files to their state at this message",
    notAvailable: "Rewind is not available in this session",
    noEligibleMessage: "No rewindable user messages were found.",
    selectPrompt: "Select a rewind target (1-{{count}}):",
    invalidSelection: "Invalid rewind selection.",
    confirmPrompt: 'Create a new thread from this message?\n"{{preview}}"',
    dialogTitle: "Confirm {{engine}} rewind",
    dialogDescription:
      "Clicking rewind now only opens this confirmation dialog first. The rewind runs only after you explicitly confirm.",
    targetSectionTitle: "Rewind starting point",
    targetMessageLabel: "This rewind will roll back from this user message",
    impactSectionTitle: "What will be removed",
    impactUserMessages: "User messages removed",
    impactAssistantMessages: "Assistant replies removed",
    impactToolCalls: "Tool calls removed",
    impactFiles: "Files involved",
    impactSummary:
      "After confirmation, the current linear history will roll back from this user message. That includes this user message and all later assistant replies, tool calls, and related changes.",
    impactFollowUp:
      "If files are listed below, their changes happened inside the history segment that will be rewound. Review them before confirming.",
    workspaceRestoreSectionTitle: "Workspace file strategy",
    modeMessagesAndFilesLabel: "Rewind messages + files",
    modeMessagesAndFilesHint:
      "Rewind the conversation history and restore the related workspace file changes together.",
    modeMessagesOnlyLabel: "Messages only",
    modeMessagesOnlyHint:
      "Only rewind conversation history and leave current workspace files untouched.",
    modeFilesOnlyLabel: "Files only",
    modeFilesOnlyHint:
      "Only restore the related files and keep the current conversation history unchanged.",
    filesSectionTitle: "Affected files",
    filesRailTitle: "Files",
    filesEmpty:
      "No file changes were detected in the history segment being rewound.",
    filesHint:
      "This is a best-effort frontend summary of detected file changes so you can confirm the blast radius before proceeding.",
    diffEmpty:
      "No diff preview is available for this file. You can still review other files or open the main diff panel.",
    openDiffAction: "Open In Diff Panel",
    storeAction: "Store Changes",
    storeActionBusy: "Storing...",
    storeUnavailable:
      "The current rewind context does not include enough session information to store changes.",
    storeFailed: "Failed to store changes.",
    storeRevealFailed: "Failed to open the stored changes directory.",
    storeRevealAction: "Open Folder",
    storeSuccessTitle:
      "Stored {{count}} file(s) and generated a reusable manifest snapshot.",
    storeSuccessPrefix: "Saved to: ",
    confirmAction: "Confirm rewind",
    confirmActionBusy: "Rewinding...",
    failed: "Failed to rewind conversation.",
  },
};

export default rewind;
