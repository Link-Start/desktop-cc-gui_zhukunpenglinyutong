// promptDistill — Cadenas de UI en español
const promptDistill = {
  promptDistill: {
    menuSaveAsPrompt: "Generar comando desde la selección",
    menuSaveThreadAsPrompt: "Generar comando desde el hilo",
    dialogTitle: "Generar comando",
    dialogDescription:
      "Destila la conversación en un comando de barra reutilizable. Se guarda en el directorio de comandos de este espacio de trabajo; después escribe / en el editor para invocarlo. $ARGUMENTS en la plantilla se reemplaza por los argumentos que pases al invocarlo.",
    nameLabel: "Nombre del comando",
    namePlaceholder: "p. ej. review-checklist",
    contentLabel: "Plantilla del comando",
    argumentsHint:
      "Usa $ARGUMENTS donde deban ir los argumentos que pases al /comando.",
    distilling: "Generando comando…",
    save: "Guardar",
    saving: "Guardando…",
    cancel: "Cancelar",
    nameInvalid:
      "Usa letras minúsculas, dígitos, guiones o guiones bajos, comenzando con una letra o un dígito.",
    failedTimeout: "La generación del comando agotó el tiempo tras {{seconds}} s",
    failedEmpty: "El motor devolvió una plantilla de comando vacía",
    failedGeneric: "La generación del comando falló",
    savedTitle: "Comando guardado",
    savedMessage: "Guardado como /{{name}} — escribe / en el editor para invocarlo.",
  },
};

export default promptDistill;
