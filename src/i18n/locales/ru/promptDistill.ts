// promptDistill — Строки интерфейса на русском
const promptDistill = {
  promptDistill: {
    menuSaveAsPrompt: "Создать команду из выделения",
    menuSaveThreadAsPrompt: "Создать команду из диалога",
    dialogTitle: "Создать команду",
    dialogDescription:
      "Извлекает из диалога переиспользуемую слэш-команду. Она сохраняется в каталог команд этого рабочего пространства — затем введите / в поле ввода, чтобы вызвать её. $ARGUMENTS в шаблоне заменяется аргументами, переданными при вызове.",
    nameLabel: "Имя команды",
    namePlaceholder: "например, review-checklist",
    contentLabel: "Шаблон команды",
    argumentsHint:
      "Используйте $ARGUMENTS там, куда должны подставляться аргументы, переданные /команде.",
    distilling: "Создание команды…",
    save: "Сохранить",
    saving: "Сохранение…",
    cancel: "Отмена",
    nameInvalid:
      "Используйте строчные буквы, цифры, дефисы или подчёркивания; начинайте с буквы или цифры.",
    failedTimeout: "Время создания команды истекло через {{seconds}} с",
    failedEmpty: "Движок вернул пустой шаблон команды",
    failedGeneric: "Не удалось создать команду",
    savedTitle: "Команда сохранена",
    savedMessage: "Сохранено как /{{name}} — введите / в поле ввода, чтобы вызвать.",
  },
};

export default promptDistill;
