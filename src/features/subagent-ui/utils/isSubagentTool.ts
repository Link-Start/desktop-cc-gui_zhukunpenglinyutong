import { extractToolName } from "../../../utils/toolSemantics";

type ToolLike = {
  toolType?: unknown;
  title?: unknown;
};

function normalizeRuntimeString(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * 幕布/分组用的 subAgent 识别（与 StatusPanel task-like 口径对齐）。
 */
export function isSubagentTool(item: ToolLike): boolean {
  const toolName = extractToolName(item.title).trim().toLowerCase();
  const toolType = normalizeRuntimeString(item.toolType);
  return (
    toolName === "task" ||
    toolName === "agent" ||
    toolType === "task" ||
    toolType === "agent"
  );
}
