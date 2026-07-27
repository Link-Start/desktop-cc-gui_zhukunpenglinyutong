// sharedSend — 繁體中文 UI 文案（Wave 4 / Change B §14.5 UI 狀態機）
const sharedSend = {
  sharedSend: {
    preparingContext: "正在為 Shared Session 準備上下文…",
    degradedTitle: "上下文降級",
    degradedHint: "上下文投影存在 omissions，未經確認不會發送。",
    degradedConfirm: "仍然發送",
    awaitingAcceptance: "正在交付，尚未確認接收。",
    cancelUnsupported: "目前 Adapter 不支援取消待確認投遞，請等待執行側定性。",
    cancelPending: "正在確認取消結果…",
    settling: "正在儲存結果…",
    recoveryTitle: "需要恢復",
    recoveryHint:
      "上一次發送的接收結果不確定，已鎖定本會話。請先 Probe 定性，或顯式重建 Binding。",
    recoveryProbe: "Probe",
    recoveryProbing: "正在 Probe…",
    recoveryRebuild: "顯式重建 Binding",
    recoveryProbeHeld: "Probe 發現已接受但未落賬的 Attempt，為保序保持鎖定。",
    recoveryProbeCleared: "Probe 未發現待處理 Attempt，已解除鎖定。",
    targetUnavailable: "目前 Target 不可用。",
    targetUnavailableReason: "目前 Target 不可用：{{reason}}",
    cancel: "取消",
  },
};

export default sharedSend;
