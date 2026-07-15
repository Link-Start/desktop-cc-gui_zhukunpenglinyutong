// errors — Simplified Chinese UI strings
const errors = {
  errors: {
    connectionFailed: "连接失败",
    requestFailed: "请求失败",
    unexpectedError: "发生意外错误",
    sessionExpired: "会话已过期",
    rateLimited: "请求过于频繁，请稍后再试。",
    networkError: "网络错误，请检查您的连接。",
    failedToAddWorkspace: "添加工作区失败。",
    failedToOpenNewWindow: "新建窗口失败。",
    failedToCreateSession: "创建会话失败。",
    failedToCreateSessionNoThreadId: "运行时没有返回新的会话 ID。",
    failedToCreateSessionRuntimeRecovering:
      "创建会话时运行时正在重启。应用已自动重试一次，请重连工作区后再试。",
    reconnectAndRetryCreateSession: "重连并重试创建",
    reconnectingAndRetryingCreateSession: "正在重连并重试创建...",
    runtimeRecovered: "运行时已恢复。",
    retryingCreateSessionAfterRecovery: "正在重新创建会话...",
    cliNotFound: "未找到 Claude Code CLI 或 Codex CLI。请安装其中一个。",
    cliNotFoundHint:
      "安装 Claude Code: npm install -g @anthropic-ai/claude-code\n安装 Codex: npm install -g @openai/codex",
    codexCliNotFound:
      "未找到 Codex CLI。请安装 Codex 并确保 `codex` 在您的 PATH 中。",
    couldntOpenWorkspace: "无法打开工作区",
    dismissError: "关闭错误",
  },
};

export default errors;
