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
    codexProviderWireApiUnsupported:
      '当前 Codex CLI 不支持 wire_api = "chat"。如果该供应商支持 Responses API，请改为 wire_api = "responses"；如果只支持 Chat Completions，请先配置协议转换服务或 router。',
    codexProviderConfigInvalid:
      '该 Codex 供应商配置不是有效的 TOML。请检查语法，并使用英文半角直引号（"），不要使用中文弯引号。',
    reconnectAndRetryCreateSession: "重连并重试创建",
    reconnectingAndRetryingCreateSession: "正在重连并重试创建...",
    runtimeRecovered: "运行时已恢复。",
    retryingCreateSessionAfterRecovery: "正在重新创建会话...",
    cliNotFound: "未找到 Claude Code CLI 或 Codex CLI。请安装其中一个。",
    cliNotFoundHint:
      "安装 Claude Code: curl -fsSL https://claude.ai/install.sh | bash\n安装 Codex: npm install -g @openai/codex",
    codexCliNotFound:
      "未找到 Codex CLI。请安装 Codex 并确保 `codex` 在您的 PATH 中。",
    couldntOpenWorkspace: "无法打开工作区",
    dismissError: "关闭错误",
    applicationErrorTitle: "应用错误",
    applicationErrorDescription:
      "界面因意外错误无法继续显示。请先复制下方诊断信息反馈给开发者，再尝试重新加载应用。",
    applicationErrorReload: "重新加载",
    applicationErrorCopyReport: "一键复制诊断信息",
    applicationErrorCopyDone: "诊断信息已复制，请粘贴到反馈里发给开发者。",
    applicationErrorCopyDownloaded:
      "当前环境无法写入剪贴板，已改为下载诊断文件。反馈时请附上该文件。",
    applicationErrorCopyFailed:
      "复制与下载都失败了。请手动选中下方文本复制后反馈。",
    applicationErrorDetails: "错误详情",
    applicationErrorFeedbackTitle: "如何反馈给开发者",
    applicationErrorFeedbackStep1: "点击「一键复制诊断信息」。",
    applicationErrorFeedbackStep2: "打开反馈页新建 Issue，把诊断信息粘贴进去。",
    applicationErrorFeedbackStep3:
      "补充你当时在做什么（冷启动 / 流式输出 / 切换工作区等），以及重新加载是否恢复。",
    applicationErrorOpenFeedback: "打开反馈页面",
    applicationErrorMeta:
      "版本: {{version}} · 类型: {{errorClass}} · 平台: {{platform}}",
    applicationErrorMessageLabel: "错误信息",
    applicationErrorDecodedLabel: "React #{{code}} 完整含义",
    applicationErrorComponentStackLabel: "组件堆栈",
    applicationErrorStackLabel: "JavaScript 堆栈",
  },
};

export default errors;
