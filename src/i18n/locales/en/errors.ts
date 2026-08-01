// errors — English UI strings
const errors = {
  errors: {
    connectionFailed: "Connection failed",
    requestFailed: "Request failed",
    unexpectedError: "An unexpected error occurred",
    sessionExpired: "Session expired",
    rateLimited: "Rate limited. Please try again later.",
    networkError: "Network error. Please check your connection.",
    failedToAddWorkspace: "Failed to add workspace.",
    failedToOpenNewWindow: "Failed to open a new window.",
    failedToCreateSession: "Failed to create session.",
    failedToCreateSessionNoThreadId:
      "The runtime did not return a new session id.",
    failedToCreateSessionRuntimeRecovering:
      "The runtime was restarting while creating this session. The app already retried once. Reconnect the workspace and try again.",
    codexProviderWireApiUnsupported:
      'The current Codex CLI does not support wire_api = "chat". If this provider supports the Responses API, use wire_api = "responses". If it only supports Chat Completions, configure a protocol conversion service or router first.',
    codexProviderConfigInvalid:
      "This Codex provider configuration is not valid TOML. Check the syntax and use straight English half-width quotes (\") instead of smart quotes.",
    reconnectAndRetryCreateSession: "Reconnect and retry creation",
    reconnectingAndRetryingCreateSession:
      "Reconnecting and retrying creation...",
    runtimeRecovered: "Runtime recovered.",
    retryingCreateSessionAfterRecovery: "Retrying session creation...",
    cliNotFound:
      "Neither Claude Code CLI nor Codex CLI was found. Please install one of them.",
    cliNotFoundHint:
      "Install Claude Code: curl -fsSL https://claude.ai/install.sh | bash\nInstall Codex: npm install -g @openai/codex",
    codexCliNotFound:
      "Codex CLI not found. Install Codex and ensure `codex` is on your PATH.",
    couldntOpenWorkspace: "Couldn't open workspace",
    dismissError: "Dismiss error",
    applicationErrorTitle: "Application Error",
    applicationErrorDescription:
      "An unexpected error stopped the UI. Copy the diagnostic report below, send it to the developers, then reload the app.",
    applicationErrorReload: "Reload",
    applicationErrorCopyReport: "Copy error report",
    applicationErrorCopyDone: "Error report copied. Paste it into your feedback.",
    applicationErrorCopyDownloaded:
      "Clipboard unavailable. A report file was downloaded instead — attach it when you report the issue.",
    applicationErrorCopyFailed:
      "Could not copy or download the report. Select the text below and copy it manually.",
    applicationErrorDetails: "Error details",
    applicationErrorFeedbackTitle: "How to report this to developers",
    applicationErrorFeedbackStep1: "Click “Copy error report”.",
    applicationErrorFeedbackStep2:
      "Open the feedback page and create a new issue, then paste the report.",
    applicationErrorFeedbackStep3:
      "Add what you were doing (cold start / streaming / switching workspace, etc.) and whether Reload recovers it.",
    applicationErrorOpenFeedback: "Open feedback page",
    applicationErrorMeta:
      "version: {{version}} · class: {{errorClass}} · platform: {{platform}}",
    applicationErrorMessageLabel: "Error message",
    applicationErrorDecodedLabel: "Decoded React #{{code}}",
    applicationErrorComponentStackLabel: "Component stack",
    applicationErrorStackLabel: "JavaScript stack",
  },
};

export default errors;
