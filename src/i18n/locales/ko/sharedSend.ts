// sharedSend — 한국어 UI 문자열 (Wave 4 / Change B §14.5 UI 상태 기계)
const sharedSend = {
  sharedSend: {
    preparingContext: "Shared Session 컨텍스트를 준비하는 중…",
    degradedTitle: "컨텍스트 저하",
    degradedHint: "컨텍스트 프로젝션에 omissions가 있습니다. 확인 없이는 전송되지 않습니다.",
    degradedConfirm: "그래도 전송",
    awaitingAcceptance: "전달 중… 런타임의 수신 확인을 기다리는 중입니다.",
    cancelUnsupported:
      "이 Adapter는 대기 중인 전달을 취소할 수 없습니다. 런타임 판정을 기다려 주세요.",
    cancelPending: "취소 결과를 확인하는 중…",
    settling: "결과를 저장하는 중…",
    recoveryTitle: "복구 필요",
    recoveryHint:
      "마지막 전송의 수신 결과가 불확실하여 이 세션이 잠겼습니다. Probe로 확정하거나 Binding을 명시적으로 재구축하세요.",
    recoveryProbe: "Probe",
    recoveryProbing: "Probe 중…",
    recoveryRebuild: "Binding 재구축",
    recoveryProbeHeld:
      "Probe가 수락됐지만 커밋되지 않은 Attempt를 발견했습니다. 순서 보존을 위해 잠금을 유지합니다.",
    recoveryProbeCleared: "Probe에서 대기 중인 Attempt가 없습니다. 잠금을 해제했습니다.",
    targetUnavailable: "선택한 Target을 사용할 수 없습니다.",
    targetUnavailableReason: "선택한 Target을 사용할 수 없습니다: {{reason}}",
    cancel: "취소",
  },
};

export default sharedSend;
