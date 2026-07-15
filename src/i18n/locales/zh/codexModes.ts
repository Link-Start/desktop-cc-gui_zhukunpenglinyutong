// codexModes — Simplified Chinese UI strings
const codexModes = {
  codexModes: {
    default: {
      label: "建议模式",
      tooltip:
        "Codex approval_policy=untrusted：执行命令或写文件前都会弹窗确认。",
      description: "最安全的选择，每一步都需要你亲自批准。",
    },
    plan: {
      label: "规划模式",
      tooltip: "规划模式——只读分析",
      description: "仅使用只读工具，生成计划供用户审批后执行",
    },
    acceptEdits: {
      label: "自动编辑",
      tooltip:
        "Codex approval_policy=auto-edit：自动 apply_patch 写文件，命令仍需审批。",
      description: "自动处理文件创建/编辑，但运行命令前仍会询问。",
    },
    bypassPermissions: {
      label: "全自动",
      tooltip:
        "Codex approval_policy=never：命令与写入直接执行（workspace 沙箱仍生效）。",
      description: "完全免审批，写文件和执行命令立即生效，仅受沙箱限制。",
    },
  },
};

export default codexModes;
