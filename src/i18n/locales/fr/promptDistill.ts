// promptDistill — Chaînes d'interface en français
const promptDistill = {
  promptDistill: {
    menuSaveAsPrompt: "Générer une commande depuis la sélection",
    menuSaveThreadAsPrompt: "Générer une commande depuis le fil",
    dialogTitle: "Générer une commande",
    dialogDescription:
      "Distille la conversation en une commande slash réutilisable. Elle est enregistrée dans le répertoire de commandes de cet espace de travail — tapez ensuite / dans le composer pour l'invoquer. $ARGUMENTS dans le modèle est remplacé par les arguments passés lors de l'invocation.",
    nameLabel: "Nom de la commande",
    namePlaceholder: "ex. review-checklist",
    contentLabel: "Modèle de commande",
    argumentsHint:
      "Utilisez $ARGUMENTS à l'endroit où les arguments passés à la /commande doivent être insérés.",
    distilling: "Génération de la commande…",
    save: "Enregistrer",
    saving: "Enregistrement…",
    cancel: "Annuler",
    nameInvalid:
      "Utilisez des lettres minuscules, des chiffres, des tirets ou des underscores, en commençant par une lettre ou un chiffre.",
    failedTimeout: "La génération de la commande a expiré après {{seconds}} s",
    failedEmpty: "Le moteur a renvoyé un modèle de commande vide",
    failedGeneric: "La génération de la commande a échoué",
    savedTitle: "Commande enregistrée",
    savedMessage: "Enregistrée comme /{{name}} — tapez / dans le composer pour l'invoquer.",
  },
};

export default promptDistill;
