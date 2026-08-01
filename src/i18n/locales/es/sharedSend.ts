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
    cancel: "Cancelar",
  },
};

export default sharedSend;
