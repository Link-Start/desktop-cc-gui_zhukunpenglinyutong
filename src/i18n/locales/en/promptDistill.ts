// promptDistill — English UI strings
const promptDistill = {
  promptDistill: {
    menuSaveAsPrompt: "Generate Command from Selection",
    menuSaveThreadAsPrompt: "Generate Command from Thread",
    dialogTitle: "Generate Command",
    dialogDescription:
      "Distill the conversation into a reusable slash command. It is saved to this workspace's command directory — afterwards type / in the composer to invoke it. $ARGUMENTS in the template is replaced by the arguments you pass on invocation.",
    nameLabel: "Command name",
    namePlaceholder: "e.g. review-checklist",
    contentLabel: "Command template",
    argumentsHint:
      "Use $ARGUMENTS where the arguments passed to the /command should go.",
    distilling: "Generating command...",
    save: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    nameInvalid:
      "Use lowercase letters, digits, dashes or underscores, starting with a letter or digit.",
    failedTimeout: "Command generation timed out after {{seconds}}s",
    failedEmpty: "The engine returned an empty command template",
    failedGeneric: "Command generation failed",
    savedTitle: "Command saved",
    savedMessage: "Saved as /{{name}} — type / in the composer to invoke it.",
  },
};

export default promptDistill;
