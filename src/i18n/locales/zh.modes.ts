const zhModes = {
  // 权限模式
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

  claudeModes: {
    default: {
      label: "建议模式（预览）",
      tooltip:
        "Claude Code 预览审批模式。部分场景仍可能退化，完整审批桥仍在补齐。",
      description:
        "现已开放预览，用于验证 Claude 默认权限流；若命中退化路径，界面会提示切换到 Plan 模式。",
    },
    plan: {
      label: "规划模式",
      tooltip: "Claude Code 只读分析模式。",
      description: "仅使用只读工具进行分析与规划，适合谨慎执行前先看方案。",
    },
    acceptEdits: {
      label: "自动编辑",
      tooltip: "Claude Code 自动编辑模式。当前阶段暂未开放。",
      description: "待确认 Claude 实际审批语义后再开放，当前阶段暂不可选。",
    },
    bypassPermissions: {
      label: "全自动",
      tooltip: "Claude Code 跳过权限检查模式。",
      description: "直接执行文件写入与命令操作，不经过审批，需谨慎使用。",
    },
  },

  // Codex 特定模式
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

export default zhModes;
