// modes — Simplified Chinese UI strings
const modes = {
  modes: {
    selectMode: "选择模式",
    default: {
      label: "默认模式",
      tooltip: "标准权限行为",
      description: "需要手动确认每个操作，适合谨慎使用",
    },
    plan: {
      label: "规划模式",
      tooltip: "规划模式——只读分析",
      description: "仅使用只读工具，生成计划供用户审批后执行",
    },
    acceptEdits: {
      label: "代理模式",
      tooltip: "自动接受文件编辑",
      description: "自动接受文件创建/编辑，减少确认步骤",
    },
    bypassPermissions: {
      label: "自动模式",
      tooltip: "绕过所有权限检查",
      description: "完全自动化，绕过所有权限检查【谨慎使用】",
    },
  },
};

export default modes;
