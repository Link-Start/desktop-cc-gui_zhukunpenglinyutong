// sharedSend — Cadenas de UI en español (Wave 4 / Change B §14.5 máquina de estados)
const sharedSend = {
  sharedSend: {
    preparingContext: "Preparando el contexto de la sesión compartida…",
    degradedTitle: "Contexto degradado",
    degradedHint:
      "La proyección del contexto tiene omisiones. El turno no se enviará sin tu confirmación.",
    degradedConfirm: "Continuar con el envío",
    degradedDetails: "Ver detalles",
    degradedMode: "Modo de transferencia: {{mode}}",
    degradedTokenEstimate:
      "Tamaño de contexto estimado: {{source}} → {{package}} tokens",
    unknownDetail: "Valor de protocolo no reconocido: {{value}}",
    modeNativeDelta: "Contexto incremental nativo",
    modeNativeHistoryImport: "Importación del historial nativo",
    modeNativeHistoryClone: "Clonado de sesión nativa",
    modePortableTranscript: "Transcripción portátil",
    modeCheckpoint: "Punto de control comprimido",
    dispositionRetrievable: "Recuperable bajo demanda",
    dispositionNotRetrievable: "No recuperable",
    omissionImageHistory:
      "El historial de destino no admite imágenes.",
    omissionAssistantOutcome:
      "El turno del asistente terminó como {{outcome}} y no se reproducirá como correcto.",
    omissionPrivateReasoning:
      "El razonamiento privado del proveedor no se puede transferir.",
    omissionAssistantArtifact:
      "Los artefactos del asistente quedan como referencias y no se insertan como texto.",
    omissionPrivateBlock:
      "Se omitió un bloque privado del asistente no compatible.",
    omissionToolHistory:
      "Las llamadas y resultados de herramientas se omitieron juntos porque el destino no admite su historial.",
    omissionHistoricalControl:
      "Las acciones de control históricas son solo referencias y no se ejecutarán de nuevo.",
    omissionDeterministicFold:
      "El contenido largo se plegó para ajustarse al límite de contexto.",
    omissionCheckpointBudget:
      "Se omitió el turno completo más antiguo para ajustarse al límite de contexto.",
    omissionDestinationOwned:
      "No se duplicó el contenido ya presente en el historial nativo de destino.",
    omissionUnknown: "Omisión no reconocida ({{category}}): {{reason}}",
    outcomeCompleted: "completado",
    outcomeFailed: "fallido",
    outcomeCancelled: "cancelado",
    outcomeReplaced: "reemplazado",
    outcomeUnknown: "desconocido",
    awaitingAcceptance:
      "Solicitud enviada. Esperando que la CLI confirme el inicio del proceso…",
    cancelUnsupported:
      "Este adaptador no puede cancelar una entrega pendiente; espera el veredicto del runtime.",
    cancelPending: "Confirmando el resultado de la cancelación…",
    settling: "Guardando el resultado…",
    recoveryTitle: "Se requiere recuperación",
    recoveryHint:
      "El último envío tuvo una confirmación ambigua, por lo que esta sesión compartida está bloqueada. Sondea la evidencia durable o reconstruye explícitamente el binding.",
    recoveryProbe: "Sondear",
    recoveryProbing: "Sondeando…",
    recoveryRebuild: "Reconstruir binding",
    recoveryProbeHeld:
      "El sondeo encontró un intento aceptado pero no confirmado. La sesión permanece bloqueada para preservar el orden.",
    recoveryProbeCleared: "El sondeo no encontró intentos pendientes. La sesión está desbloqueada.",
    targetUnavailable: "El target seleccionado no está disponible.",
    targetUnavailableReason: "El target seleccionado no está disponible: {{reason}}",
    selectionPersistFailedTitle: "No se guardó el destino seleccionado",
    selectionPersistFailedMessage:
      "La selección actual se conserva en memoria, pero al reiniciar podría usarse el destino anterior: {{reason}}",
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
    cancel: "Cancelar",
  },
};

export default sharedSend;
