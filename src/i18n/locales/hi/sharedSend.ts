// sharedSend — हिन्दी UI स्ट्रिंग्स (Wave 4 / Change B §14.5 UI स्टेट मशीन)
const sharedSend = {
  sharedSend: {
    preparingContext: "Shared Session के लिए कॉन्टेक्स्ट तैयार किया जा रहा है…",
    degradedTitle: "अपक्षयित कॉन्टेक्स्ट",
    degradedHint:
      "कॉन्टेक्स्ट प्रोजेक्शन में omissions हैं। आपकी पुष्टि के बिना टर्न नहीं भेजा जाएगा।",
    degradedConfirm: "भेजना जारी रखें",
    degradedDetails: "विवरण देखें",
    degradedMode: "स्थानांतरण विधि: {{mode}}",
    degradedTokenEstimate:
      "अनुमानित कॉन्टेक्स्ट आकार: {{source}} → {{package}} टोकन",
    unknownDetail: "अपरिचित प्रोटोकॉल मान: {{value}}",
    modeNativeDelta: "मूल वृद्धिशील कॉन्टेक्स्ट",
    modeNativeHistoryImport: "मूल इतिहास आयात",
    modeNativeHistoryClone: "मूल सत्र प्रतिलिपि",
    modePortableTranscript: "पोर्टेबल प्रतिलेख",
    modeCheckpoint: "संपीड़ित जाँच-बिंदु",
    dispositionRetrievable: "माँग पर पुनर्प्राप्त",
    dispositionNotRetrievable: "पुनर्प्राप्त नहीं",
    omissionImageHistory:
      "गंतव्य इतिहास चित्रों का समर्थन नहीं करता।",
    omissionAssistantOutcome:
      "सहायक टर्न {{outcome}} स्थिति में समाप्त हुआ और सफल रूप में दोबारा नहीं चलाया जाएगा।",
    omissionPrivateReasoning:
      "प्रदाता का निजी तर्क स्थानांतरित नहीं किया जा सकता।",
    omissionAssistantArtifact:
      "सहायक आर्टिफ़ैक्ट केवल संदर्भ रहेंगे और पाठ के रूप में नहीं जोड़े जाएँगे।",
    omissionPrivateBlock:
      "सहायक का असमर्थित निजी ब्लॉक हटा दिया गया।",
    omissionToolHistory:
      "गंतव्य टूल इतिहास का समर्थन नहीं करता, इसलिए टूल कॉल और परिणाम साथ में हटा दिए गए।",
    omissionHistoricalControl:
      "ऐतिहासिक नियंत्रण क्रियाएँ केवल संदर्भ हैं और फिर से नहीं चलेंगी।",
    omissionDeterministicFold:
      "कॉन्टेक्स्ट सीमा में रखने के लिए लंबी सामग्री संक्षिप्त की गई।",
    omissionCheckpointBudget:
      "कॉन्टेक्स्ट सीमा में रखने के लिए सबसे पुराना पूरा टर्न हटाया गया।",
    omissionDestinationOwned:
      "गंतव्य के मूल इतिहास में पहले से मौजूद सामग्री दोहराई नहीं गई।",
    omissionUnknown: "अपरिचित छूटी सामग्री ({{category}}): {{reason}}",
    outcomeCompleted: "पूर्ण",
    outcomeFailed: "विफल",
    outcomeCancelled: "रद्द",
    outcomeReplaced: "प्रतिस्थापित",
    outcomeUnknown: "अज्ञात",
    awaitingAcceptance:
      "अनुरोध भेज दिया गया है। CLI से प्रोसेसिंग शुरू होने की पुष्टि की प्रतीक्षा है…",
    cancelUnsupported:
      "यह एडैप्टर लंबित डिलीवरी रद्द नहीं कर सकता; रनटाइम के निर्णय की प्रतीक्षा करें।",
    cancelPending: "रद्द करने के परिणाम की पुष्टि हो रही है…",
    settling: "परिणाम सहेजा जा रहा है…",
    recoveryTitle: "पुनर्प्राप्ति आवश्यक",
    recoveryHint:
      "अंतिम भेजे गए संदेश की पावती अस्पष्ट थी, इसलिए यह साझा सत्र लॉक है। durable साक्ष्य की Probe करें या binding को स्पष्ट रूप से पुनर्निर्मित करें।",
    recoveryProbe: "Probe",
    recoveryProbing: "Probe जारी…",
    recoveryRebuild: "Binding पुनर्निर्मित करें",
    recoveryProbeHeld:
      "Probe को स्वीकृत किंतु uncommitted attempt मिला। क्रम सुरक्षा हेतु सत्र लॉक रहेगा।",
    recoveryProbeCleared: "Probe में कोई लंबित attempt नहीं मिला। सत्र अनलॉक हो गया।",
    targetUnavailable: "चयनित target उपलब्ध नहीं है।",
    targetUnavailableReason: "चयनित target उपलब्ध नहीं है: {{reason}}",
    selectionPersistFailedTitle: "चयनित लक्ष्य सहेजा नहीं गया",
    selectionPersistFailedMessage:
      "वर्तमान चयन मेमोरी में सुरक्षित है, पर पुनः आरंभ पर पिछला लक्ष्य उपयोग हो सकता है: {{reason}}",
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
    cancel: "रद्द करें",
  },
};

export default sharedSend;
