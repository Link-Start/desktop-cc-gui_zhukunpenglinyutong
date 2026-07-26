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
  },
};

export default errors;
