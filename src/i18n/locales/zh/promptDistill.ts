// promptDistill — 简体中文 UI 文案
const promptDistill = {
  promptDistill: {
    menuSaveAsPrompt: "将选区生成命令",
    menuSaveThreadAsPrompt: "将整段对话生成命令",
    dialogTitle: "生成命令",
    dialogDescription:
      "将对话内容提炼为可复用的斜杠命令。保存后写入当前工作区命令目录，之后在输入框键入 / 即可调用；模板中的 $ARGUMENTS 会在调用时被你输入的参数替换。",
    nameLabel: "命令名称",
    namePlaceholder: "例如 review-checklist",
    contentLabel: "命令模板",
    argumentsHint: "在需要填入调用参数的位置使用 $ARGUMENTS，调用 /命令 时传入。",
    distilling: "正在生成命令…",
    save: "保存",
    saving: "保存中…",
    cancel: "取消",
    nameInvalid: "请使用小写字母、数字、连字符或下划线，且以字母或数字开头。",
    failedTimeout: "命令生成超时（{{seconds}} 秒）",
    failedEmpty: "引擎返回了空的命令模板",
    failedGeneric: "命令生成失败",
    savedTitle: "命令已保存",
    savedMessage: "已保存为 /{{name}}，在输入框键入 / 即可调用。",
  },
};

export default promptDistill;
