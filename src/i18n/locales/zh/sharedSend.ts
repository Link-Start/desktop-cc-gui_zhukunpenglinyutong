// sharedSend — 简体中文 UI 文案（Wave 4 / Change B §14.5 UI 状态机）
const sharedSend = {
  sharedSend: {
    preparingContext: "正在为 Shared Session 准备上下文…",
    degradedTitle: "上下文降级",
    degradedHint: "上下文投影存在 omissions，未经确认不会发送。",
    degradedConfirm: "仍然发送",
    awaitingAcceptance: "正在交付，尚未确认接收。",
    cancelUnsupported: "当前 Adapter 不支持取消待确认投递，请等待运行侧定性。",
    cancelPending: "正在确认取消结果…",
    settling: "正在保存结果…",
    recoveryTitle: "需要恢复",
    recoveryHint:
      "上一次发送的接收结果不确定，已锁定本会话。请先 Probe 定性，或显式重建 Binding。",
    recoveryProbe: "Probe",
    recoveryProbing: "正在 Probe…",
    recoveryRebuild: "显式重建 Binding",
    recoveryProbeHeld: "Probe 发现已接受但未落账的 Attempt，为保序保持锁定。",
    recoveryProbeCleared: "Probe 未发现待处理 Attempt，已解除锁定。",
    targetUnavailable: "当前 Target 不可用。",
    targetUnavailableReason: "当前 Target 不可用：{{reason}}",
    cancel: "取消",
  },
};

export default sharedSend;
