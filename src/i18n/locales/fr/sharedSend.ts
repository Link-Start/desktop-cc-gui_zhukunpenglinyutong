// sharedSend — Chaînes d'UI en français (Wave 4 / Change B §14.5 machine à états)
const sharedSend = {
  sharedSend: {
    preparingContext: "Préparation du contexte de la session partagée…",
    degradedTitle: "Contexte dégradé",
    degradedHint:
      "La projection du contexte comporte des omissions. Le tour ne sera pas envoyé sans votre confirmation.",
    degradedConfirm: "Envoyer quand même",
    awaitingAcceptance: "Livraison en cours… en attente de la confirmation de réception du runtime.",
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
    cancel: "Annuler",
  },
};

export default sharedSend;
