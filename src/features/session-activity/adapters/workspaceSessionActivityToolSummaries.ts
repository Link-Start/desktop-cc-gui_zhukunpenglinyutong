import type { ConversationItem } from "../../../types";
import {
  extractToolName,
  getFirstStringField,
  isBashTool,
  isReadTool,
  isSearchTool,
  isWebTool,
  parseToolArgs,
} from "../../../utils/toolSemantics";
import { extractCommandSummaries } from "../../operation-facts/operationFacts";
import type { ToolItem } from "./workspaceSessionActivityTypes";
import {
  getToolDetail,
  getToolOutput,
  getToolTitle,
  getToolType,
} from "./workspaceSessionActivityToolAccessors";

export function extractCommandOutputWindow(output: string | undefined) {
  if (!output) {
    return "";
  }
  const lines = output.split(/\r?\n/);
  if (lines.length === 0) {
    return "";
  }
  const tail = lines.slice(-80).join("\n").trim();
  if (!tail) {
    return "";
  }
  return tail.slice(-4_000);
}

export function normalizeCommandValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

export function extractCommandMetadata(item: ToolItem) {
  const detailArgs = parseToolArgs(getToolDetail(item));
  const inputArgs =
    detailArgs && typeof detailArgs.input === "object" && detailArgs.input
      ? (detailArgs.input as Record<string, unknown>)
      : null;
  const nestedArgs =
    detailArgs && typeof detailArgs.arguments === "object" && detailArgs.arguments
      ? (detailArgs.arguments as Record<string, unknown>)
      : null;
  const commandKeys = ["command", "cmd", "script", "shell_command", "bash", "argv"];
  const descriptionKeys = ["description", "summary", "label", "title", "task"];
  const cwdKeys = ["cwd", "workdir", "working_directory", "workingDirectory"];

  const command =
    normalizeCommandValue(
      detailArgs
        ? commandKeys.map((key) => detailArgs[key]).find((value) => normalizeCommandValue(value))
        : undefined,
    ) ||
    normalizeCommandValue(
      inputArgs
        ? commandKeys.map((key) => inputArgs[key]).find((value) => normalizeCommandValue(value))
        : undefined,
    ) ||
    normalizeCommandValue(
      nestedArgs
        ? commandKeys.map((key) => nestedArgs[key]).find((value) => normalizeCommandValue(value))
        : undefined,
    );

  const description =
    getFirstStringField(detailArgs, descriptionKeys) ||
    getFirstStringField(inputArgs, descriptionKeys) ||
    getFirstStringField(nestedArgs, descriptionKeys) ||
    "";

  const cwd =
    getFirstStringField(detailArgs, cwdKeys) ||
    getFirstStringField(inputArgs, cwdKeys) ||
    getFirstStringField(nestedArgs, cwdKeys) ||
    "";

  const fallbackSummary =
    extractCommandSummaries([item])[0]?.command || getToolTitle(item) || "Command";

  return {
    commandText: command || fallbackSummary,
    commandDescription: description,
    commandWorkingDirectory: cwd,
    summary: command || fallbackSummary,
  };
}

export function summarizeTask(item: ToolItem) {
  const toolName = extractToolName(getToolTitle(item)).trim().toLowerCase();
  const toolType = getToolType(item).trim().toLowerCase();
  const args = parseToolArgs(getToolDetail(item));
  if (toolName === "task" || toolType === "task") {
    const description =
      getFirstStringField(args, ["description", "prompt", "query", "task"]) ||
      getToolOutput(item)?.split(/\r?\n/, 1)[0]?.trim() ||
      getToolTitle(item).replace(/^Tool:\s*/i, "").trim() ||
      "Task";
    return `Task · ${description}`;
  }
  if (toolName === "todowrite" || toolName === "todo_write") {
    const todos = Array.isArray(args?.todos) ? args.todos : [];
    const completed = todos.filter((todo) => {
      if (!todo || typeof todo !== "object") {
        return false;
      }
      return (todo as { status?: string }).status === "completed";
    }).length;
    return `Task · Todo updated ${completed}/${todos.length}`;
  }
  if (getToolType(item) === "proposed-plan" || getToolType(item) === "plan-implementation") {
    const firstLine =
      getToolOutput(item)?.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() || "";
    return firstLine
      ? `Task · ${firstLine.slice(0, 80)}`
      : `Task · ${getToolTitle(item) || "Plan"}`;
  }
  return null;
}

export function isClaudeThreadId(threadId: string) {
  return threadId.startsWith("claude:") || threadId.startsWith("claude-pending-");
}

export function isClaudeSubagentTool(
  item: ToolItem,
  toolName: string,
) {
  const normalizedToolType = getToolType(item).trim().toLowerCase();
  return toolName === "agent" || normalizedToolType === "agent";
}

export function summarizeClaudeSubagent(item: ToolItem) {
  const args = parseToolArgs(getToolDetail(item));
  const subagentType =
    getFirstStringField(args, ["subagent_type", "agent", "type", "name"]) || "Agent";
  const description =
    getFirstStringField(args, ["description", "prompt", "query", "task"]) ||
    getToolOutput(item)?.split(/\r?\n/, 1)[0]?.trim() ||
    "Claude subagent";
  return {
    summary: `Subagent · ${description}`,
    subagentType,
    subagentDescription: description,
  };
}

export function getFirstNonEmptyValue(
  source: Record<string, unknown> | null,
  keys: string[],
): string {
  if (!source) {
    return "";
  }
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (Array.isArray(value)) {
      const parts: string[] = value
        .map((entry): string => {
          if (typeof entry === "string") {
            return entry.trim();
          }
          if (!entry || typeof entry !== "object") {
            return "";
          }
          const record = entry as Record<string, unknown>;
          return getFirstNonEmptyValue(record, keys);
        })
        .filter(Boolean);
      if (parts.length > 0) {
        return parts.join(", ");
      }
    }
    if (value && typeof value === "object") {
      const nested: string = getFirstNonEmptyValue(value as Record<string, unknown>, keys);
      if (nested) {
        return nested;
      }
    }
  }
  return "";
}

export function resolveReadableFilePath(candidate: string | undefined) {
  if (!candidate) {
    return null;
  }
  const normalized = candidate.trim();
  if (!normalized) {
    return null;
  }
  if (normalized === "." || normalized === "..") {
    return null;
  }
  if (normalized.includes("\n") || normalized.includes("\r") || normalized.includes("*")) {
    return null;
  }
  if (/^[a-z]+:\/\//i.test(normalized)) {
    return null;
  }
  return normalized;
}

export function isLikelyFilePath(candidate: string) {
  const normalized = candidate.trim();
  if (!normalized) {
    return false;
  }
  if (
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.startsWith("./") ||
    normalized.startsWith("../") ||
    normalized.startsWith("~/") ||
    /^[A-Za-z]:[\\/]/.test(normalized)
  ) {
    return true;
  }
  return /\.[A-Za-z0-9]{1,16}$/.test(normalized) && !/\s/.test(normalized);
}

export function resolveExploreReadPath(label: string, detail: string) {
  const detailPath = resolveReadableFilePath(detail);
  if (detailPath && isLikelyFilePath(detailPath)) {
    return detailPath;
  }
  const labelPath = resolveReadableFilePath(label);
  if (labelPath && isLikelyFilePath(labelPath)) {
    return labelPath;
  }
  return null;
}

export function joinDirectoryAndFilePath(directory: string, filePath: string) {
  const normalizedDirectory = directory.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedFilePath = filePath.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (!normalizedDirectory || !normalizedFilePath) {
    return "";
  }
  if (
    normalizedFilePath.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalizedFilePath)
  ) {
    return normalizedFilePath;
  }
  return `${normalizedDirectory}/${normalizedFilePath}`;
}

export function extractDisplayFileName(pathValue: string) {
  const normalized = pathValue.trim();
  if (!normalized) {
    return "";
  }
  const withoutTrailingSlash = normalized.replace(/[\\/]+$/, "");
  if (!withoutTrailingSlash) {
    return normalized;
  }
  const segments = withoutTrailingSlash.split(/[\\/]/);
  return segments[segments.length - 1] || withoutTrailingSlash;
}

export function extractPrimaryChangeDiff(
  item: Extract<ConversationItem, { kind: "tool" }>,
  filePath: string | undefined,
) {
  if (!filePath) {
    return "";
  }
  const directMatch = item.changes?.find((change) => change.path === filePath);
  return typeof directMatch?.diff === "string" ? directMatch.diff : "";
}

export const INSPECTION_PATH_KEYS = [
  "filePath",
  "file_path",
  "filepath",
  "path",
  "paths",
  "file",
  "files",
  "filename",
  "target_file",
  "targetFile",
  "target_path",
  "targetPath",
  "target",
  "directory",
  "dir",
  "cwd",
  "workdir",
  "url",
  "query",
  "q",
  "search_query",
  "searchQuery",
  "pattern",
];

export function extractInspectionPreview(output: string | undefined) {
  return extractCommandOutputWindow(output);
}

export function summarizeInspectionTool(item: ToolItem) {
  const toolName = extractToolName(getToolTitle(item)).trim().toLowerCase();
  if (!toolName || isBashTool(toolName)) {
    return null;
  }

  const args = parseToolArgs(getToolDetail(item));
  const inputArgs =
    args && typeof args.input === "object" && args.input
      ? (args.input as Record<string, unknown>)
      : null;
  const nestedArgs =
    args && typeof args.arguments === "object" && args.arguments
      ? (args.arguments as Record<string, unknown>)
      : null;
  const path =
    getFirstNonEmptyValue(args, INSPECTION_PATH_KEYS) ||
    getFirstNonEmptyValue(inputArgs, INSPECTION_PATH_KEYS) ||
    getFirstNonEmptyValue(nestedArgs, INSPECTION_PATH_KEYS);
  const workingDirectory =
    getFirstNonEmptyValue(args, ["cwd", "workdir", "working_directory", "workingDirectory", "directory", "dir"]) ||
    getFirstNonEmptyValue(inputArgs, ["cwd", "workdir", "working_directory", "workingDirectory", "directory", "dir"]) ||
    getFirstNonEmptyValue(nestedArgs, ["cwd", "workdir", "working_directory", "workingDirectory", "directory", "dir"]);
  const toolLabel = toolName.replace(/^mcp__[^_]+__/, "").replace(/_/g, " ");

  if (isReadTool(toolName)) {
    const resolvedPath = resolveReadableFilePath(path);
    const resolvedWorkingDirectory = resolveReadableFilePath(workingDirectory);
    const combinedPath =
      resolvedPath &&
      resolvedWorkingDirectory &&
      !resolvedPath.startsWith("/") &&
      !/^[A-Za-z]:[\\/]/.test(resolvedPath)
        ? resolveReadableFilePath(joinDirectoryAndFilePath(resolvedWorkingDirectory, resolvedPath))
        : null;
    const finalPath = combinedPath || resolvedPath;
    const summaryTarget = finalPath || path || toolLabel || "file";
    const displayName = extractDisplayFileName(summaryTarget);
    return {
      summary: `Read · ${displayName || summaryTarget}`,
      jumpTarget: finalPath
        ? ({ type: "file", path: finalPath } as const)
        : undefined,
      preview: extractInspectionPreview(getToolOutput(item)),
    };
  }
  if (isSearchTool(toolName)) {
    return {
      summary: `Search · ${path || toolLabel || "workspace"}`,
      preview: extractInspectionPreview(getToolOutput(item)),
    };
  }
  if (isWebTool(toolName)) {
    return {
      summary: `Web · ${path || toolLabel || "request"}`,
      preview: extractInspectionPreview(getToolOutput(item)),
    };
  }
  if (toolName === "skill_mcp" || toolName === "skill") {
    const nestedToolName = getFirstNonEmptyValue(args, ["tool_name", "toolName", "name"]);
    return {
      summary: `Skill · ${nestedToolName || path || "tool call"}`,
      preview: extractInspectionPreview(getToolOutput(item)),
    };
  }
  if (getToolType(item) === "mcpToolCall") {
    return {
      summary: `Tool · ${path || toolLabel || "activity"}`,
      preview: extractInspectionPreview(getToolOutput(item)),
    };
  }
  return null;
}
