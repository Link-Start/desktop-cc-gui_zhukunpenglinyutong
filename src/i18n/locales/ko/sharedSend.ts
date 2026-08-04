// sharedSend — 한국어 UI 문자열 (Wave 4 / Change B §14.5 UI 상태 기계)
const sharedSend = {
  sharedSend: {
    preparingContext: "Shared Session 컨텍스트를 준비하는 중…",
    degradedTitle: "컨텍스트 저하",
    degradedHint: "컨텍스트 프로젝션에 omissions가 있습니다. 확인 없이는 전송되지 않습니다.",
    degradedConfirm: "계속 전송",
    degradedDetails: "세부 정보 보기",
    degradedMode: "전달 방식: {{mode}}",
    degradedTokenEstimate:
      "예상 컨텍스트 크기: {{source}} → {{package}} 토큰",
    unknownDetail: "인식되지 않은 프로토콜 값: {{value}}",
    modeNativeDelta: "네이티브 증분 컨텍스트",
    modeNativeHistoryImport: "네이티브 기록 가져오기",
    modeNativeHistoryClone: "네이티브 세션 복제",
    modePortableTranscript: "호환 텍스트 기록",
    modeCheckpoint: "압축 체크포인트",
    dispositionRetrievable: "필요할 때 복구 가능",
    dispositionNotRetrievable: "복구 불가",
    omissionImageHistory:
      "대상 기록이 이미지를 지원하지 않습니다.",
    omissionAssistantOutcome:
      "어시스턴트 턴이 {{outcome}} 상태로 끝나 성공 응답으로 재생되지 않습니다.",
    omissionPrivateReasoning:
      "공급자 비공개 추론은 전달할 수 없습니다.",
    omissionAssistantArtifact:
      "어시스턴트 산출물은 참조로만 유지되며 본문으로 삽입되지 않습니다.",
    omissionPrivateBlock:
      "지원되지 않는 어시스턴트 비공개 블록을 생략했습니다.",
    omissionToolHistory:
      "대상이 도구 기록을 지원하지 않아 도구 호출과 결과를 함께 생략했습니다.",
    omissionHistoricalControl:
      "과거 제어 작업은 참조 전용이며 다시 실행되지 않습니다.",
    omissionDeterministicFold:
      "컨텍스트 한도에 맞추기 위해 긴 내용을 접었습니다.",
    omissionCheckpointBudget:
      "컨텍스트 한도에 맞추기 위해 가장 오래된 전체 턴을 생략했습니다.",
    omissionDestinationOwned:
      "대상 네이티브 기록에 이미 있는 내용은 중복하지 않았습니다.",
    omissionUnknown: "인식되지 않은 누락 항목({{category}}): {{reason}}",
    outcomeCompleted: "완료",
    outcomeFailed: "실패",
    outcomeCancelled: "취소됨",
    outcomeReplaced: "대체됨",
    outcomeUnknown: "알 수 없음",
    awaitingAcceptance: "요청을 보냈습니다. CLI의 처리 시작을 확인하는 중입니다…",
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
    selectionPersistFailedTitle: "선택한 전송 대상을 저장하지 못했습니다",
    selectionPersistFailedMessage:
      "현재 선택은 메모리에 유지되지만 다시 시작하면 이전 전송 대상이 사용될 수 있습니다: {{reason}}",
    recoveryStop: "Stop delivery",
    recoveryStopHint: "Ask the runtime to stop the in-flight attempt. The session stays locked until you settle or rebuild.",
    recoveryStopAndRebuild: "Stop and rebuild",
    recoveryStopAndRebuildHint: "Stop the runtime-owned attempt when needed, then archive the binding and prepare a new connection.",
    recoveryAbandon: "Abandon this turn",
    recoveryAbandonHint: "Durably cancel the unresolved turn and unlock the session. Does not delete the conversation.",
    recoveryAbandonConfirm: "Abandon this unresolved turn and unlock the shared session? The turn will be marked cancelled. The conversation itself is kept.",
    recoveryStopNoAttempt: "No in-flight attempt to stop. Use check status, rebuild, or abandon instead.",
    recoveryHintAfterStop: "Delivery stop was requested. Check status, stop and rebuild, or abandon this turn to finish unlocking.",
    recoveryErrorActive: "The runtime still owns this attempt. Stop delivery first, then rebuild—or abandon this turn.",
    recoveryErrorActiveRequiresStop: "The runtime still owns this attempt. Stop delivery before abandoning, or confirm force-stop when abandoning.",
    recoveryErrorAmbiguous: "Multiple unresolved owners were found. Recovery cannot safely continue automatically; contact support with session details if this persists.",
    recoveryErrorOwnerMissing: "No matching unresolved attempt was found. Try check status; the session may already be clear.",
    recoveryTechDetail: "technical detail available",
    targetUnavailableHint: "Switch to another target in the picker, then send again.",
    cancel: "취소",
  },
};

export default sharedSend;
