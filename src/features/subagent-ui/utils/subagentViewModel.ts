import type { ConversationItem } from "../../../types";
import {
  extractToolName,
  parseToolArgs,
  resolveToolStatus,
} from "../../../utils/toolSemantics";
import type { EngineTaskOutputSource } from "../../engine-task-output/types";
import type { SubagentInfo } from "../../status-panel/types";
import {
  assignPersona,
  assignPersonasForSquad,
  type AssignedPersona,
} from "./personaAssign";

export type SubagentCardStatus = "running" | "completed" | "error";

export type SubagentCardViewModel = {
  id: string;
  displayName: string;
  indexLabel: string;
  description: string;
  typeLabel: string;
  status: SubagentCardStatus;
  /** 0..1；running 时 < 1 */
  progress: number;
  toolCount: number | null;
  outputText: string | null;
  taskOutput: EngineTaskOutputSource | null;
  githubLogin: string | null;
  githubProfileUrl: string | null;
  avatarSrc: string | null;
  /** Claude Agent 内部 agentId（侧链 session 用） */
  agentId: string | null;
  /**
   * 可加载的子会话 threadId，例如 `claude:subagent:{parentSessionId}:{agentId}`。
   * 有值时右侧应渲染该 session 幕布，而不是 tool launch 元数据。
   */
  sessionThreadId: string | null;
};

type ToolItem = Extract<ConversationItem, { kind: "tool" }>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getToolDetail(item: ToolItem): string {
  return typeof item.detail === "string" ? item.detail : "";
}

function getToolOutput(item: ToolItem): string | null {
  return typeof item.output === "string" ? item.output : null;
}

function extractDescription(args: Record<string, unknown> | null, item: ToolItem): string {
  const fromArgs =
    (typeof args?.description === "string" && args.description) ||
    (typeof args?.prompt === "string" && args.prompt) ||
    (typeof args?.query === "string" && args.query) ||
    (typeof args?.task === "string" && args.task) ||
    "";
  if (fromArgs.trim()) {
    return fromArgs.trim().slice(0, 160);
  }
  const outputLine = getToolOutput(item)?.split(/\r?\n/, 1)[0]?.trim();
  if (outputLine) {
    return outputLine.slice(0, 160);
  }
  return extractToolName(item.title).replace(/^Tool:\s*/i, "").trim() || "Subagent";
}

function extractTypeLabel(args: Record<string, unknown> | null, item: ToolItem): string {
  const raw =
    (typeof args?.subagent_type === "string" && args.subagent_type) ||
    (typeof args?.agent === "string" && args.agent) ||
    (typeof args?.type === "string" && args.type) ||
    (typeof args?.name === "string" && args.name) ||
    extractToolName(item.title);
  return raw.trim() || "agent";
}

function mapToolStatus(item: ToolItem): SubagentCardStatus {
  const tone = resolveToolStatus(item.status, Boolean(getToolOutput(item)));
  if (tone === "failed") {
    return "error";
  }
  if (tone === "completed") {
    return "completed";
  }
  return "running";
}

function extractAgentId(
  args: Record<string, unknown> | null,
  outputText: string | null,
): string | null {
  for (const key of ["agent_id", "agentId", "agentID"]) {
    const value = args?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  if (!outputText) {
    return null;
  }
  const match =
    /agentId\s*[:=]\s*['"]?([a-f0-9]+)['"]?/i.exec(outputText) ??
    /agent_id\s*[:=]\s*['"]?([a-f0-9]+)['"]?/i.exec(outputText);
  return match?.[1]?.trim() || null;
}

/**
 * 由父会话 threadId + agentId 推导子代理 threadId（与 sidebarInternals 一致）。
 */
export function resolveClaudeSubagentThreadId(
  parentThreadId: string | null | undefined,
  agentId: string | null | undefined,
): string | null {
  const parent = parentThreadId?.trim() ?? "";
  const agent = agentId?.trim() ?? "";
  if (!parent || !agent) {
    return null;
  }
  const parentSessionId = parent.startsWith("claude:")
    ? parent.slice("claude:".length)
    : parent;
  if (!parentSessionId || parentSessionId.startsWith("subagent:")) {
    return null;
  }
  return `claude:subagent:${parentSessionId}:${agent}`;
}

function extractOutputFilePath(
  args: Record<string, unknown> | null,
  outputText: string | null,
): string | null {
  const fromArgs = [
    args?.output_file,
    args?.outputFile,
    args?.output_file_path,
    args?.outputFilePath,
    args?.artifact_path,
    args?.artifactPath,
  ];
  for (const value of fromArgs) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  if (!outputText) {
    return null;
  }
  // Claude Agent 启动回执常见字段：output_file: /path/to/agent.output
  const match =
    /output_file\s*[:=]\s*(\S+)/i.exec(outputText) ??
    /outputFile\s*[:=]\s*(\S+)/i.exec(outputText);
  const path = match?.[1]?.trim();
  return path && path.length > 0 ? path.replace(/[.,;)"']+$/, "") : null;
}

function extractToolCount(
  args: Record<string, unknown> | null,
  item: ToolItem,
): number | null {
  const candidates = [
    args?.tool_count,
    args?.toolCount,
    args?.tools_used,
    args?.num_tools,
    (item as { toolCount?: unknown }).toolCount,
  ];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return Math.floor(value);
    }
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      return Number.parseInt(value.trim(), 10);
    }
  }
  const agentStatus = asRecord((item as { agentStatus?: unknown }).agentStatus);
  if (agentStatus) {
    return Object.keys(agentStatus).length || null;
  }
  return null;
}

export function resolveSubagentProgress(
  status: SubagentCardStatus,
  toolCount: number | null,
): number {
  if (status === "completed" || status === "error") {
    return 1;
  }
  const count = toolCount ?? 0;
  // running：随工具数缓慢上升，封顶 0.85，禁止 100%
  return Math.min(0.85, 0.12 + count * 0.06);
}

function formatIndexLabel(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function applyPersonaFields(
  persona: AssignedPersona,
): Pick<
  SubagentCardViewModel,
  "displayName" | "githubLogin" | "githubProfileUrl" | "avatarSrc"
> {
  return {
    displayName: persona.name,
    githubLogin: persona.githubLogin,
    githubProfileUrl: persona.githubProfileUrl,
    avatarSrc: persona.avatarSrc,
  };
}

export function buildSubagentCardFromToolItem(
  item: ToolItem,
  options?: {
    index?: number;
    persona?: AssignedPersona;
    parentThreadId?: string | null;
  },
): SubagentCardViewModel {
  const args = parseToolArgs(getToolDetail(item));
  const status = mapToolStatus(item);
  const toolCount = extractToolCount(args, item);
  const description = extractDescription(args, item);
  const typeLabel = extractTypeLabel(args, item);
  const persona = options?.persona ?? assignPersona(item.id);
  const outputText = getToolOutput(item);
  const outputFilePath = extractOutputFilePath(args, outputText);
  const agentId = extractAgentId(args, outputText);
  const sessionThreadId = resolveClaudeSubagentThreadId(
    options?.parentThreadId,
    agentId,
  );
  const taskId =
    typeof args?.task_id === "string"
      ? args.task_id
      : typeof args?.taskId === "string"
        ? args.taskId
        : null;
  const outputFileName = outputFilePath
    ? outputFilePath.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? outputFilePath
    : null;

  const taskOutput: EngineTaskOutputSource = {
    id: item.id,
    engine: "claude",
    title: typeLabel,
    description,
    status: status === "error" ? "error" : status === "completed" ? "completed" : "running",
    taskId,
    toolUseId: item.id,
    threadId: sessionThreadId,
    outputFilePath,
    outputFileName,
    recentOutput: outputText,
  };

  return {
    id: item.id,
    ...applyPersonaFields(persona),
    indexLabel: formatIndexLabel(options?.index ?? 0),
    description,
    typeLabel,
    status,
    progress: resolveSubagentProgress(status, toolCount),
    toolCount,
    outputText,
    taskOutput,
    agentId,
    sessionThreadId,
  };
}

export function buildSubagentCardsFromToolItems(
  items: readonly ToolItem[],
  options?: { parentThreadId?: string | null },
): SubagentCardViewModel[] {
  const personas = assignPersonasForSquad(items.map((item) => item.id));
  return items.map((item, index) =>
    buildSubagentCardFromToolItem(item, {
      index,
      persona: personas[index],
      parentThreadId: options?.parentThreadId,
    }),
  );
}

export function buildSubagentCardFromSubagentInfo(
  agent: SubagentInfo,
  options?: { index?: number; parentThreadId?: string | null },
): SubagentCardViewModel {
  const persona = assignPersona(agent.id);
  const toolCount = null;
  const outputText = agent.taskOutput?.recentOutput ?? null;
  const agentIdFromOutput = extractAgentId(null, outputText);
  // StatusPanel collab 子线程 id 本身就是 session thread；Claude task 则从 output 抽 agentId
  const navigationThreadId =
    agent.navigationTarget?.kind === "thread"
      ? agent.navigationTarget.threadId
      : null;
  const sessionThreadId =
    navigationThreadId ??
    agent.taskOutput?.threadId ??
    resolveClaudeSubagentThreadId(
      options?.parentThreadId,
      agentIdFromOutput ?? (agent.id.includes(":") ? null : agent.id),
    );
  return {
    id: agent.id,
    ...applyPersonaFields(persona),
    indexLabel: formatIndexLabel(options?.index ?? 0),
    description: agent.description || agent.type || "Subagent",
    typeLabel: agent.type || "agent",
    status: agent.status,
    progress: resolveSubagentProgress(agent.status, toolCount),
    toolCount,
    outputText,
    taskOutput: agent.taskOutput
      ? { ...agent.taskOutput, threadId: sessionThreadId ?? agent.taskOutput.threadId }
      : null,
    agentId: agentIdFromOutput,
    sessionThreadId,
  };
}
