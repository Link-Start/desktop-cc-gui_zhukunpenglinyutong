// sharedSend — Strings de UI em português (Wave 4 / Change B §14.5 máquina de estados)
const sharedSend = {
  sharedSend: {
    preparingContext: "Preparando o contexto da sessão compartilhada…",
    degradedTitle: "Contexto degradado",
    degradedHint:
      "A projeção de contexto tem omissions. O turno não será enviado sem a sua confirmação.",
    degradedConfirm: "Enviar mesmo assim",
    awaitingAcceptance: "Entregando… aguardando a confirmação de recebimento do runtime.",
    cancelUnsupported:
      "Este adaptador não pode cancelar uma entrega pendente; aguarde o veredito do runtime.",
    cancelPending: "Confirmando o resultado do cancelamento…",
    settling: "Salvando o resultado…",
    recoveryTitle: "Recuperação necessária",
    recoveryHint:
      "O último envio teve uma confirmação ambígua, então esta sessão compartilhada está bloqueada. Probe a evidência durável ou reconstrua explicitamente o binding.",
    recoveryProbe: "Probe",
    recoveryProbing: "Probing…",
    recoveryRebuild: "Reconstruir binding",
    recoveryProbeHeld:
      "O probe encontrou uma tentativa aceita mas não confirmada. A sessão permanece bloqueada para preservar a ordem.",
    recoveryProbeCleared: "O probe não encontrou tentativas pendentes. A sessão foi desbloqueada.",
    targetUnavailable: "O target selecionado está indisponível.",
    targetUnavailableReason: "O target selecionado está indisponível: {{reason}}",
    cancel: "Cancelar",
  },
};

export default sharedSend;
