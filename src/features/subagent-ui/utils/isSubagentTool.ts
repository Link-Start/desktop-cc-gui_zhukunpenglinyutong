import { extractToolName } from "../../../utils/toolSemantics";

type ToolLike = {
  toolType?: unknown;
  title?: unknown;
};

function normalizeRuntimeString(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * 从 title 抽出 collab action（与 StatusPanel 口径对齐）。
 * 例："Collab: spawn Agent" → "spawn agent"
 */
export function extractCollabActionName(title: unknown): string {
  const raw = typeof title === "string" ? title.trim() : "";
  if (!raw) {
    return "";
  }
  return raw
    .replace(/^collab:\s*/i, "")
    .replace(/^tool:\s*/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Codex collab 生命周期动作（wait/close）不渲染 persona 卡，只更新状态面板。
 */
export function isCollabLifecycleTool(item: ToolLike): boolean {
  const toolType = normalizeRuntimeString(item.toolType);
  if (toolType !== "collabtoolcall" && toolType !== "collabagenttoolcall") {
    return false;
  }
  const action = extractCollabActionName(item.title);
  return (
    action === "wait agent" ||
    action === "wait" ||
    action === "close agent" ||
    action === "close"
  );
}

/**
 * Codex collab 的 spawn 类工具：幕布要展开成 persona 卡。
 */
export function isCollabSpawnTool(item: ToolLike): boolean {
  const toolType = normalizeRuntimeString(item.toolType);
  if (toolType !== "collabtoolcall" && toolType !== "collabagenttoolcall") {
    return false;
  }
  const action = extractCollabActionName(item.title);
  return (
    action === "spawn agent" ||
    action === "spawn" ||
    action.startsWith("spawn ")
  );
}

/**
 * 幕布/分组用的 subAgent 识别（跨引擎）：
 * - Claude：Agent / Task
 * - Codex：collab spawn（非 wait/close）
 * - Grok / Kimi / Shared：title/toolType 含 subagent、agent swarm 等
 */
export function isSubagentTool(item: ToolLike): boolean {
  if (isCollabLifecycleTool(item)) {
    return false;
  }
  if (isCollabSpawnTool(item)) {
    return true;
  }

  const toolName = extractToolName(item.title).trim().toLowerCase();
  const toolType = normalizeRuntimeString(item.toolType);
  const rawTitle =
    typeof item.title === "string" ? item.title.trim().toLowerCase() : "";

  if (
    toolName === "task" ||
    toolName === "agent" ||
    toolType === "task" ||
    toolType === "agent"
  ) {
    return true;
  }

  // Grok: "Subagent 1 问候测试" / toolType 含 subagent
  if (
    toolName.startsWith("subagent") ||
    toolType.includes("subagent") ||
    rawTitle.startsWith("subagent")
  ) {
    return true;
  }

  // Kimi / multi-agent：Launching agent swarm …
  if (
    toolName.includes("agent swarm") ||
    toolName.includes("agent_swarm") ||
    rawTitle.includes("agent swarm") ||
    rawTitle.includes("launching agent swarm") ||
    toolType.includes("agent_swarm") ||
    toolType.includes("agentswarm")
  ) {
    return true;
  }

  // 部分引擎把 spawn 写成裸工具名
  if (toolName.includes("spawn agent") || rawTitle.includes("spawn agent")) {
    return true;
  }

  return false;
}
