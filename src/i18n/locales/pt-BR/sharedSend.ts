// sharedSend — Strings de UI em português (Wave 4 / Change B §14.5 máquina de estados)
const sharedSend = {
  sharedSend: {
    preparingContext: "Preparando o contexto da sessão compartilhada…",
    degradedTitle: "Contexto degradado",
    degradedHint:
      "A projeção de contexto tem omissões. O turno não será enviado sem a sua confirmação.",
    degradedConfirm: "Continuar enviando",
    degradedDetails: "Ver detalhes",
    degradedMode: "Modo de transferência: {{mode}}",
    degradedTokenEstimate:
      "Tamanho estimado do contexto: {{source}} → {{package}} tokens",
    unknownDetail: "Valor de protocolo não reconhecido: {{value}}",
    modeNativeDelta: "Contexto incremental nativo",
    modeNativeHistoryImport: "Importação do histórico nativo",
    modeNativeHistoryClone: "Clonagem da sessão nativa",
    modePortableTranscript: "Transcrição portátil",
    modeCheckpoint: "Ponto de verificação comprimido",
    dispositionRetrievable: "Recuperável sob demanda",
    dispositionNotRetrievable: "Não recuperável",
    omissionImageHistory:
      "O histórico de destino não oferece suporte a imagens.",
    omissionAssistantOutcome:
      "O turno do assistente terminou como {{outcome}} e não será reproduzido como bem-sucedido.",
    omissionPrivateReasoning:
      "O raciocínio privado do provedor não pode ser transferido.",
    omissionAssistantArtifact:
      "Os artefatos do assistente permanecem como referências e não são inseridos como texto.",
    omissionPrivateBlock:
      "Um bloco privado não compatível do assistente foi omitido.",
    omissionToolHistory:
      "As chamadas de ferramentas e seus resultados foram omitidos juntos porque o destino não oferece suporte ao histórico.",
    omissionHistoricalControl:
      "As ações de controle históricas são apenas referências e não serão executadas novamente.",
    omissionDeterministicFold:
      "O conteúdo longo foi condensado para caber no limite de contexto.",
    omissionCheckpointBudget:
      "O turno completo mais antigo foi omitido para caber no limite de contexto.",
    omissionDestinationOwned:
      "O conteúdo já presente no histórico nativo de destino não foi duplicado.",
    omissionUnknown: "Omissão não reconhecida ({{category}}): {{reason}}",
    outcomeCompleted: "concluído",
    outcomeFailed: "falhou",
    outcomeCancelled: "cancelado",
    outcomeReplaced: "substituído",
    outcomeUnknown: "desconhecido",
    awaitingAcceptance:
      "Solicitação enviada. Aguardando a CLI confirmar o início do processamento…",
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
    selectionPersistFailedTitle: "O destino selecionado não foi salvo",
    selectionPersistFailedMessage:
      "A seleção atual permanece na memória, mas a reinicialização pode restaurar o destino anterior: {{reason}}",
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
