// sharedSend — 简体中文 UI 文案（Wave 4 / Change B §14.5 UI 状态机）
const sharedSend = {
  sharedSend: {
    preparingContext: "正在准备共享会话上下文…",
    degradedTitle: "部分上下文未携带",
    degradedHint: "部分历史内容无法安全迁移，确认后才会继续发送。",
    degradedConfirm: "继续发送",
    degradedDetails: "查看详情",
    degradedMode: "传递方式：{{mode}}",
    degradedTokenEstimate:
      "估算上下文用量：{{source}} → {{package}} 个令牌",
    unknownDetail: "未识别的协议值：{{value}}",
    modeNativeDelta: "原生增量上下文",
    modeNativeHistoryImport: "原生历史导入",
    modeNativeHistoryClone: "原生会话克隆",
    modePortableTranscript: "兼容文本转录",
    modeCheckpoint: "压缩检查点",
    dispositionRetrievable: "可按需取回",
    dispositionNotRetrievable: "无法取回",
    omissionImageHistory: "目标历史不支持图片，图片未携带。",
    omissionAssistantOutcome:
      "助手轮次以“{{outcome}}”结束，不会作为成功回复重放。",
    omissionPrivateReasoning: "供应商私有思考内容无法迁移。",
    omissionAssistantArtifact: "助手产物仅保留引用，不会作为正文注入。",
    omissionPrivateBlock: "不受支持的助手私有内容块已省略。",
    omissionToolHistory:
      "目标不支持工具历史，工具调用与结果已成对省略。",
    omissionHistoricalControl: "历史控制操作仅保留引用，不会再次执行。",
    omissionDeterministicFold: "长内容已折叠，以满足上下文容量限制。",
    omissionCheckpointBudget:
      "最早的完整轮次已省略，以满足上下文容量限制。",
    omissionDestinationOwned:
      "目标原生历史已有该内容，不再重复携带。",
    omissionUnknown: "未识别的省略项（{{category}}）：{{reason}}",
    outcomeCompleted: "完成",
    outcomeFailed: "失败",
    outcomeCancelled: "已取消",
    outcomeReplaced: "已替换",
    outcomeUnknown: "未知",
    awaitingAcceptance: "请求已发送，正在确认 CLI 是否开始处理…",
    cancelUnsupported: "当前执行方式不支持取消待确认的投递，请等待接收结果。",
    cancelPending: "正在确认取消结果…",
    settling: "正在保存结果…",
    recoveryTitle: "需要恢复",
    recoveryHint:
      "上一次发送的接收结果不确定，已锁定本会话。请检查状态、停止投递、停止并重建，或放弃本轮。",
    recoveryProbe: "检查状态",
    recoveryProbing: "正在检查…",
    recoveryRebuild: "重建会话连接",
    recoveryStop: "停止投递",
    recoveryStopHint:
      "请求运行时停止正在进行的投递。停止后会话仍保持锁定，需继续结算或重建。",
    recoveryStopAndRebuild: "停止并重建",
    recoveryStopAndRebuildHint:
      "必要时先停止运行时仍占用的投递，再归档旧连接并准备新的会话连接。",
    recoveryAbandon: "放弃本轮",
    recoveryAbandonHint:
      "将未决轮次持久标记为已取消并解锁会话。不会删除整条对话。",
    recoveryAbandonConfirm:
      "确定放弃本轮未决发送并解锁共享会话吗？该轮次将标记为已取消，对话本身会保留。",
    recoveryStopNoAttempt:
      "当前没有可停止的进行中投递。请改用检查状态、重建连接或放弃本轮。",
    recoveryHintAfterStop:
      "已请求停止投递。请继续检查状态、停止并重建，或放弃本轮以完成解锁。",
    recoveryProbeHeld:
      "检查发现发送已被接收，但结果尚未保存；为保证顺序，继续保持锁定。",
    recoveryProbeCleared: "未发现待处理的发送，已解除锁定。",
    recoveryErrorActive:
      "运行时仍占用该次投递。请先停止投递再重建连接，或放弃本轮。",
    recoveryErrorActiveRequiresStop:
      "运行时仍占用该次投递。请先停止投递再放弃，或在放弃时确认强制停止。",
    recoveryErrorAmbiguous:
      "检测到多个未决发送，无法安全自动恢复；若持续出现请联系支持并提供会话详情。",
    recoveryErrorOwnerMissing:
      "未找到匹配的未决投递。请尝试检查状态，会话可能已解锁。",
    recoveryErrorEmptyContextHandoff:
      "无法为当前目标重建共享上下文（历史可能不完整）。请尝试停止并重建会话连接，或切换可用目标后重发。",
    recoveryTechDetail: "可查看技术详情",
    targetUnavailable: "当前发送目标不可用。",
    targetUnavailableReason: "当前发送目标不可用：{{reason}}",
    targetUnavailableHint: "请在目标选择器中切换到其他可用目标，然后重新发送。",
    selectionPersistFailedTitle: "发送目标保存失败",
    selectionPersistFailedMessage:
      "当前选择仍然有效，但重启恢复时可能使用上一次发送目标：{{reason}}",
    cancel: "取消",
  },
};

export default sharedSend;
