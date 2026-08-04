// sharedSend — Строки UI на русском (Wave 4 / Change B §14.5 конечный автомат)
const sharedSend = {
  sharedSend: {
    preparingContext: "Подготовка контекста общей сессии…",
    degradedTitle: "Деградированный контекст",
    degradedHint:
      "Проекция контекста содержит пропуски. Ход не будет отправлен без вашего подтверждения.",
    degradedConfirm: "Продолжить отправку",
    degradedDetails: "Показать подробности",
    degradedMode: "Способ переноса: {{mode}}",
    degradedTokenEstimate:
      "Оценка размера контекста: {{source}} → {{package}} токенов",
    unknownDetail: "Неизвестное значение протокола: {{value}}",
    modeNativeDelta: "Нативный добавочный контекст",
    modeNativeHistoryImport: "Импорт нативной истории",
    modeNativeHistoryClone: "Клонирование нативной сессии",
    modePortableTranscript: "Переносимая расшифровка",
    modeCheckpoint: "Сжатая контрольная точка",
    dispositionRetrievable: "Можно получить по запросу",
    dispositionNotRetrievable: "Нельзя получить",
    omissionImageHistory:
      "История назначения не поддерживает изображения.",
    omissionAssistantOutcome:
      "Ход ассистента завершился со статусом {{outcome}} и не будет воспроизведён как успешный.",
    omissionPrivateReasoning:
      "Закрытые рассуждения провайдера нельзя перенести.",
    omissionAssistantArtifact:
      "Артефакты ассистента остаются ссылками и не вставляются как текст.",
    omissionPrivateBlock:
      "Неподдерживаемый закрытый блок ассистента был пропущен.",
    omissionToolHistory:
      "Вызовы инструментов и результаты пропущены вместе, потому что назначение не поддерживает их историю.",
    omissionHistoricalControl:
      "Исторические управляющие действия доступны только по ссылке и не будут выполнены снова.",
    omissionDeterministicFold:
      "Длинное содержимое свёрнуто, чтобы уложиться в лимит контекста.",
    omissionCheckpointBudget:
      "Самый старый полный ход пропущен, чтобы уложиться в лимит контекста.",
    omissionDestinationOwned:
      "Содержимое, уже присутствующее в нативной истории назначения, не дублировалось.",
    omissionUnknown: "Неизвестный пропуск ({{category}}): {{reason}}",
    outcomeCompleted: "завершён",
    outcomeFailed: "ошибка",
    outcomeCancelled: "отменён",
    outcomeReplaced: "заменён",
    outcomeUnknown: "неизвестен",
    awaitingAcceptance:
      "Запрос отправлен. Ожидается подтверждение начала обработки от CLI…",
    cancelUnsupported:
      "Этот адаптер не может отменить ожидающую доставку; дождитесь вердикта runtime.",
    cancelPending: "Подтверждение результата отмены…",
    settling: "Сохранение результата…",
    recoveryTitle: "Требуется восстановление",
    recoveryHint:
      "У последней отправки неоднозначное подтверждение, поэтому эта общая сессия заблокирована. Выполните probe устойчивых данных или явно пересоздайте binding.",
    recoveryProbe: "Probe",
    recoveryProbing: "Выполняется probe…",
    recoveryRebuild: "Пересоздать binding",
    recoveryProbeHeld:
      "Probe нашёл принятую, но незафиксированную попытку. Сессия остаётся заблокированной ради порядка.",
    recoveryProbeCleared: "Probe не нашёл ожидающих попыток. Сессия разблокирована.",
    targetUnavailable: "Выбранная цель недоступна.",
    targetUnavailableReason: "Выбранная цель недоступна: {{reason}}",
    selectionPersistFailedTitle: "Выбранная цель не сохранена",
    selectionPersistFailedMessage:
      "Текущий выбор сохранён в памяти, но после перезапуска может использоваться предыдущая цель: {{reason}}",
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
    recoveryErrorEmptyContextHandoff:
      "Shared context could not be rebuilt for this target (history may be incomplete). Stop and rebuild the session connection, or switch to another available target and resend.",
    recoveryTechDetail: "technical detail available",
    targetUnavailableHint: "Switch to another target in the picker, then send again.",
    cancel: "Отмена",
  },
};

export default sharedSend;
