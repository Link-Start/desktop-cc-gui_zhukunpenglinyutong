// sharedSend — हिन्दी UI स्ट्रिंग्स (Wave 4 / Change B §14.5 UI स्टेट मशीन)
const sharedSend = {
  sharedSend: {
    preparingContext: "Shared Session के लिए कॉन्टेक्स्ट तैयार किया जा रहा है…",
    degradedTitle: "अपक्षयित कॉन्टेक्स्ट",
    degradedHint:
      "कॉन्टेक्स्ट प्रोजेक्शन में omissions हैं। आपकी पुष्टि के बिना टर्न नहीं भेजा जाएगा।",
    degradedConfirm: "फिर भी भेजें",
    awaitingAcceptance: "डिलीवर किया जा रहा है… रनटाइम की प्राप्ति पुष्टि की प्रतीक्षा है।",
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
    cancel: "रद्द करें",
  },
};

export default sharedSend;
