// sharedSend — Chaînes d'UI en français (Wave 4 / Change B §14.5 machine à états)
const sharedSend = {
  sharedSend: {
    preparingContext: "Préparation du contexte de la session partagée…",
    degradedTitle: "Contexte dégradé",
    degradedHint:
      "La projection du contexte comporte des omissions. Le tour ne sera pas envoyé sans votre confirmation.",
    degradedConfirm: "Continuer l’envoi",
    degradedDetails: "Voir les détails",
    degradedMode: "Mode de transfert : {{mode}}",
    degradedTokenEstimate:
      "Taille de contexte estimée : {{source}} → {{package}} jetons",
    unknownDetail: "Valeur de protocole non reconnue : {{value}}",
    modeNativeDelta: "Contexte incrémental natif",
    modeNativeHistoryImport: "Import de l’historique natif",
    modeNativeHistoryClone: "Clonage de session native",
    modePortableTranscript: "Transcription portable",
    modeCheckpoint: "Point de contrôle compressé",
    dispositionRetrievable: "Récupérable à la demande",
    dispositionNotRetrievable: "Non récupérable",
    omissionImageHistory:
      "L’historique de destination ne prend pas en charge les images.",
    omissionAssistantOutcome:
      "Le tour de l’assistant s’est terminé avec l’état {{outcome}} et ne sera pas rejoué comme réussi.",
    omissionPrivateReasoning:
      "Le raisonnement privé du fournisseur ne peut pas être transféré.",
    omissionAssistantArtifact:
      "Les artefacts de l’assistant restent des références et ne sont pas injectés comme texte.",
    omissionPrivateBlock:
      "Un bloc privé non pris en charge de l’assistant a été omis.",
    omissionToolHistory:
      "Les appels d’outils et leurs résultats ont été omis ensemble, car la destination ne prend pas en charge leur historique.",
    omissionHistoricalControl:
      "Les actions de contrôle historiques sont uniquement référencées et ne seront pas réexécutées.",
    omissionDeterministicFold:
      "Le contenu long a été replié pour respecter la limite de contexte.",
    omissionCheckpointBudget:
      "Le tour complet le plus ancien a été omis pour respecter la limite de contexte.",
    omissionDestinationOwned:
      "Le contenu déjà présent dans l’historique natif de destination n’a pas été dupliqué.",
    omissionUnknown: "Omission non reconnue ({{category}}) : {{reason}}",
    outcomeCompleted: "terminé",
    outcomeFailed: "échoué",
    outcomeCancelled: "annulé",
    outcomeReplaced: "remplacé",
    outcomeUnknown: "inconnu",
    awaitingAcceptance:
      "Requête envoyée. En attente de la confirmation du démarrage par le CLI…",
    cancelUnsupported:
      "Cet adaptateur ne peut pas annuler une livraison en attente ; attendez le verdict du runtime.",
    cancelPending: "Confirmation du résultat de l'annulation…",
    settling: "Enregistrement du résultat…",
    recoveryTitle: "Récupération requise",
    recoveryHint:
      "Le dernier envoi a reçu un accusé ambigu : cette session partagée est verrouillée. Sondez les preuves durables ou reconstruisez explicitement le binding.",
    recoveryProbe: "Sonder",
    recoveryProbing: "Sondage…",
    recoveryRebuild: "Reconstruire le binding",
    recoveryProbeHeld:
      "Le sondage a trouvé une tentative acceptée mais non validée. La session reste verrouillée pour préserver l'ordre.",
    recoveryProbeCleared: "Le sondage n'a trouvé aucune tentative en attente. La session est déverrouillée.",
    targetUnavailable: "La cible sélectionnée est indisponible.",
    targetUnavailableReason: "La cible sélectionnée est indisponible : {{reason}}",
    selectionPersistFailedTitle: "La cible sélectionnée n’a pas été enregistrée",
    selectionPersistFailedMessage:
      "La sélection actuelle reste en mémoire, mais un redémarrage peut restaurer la cible précédente : {{reason}}",
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
    cancel: "Annuler",
  },
};

export default sharedSend;
