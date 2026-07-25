// promptDistill — 繁體中文 UI 文案
const promptDistill = {
  promptDistill: {
    menuSaveAsPrompt: "將選取範圍生成命令",
    menuSaveThreadAsPrompt: "將整段對話生成命令",
    dialogTitle: "生成命令",
    dialogDescription:
      "將對話內容提煉為可重複使用的斜線命令。儲存後寫入目前工作區命令目錄，之後在輸入框鍵入 / 即可呼叫；範本中的 $ARGUMENTS 會在呼叫時被你輸入的參數取代。",
    nameLabel: "命令名稱",
    namePlaceholder: "例如 review-checklist",
    contentLabel: "命令範本",
    argumentsHint: "在需要填入呼叫參數的位置使用 $ARGUMENTS，呼叫 /命令 時傳入。",
    distilling: "正在生成命令…",
    save: "儲存",
    saving: "儲存中…",
    cancel: "取消",
    nameInvalid: "請使用小寫字母、數字、連字號或底線，且以字母或數字開頭。",
    failedTimeout: "命令生成逾時（{{seconds}} 秒）",
    failedEmpty: "引擎回傳了空的命令範本",
    failedGeneric: "命令生成失敗",
    savedTitle: "命令已儲存",
    savedMessage: "已儲存為 /{{name}}，在輸入框鍵入 / 即可呼叫。",
  },
};

export default promptDistill;
