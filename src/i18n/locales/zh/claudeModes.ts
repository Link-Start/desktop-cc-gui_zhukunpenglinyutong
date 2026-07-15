// claudeModes — Simplified Chinese UI strings
const claudeModes = {
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
};

export default claudeModes;
