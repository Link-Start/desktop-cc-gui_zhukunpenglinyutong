// sharedSend — Cadenas de UI en español (Wave 4 / Change B §14.5 máquina de estados)
const sharedSend = {
  sharedSend: {
    preparingContext: "Preparando el contexto de la sesión compartida…",
    degradedTitle: "Contexto degradado",
    degradedHint:
      "La proyección del contexto tiene omissions. El turno no se enviará sin tu confirmación.",
    degradedConfirm: "Enviar de todos modos",
    awaitingAcceptance: "Entregando… esperando la confirmación de recepción del runtime.",
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
    cancel: "Cancelar",
  },
};

export default sharedSend;
