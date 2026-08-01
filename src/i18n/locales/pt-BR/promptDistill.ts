// promptDistill — Strings de UI em português (Brasil)
const promptDistill = {
  promptDistill: {
    menuSaveAsPrompt: "Gerar comando da seleção",
    menuSaveThreadAsPrompt: "Gerar comando da conversa",
    dialogTitle: "Gerar comando",
    dialogDescription:
      "Destila a conversa em um comando de barra reutilizável. Ele é salvo no diretório de comandos deste workspace — depois digite / no editor para invocá-lo. $ARGUMENTS no modelo é substituído pelos argumentos que você passar na invocação.",
    nameLabel: "Nome do comando",
    namePlaceholder: "ex.: review-checklist",
    contentLabel: "Modelo de comando",
    argumentsHint:
      "Use $ARGUMENTS onde os argumentos passados ao /comando devem ser inseridos.",
    distilling: "Gerando comando…",
    save: "Salvar",
    saving: "Salvando…",
    cancel: "Cancelar",
    nameInvalid:
      "Use letras minúsculas, dígitos, hífens ou sublinhados, começando com letra ou dígito.",
    failedTimeout: "A geração do comando expirou após {{seconds}} s",
    failedEmpty: "O motor retornou um modelo de comando vazio",
    failedGeneric: "A geração do comando falhou",
    savedTitle: "Comando salvo",
    savedMessage: "Salvo como /{{name}} — digite / no editor para invocá-lo.",
  },
};

export default promptDistill;
