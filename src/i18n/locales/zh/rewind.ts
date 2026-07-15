// rewind — Simplified Chinese UI strings
const rewind = {
  rewind: {
    title: "回溯文件到之前的状态",
    tooltip: "回溯",
    label: "回溯",
    tooltipFull: "将文件恢复到此消息时的状态",
    notAvailable: "当前会话不支持回溯",
    noEligibleMessage: "未找到可回溯的用户消息。",
    selectPrompt: "请选择回溯目标（1-{{count}}）：",
    invalidSelection: "回溯目标选择无效。",
    confirmPrompt: "将基于该消息创建新线程并回溯：\n“{{preview}}”",
    dialogTitle: "确认回溯 {{engine}} 会话",
    dialogDescription:
      "点击回溯后现在只会先打开确认弹窗。只有你明确点击确认，才会真正执行回溯。",
    targetSectionTitle: "本次回溯起点",
    targetMessageLabel: "将从这条用户消息开始整体回退",
    impactSectionTitle: "回溯影响范围",
    impactUserMessages: "将移除的用户消息",
    impactAssistantMessages: "将移除的助手回复",
    impactToolCalls: "将移除的工具调用",
    impactFiles: "涉及文件",
    impactSummary:
      "确认后，会从这条用户消息开始整体回退。也就是这条用户消息，以及它后面的助手回复、工具调用和相关变更，都会从当前线性历史里移除。",
    impactFollowUp:
      "如果下面列出了文件，表示这些文件对应的变更发生在将被回退的这段历史里，确认前请先核对。",
    workspaceRestoreSectionTitle: "工作区文件策略",
    modeMessagesAndFilesLabel: "回退消息 + 相关文件",
    modeMessagesAndFilesHint:
      "同时回退当前会话历史和这段历史对应的工作区文件变更。",
    modeMessagesOnlyLabel: "只回退消息",
    modeMessagesOnlyHint: "只回退会话历史，不改写当前工作区中的文件内容。",
    modeFilesOnlyLabel: "只回退文件",
    modeFilesOnlyHint: "只恢复这段历史对应的文件，不改写当前会话消息历史。",
    filesSectionTitle: "受影响文件",
    filesRailTitle: "文件列表",
    filesEmpty: "这段回溯历史里没有识别到文件变更。",
    filesHint: "这里只展示前端当前能识别到的文件变更摘要，用来帮助你确认风险。",
    diffEmpty:
      "当前文件没有可用的 diff 预览，你仍然可以继续核对其他文件或直接进入主 Diff 面板。",
    openDiffAction: "在 Diff 面板打开",
    storeAction: "存储变更",
    storeActionBusy: "正在存储...",
    storeUnavailable: "当前回溯上下文缺少可用的会话信息，暂时无法存储变更。",
    storeFailed: "存储变更失败。",
    storeRevealFailed: "打开存储目录失败。",
    storeRevealAction: "打开目录",
    storeSuccessTitle: "已存储 {{count}} 个文件，并生成 manifest 存档。",
    storeSuccessPrefix: "已保存到：",
    confirmAction: "确认回溯",
    confirmActionBusy: "正在回溯...",
    failed: "回溯会话失败。",
  },
};

export default rewind;
