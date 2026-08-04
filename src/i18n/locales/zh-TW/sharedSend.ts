// sharedSend — 繁體中文 UI 文案（Wave 4 / Change B §14.5 UI 狀態機）
const sharedSend = {
  sharedSend: {
    preparingContext: "正在準備共享會話上下文…",
    degradedTitle: "部分上下文未攜帶",
    degradedHint: "部分歷史內容無法安全遷移，確認後才會繼續發送。",
    degradedConfirm: "繼續發送",
    degradedDetails: "查看詳情",
    degradedMode: "傳遞方式：{{mode}}",
    degradedTokenEstimate:
      "估算上下文用量：{{source}} → {{package}} 個權杖",
    unknownDetail: "未識別的協定值：{{value}}",
    modeNativeDelta: "原生增量上下文",
    modeNativeHistoryImport: "原生歷史匯入",
    modeNativeHistoryClone: "原生會話複製",
    modePortableTranscript: "相容文字轉錄",
    modeCheckpoint: "壓縮檢查點",
    dispositionRetrievable: "可按需取回",
    dispositionNotRetrievable: "無法取回",
    omissionImageHistory: "目標歷史不支援圖片，圖片未攜帶。",
    omissionAssistantOutcome:
      "助手輪次以「{{outcome}}」結束，不會作為成功回覆重播。",
    omissionPrivateReasoning: "供應商私有思考內容無法遷移。",
    omissionAssistantArtifact: "助手產物僅保留引用，不會作為正文注入。",
    omissionPrivateBlock: "不受支援的助手私有內容區塊已省略。",
    omissionToolHistory:
      "目標不支援工具歷史，工具呼叫與結果已成對省略。",
    omissionHistoricalControl: "歷史控制操作僅保留引用，不會再次執行。",
    omissionDeterministicFold: "長內容已折疊，以符合上下文容量限制。",
    omissionCheckpointBudget:
      "最早的完整輪次已省略，以符合上下文容量限制。",
    omissionDestinationOwned:
      "目標原生歷史已有該內容，不再重複攜帶。",
    omissionUnknown: "未識別的省略項（{{category}}）：{{reason}}",
    outcomeCompleted: "完成",
    outcomeFailed: "失敗",
    outcomeCancelled: "已取消",
    outcomeReplaced: "已取代",
    outcomeUnknown: "未知",
    awaitingAcceptance: "請求已傳送，正在確認 CLI 是否開始處理…",
    cancelUnsupported: "目前執行方式不支援取消待確認的投遞，請等待接收結果。",
    cancelPending: "正在確認取消結果…",
    settling: "正在儲存結果…",
    recoveryTitle: "需要恢復",
    recoveryHint:
      "上一次發送的接收結果不確定，已鎖定本會話。請檢查狀態、停止投遞、停止並重建，或放棄本輪。",
    recoveryProbe: "檢查狀態",
    recoveryProbing: "正在檢查…",
    recoveryRebuild: "重建會話連線",
    recoveryProbeHeld:
      "檢查發現發送已被接收，但結果尚未儲存；為確保順序，繼續保持鎖定。",
    recoveryProbeCleared: "未發現待處理的發送，已解除鎖定。",
    targetUnavailable: "目前發送目標不可用。",
    targetUnavailableReason: "目前發送目標不可用：{{reason}}",
    selectionPersistFailedTitle: "發送目標儲存失敗",
    selectionPersistFailedMessage:
      "目前選擇仍然有效，但重新啟動恢復時可能使用上一次發送目標：{{reason}}",
    recoveryStop: "停止投遞",
    recoveryStopHint:
      "請求執行環境停止進行中的投遞。停止成功後會話仍保持鎖定，需再檢查、重建或放棄本輪以完成解鎖。",
    recoveryStopAndRebuild: "停止並重建",
    recoveryStopAndRebuildHint:
      "必要時先停止執行環境仍占用的投遞，再封存舊連線並準備新的會話連線。",
    recoveryAbandon: "放棄本輪",
    recoveryAbandonHint:
      "將未決輪次持久標記為已取消並解鎖會話。不會刪除整條對話。",
    recoveryAbandonConfirm:
      "確定放棄本輪未決發送並解鎖共用會話嗎？該輪次將標記為已取消，對話本身會保留。",
    recoveryStopNoAttempt:
      "目前沒有可停止的進行中投遞。請改用檢查狀態、重建連線或放棄本輪。",
    recoveryHintAfterStop:
      "已請求停止投遞。請繼續檢查狀態、停止並重建，或放棄本輪以完成解鎖。",
    recoveryErrorActive:
      "執行環境仍占用該輪次。請先停止投遞再重建，或使用「放棄本輪」。",
    recoveryErrorActiveRequiresStop:
      "執行環境仍占用該輪次。請先停止投遞再放棄，或在放棄時確認強制停止。",
    recoveryErrorAmbiguous:
      "發現多個未決占用，無法安全自動處理。若持續出現，請攜帶會話資訊聯繫支援。",
    recoveryErrorOwnerMissing:
      "未找到對應的未決輪次。請再檢查狀態；會話可能已經可以繼續。",
    recoveryErrorEmptyContextHandoff:
      "無法為目前目標重建共享上下文（歷史可能不完整）。請嘗試停止並重建連線，或切換可用目標後重送。",
    recoveryTechDetail: "可查看技術詳情",
    targetUnavailableHint: "請在選擇器中更換目標後重新發送。",
    cancel: "取消",
  },
};

export default sharedSend;
