import type { ConversationItem, EngineType } from "../../../types";
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
import { isCollabSpawnTool } from "./isSubagentTool";

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
  /** 引擎侧 agent id（Claude agentId / Codex receiver thread / Grok subagent 序号） */
  agentId: string | null;
  /**
   * 可加载的子会话 threadId。
   * Claude: `claude:subagent:{parent}:{agentId}`
   * Codex: 裸 thread id（如 agent-7 / uuid）
   * Grok/Kimi: 有则 `grok:…` / `kimi:…`，否则 null（抽屉展示 output 回退）
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

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function extractDescription(args: Record<string, unknown> | null, item: ToolItem): string {
  const fromArgs =
    (typeof args?.description === "string" && args.description) ||
    (typeof args?.prompt === "string" && args.prompt) ||
    (typeof args?.prompt_template === "string" && args.prompt_template) ||
    (typeof args?.promptTemplate === "string" && args.promptTemplate) ||
    (typeof args?.query === "string" && args.query) ||
    (typeof args?.task === "string" && args.task) ||
    "";
  if (fromArgs.trim()) {
    return fromArgs.trim().slice(0, 160);
  }
  const title = typeof item.title === "string" ? item.title.trim() : "";
  // Grok: "Subagent 1 问候测试" → 去掉前缀留描述
  const subagentTitle = title.replace(/^subagent\s*\d+\s*/i, "").trim();
  if (subagentTitle && subagentTitle.toLowerCase() !== title.toLowerCase()) {
    return subagentTitle.slice(0, 160);
  }
  // Kimi swarm: "Launching agent swarm: xxx"
  const swarmTitle = title.replace(/^launching\s+agent\s+swarm:\s*/i, "").trim();
  if (swarmTitle && swarmTitle.toLowerCase() !== title.toLowerCase()) {
    return swarmTitle.slice(0, 160);
  }
  const outputLine = getToolOutput(item)?.split(/\r?\n/, 1)[0]?.trim();
  if (outputLine && !outputLine.startsWith("<")) {
    return outputLine.slice(0, 160);
  }
  return extractToolName(item.title).replace(/^Tool:\s*/i, "").trim() || "Subagent";
}

function extractTypeLabel(args: Record<string, unknown> | null, item: ToolItem): string {
  const raw =
    (typeof args?.subagent_type === "string" && args.subagent_type) ||
    (typeof args?.subagentType === "string" && args.subagentType) ||
    (typeof args?.agent === "string" && args.agent) ||
    (typeof args?.type === "string" && args.type) ||
    (typeof args?.name === "string" && args.name) ||
    "";
  if (raw.trim()) {
    return raw.trim();
  }
  if (isCollabSpawnTool(item)) {
    return "spawn";
  }
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const subagentMatch = /^subagent\s*(\d+)/i.exec(title);
  if (subagentMatch) {
    return `Subagent ${subagentMatch[1]}`;
  }
  return extractToolName(item.title).replace(/^collab:\s*/i, "").trim() || "agent";
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
    /agentId\s*[:=]\s*['"]?([a-f0-9-]+)['"]?/i.exec(outputText) ??
    /agent_id\s*[:=]\s*['"]?([a-f0-9-]+)['"]?/i.exec(outputText) ??
    /agent_id="([^"]+)"/i.exec(outputText);
  return match?.[1]?.trim() || null;
}

/**
 * 由父会话 threadId + agentId 推导 Claude 子代理 threadId（与 sidebarInternals 一致）。
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

/**
 * 跨引擎解析子会话 threadId。
 */
export function resolveSubagentSessionThreadId(options: {
  parentThreadId?: string | null;
  agentId?: string | null;
  /** Codex collab receiver 等已是完整 thread id 时直接使用 */
  explicitThreadId?: string | null;
}): string | null {
  const explicit = options.explicitThreadId?.trim() || null;
  if (explicit) {
    return explicit;
  }
  const parent = options.parentThreadId?.trim() || "";
  const agent = options.agentId?.trim() || "";
  if (!agent) {
    return null;
  }
  // 已是完整引擎前缀 id
  if (
    agent.startsWith("claude:") ||
    agent.startsWith("grok:") ||
    agent.startsWith("kimi:") ||
    agent.startsWith("gemini:") ||
    agent.startsWith("opencode:") ||
    agent.startsWith("shared:")
  ) {
    return agent;
  }
  if (parent.startsWith("claude:")) {
    return resolveClaudeSubagentThreadId(parent, agent);
  }
  if (parent.startsWith("grok:")) {
    return agent.includes(":") ? agent : `grok:${agent}`;
  }
  if (parent.startsWith("kimi:")) {
    return agent.includes(":") ? agent : `kimi:${agent}`;
  }
  if (parent.startsWith("shared:")) {
    // shared 侧链多数仍是 native 子 thread id
    return agent;
  }
  // Codex 等裸 thread id
  if (!parent.includes(":") || parent.startsWith("codex:")) {
    return agent;
  }
  return agent;
}

function inferEngineFromThreadId(
  threadId: string | null | undefined,
): EngineType | "claude" {
  const id = threadId?.trim() ?? "";
  if (id.startsWith("claude:")) return "claude";
  if (id.startsWith("grok:")) return "grok";
  if (id.startsWith("kimi:")) return "kimi";
  if (id.startsWith("gemini:")) return "gemini";
  if (id.startsWith("opencode:")) return "opencode";
  if (id.startsWith("shared:")) return "codex";
  return "codex";
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

/**
 * 从 collab spawn / agentStatus / detail 箭头解析出 receiver agent thread ids。
 */
export function extractCollabAgentIds(item: ToolItem): string[] {
  const fromReceivers = Array.isArray(item.receiverThreadIds)
    ? item.receiverThreadIds.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      )
    : [];
  const agentStatus = asRecord((item as { agentStatus?: unknown }).agentStatus);
  const fromStatus = agentStatus
    ? Object.keys(agentStatus).filter((key) => {
        const lower = key.toLowerCase();
        return (
          lower !== "status" &&
          lower !== "state" &&
          !lower.endsWith("ids") &&
          key.trim().length > 0
        );
      })
    : [];
  const detail = getToolDetail(item);
  const arrowMatch = /(?:→|->)\s*(.+)$/.exec(detail);
  const fromDetail = arrowMatch
    ? arrowMatch[1]
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];
  return uniqueStrings([...fromReceivers, ...fromStatus, ...fromDetail]);
}

/**
 * 从 agent swarm 参数 / result XML 展开子代理条目。
 */
export function extractSwarmAgentEntries(
  item: ToolItem,
  args: Record<string, unknown> | null,
): Array<{ id: string; description: string; status: SubagentCardStatus }> {
  const status = mapToolStatus(item);
  const baseDescription = extractDescription(args, item);
  const entries: Array<{ id: string; description: string; status: SubagentCardStatus }> = [];

  const itemsField = args?.items ?? args?.ITEMS;
  if (Array.isArray(itemsField) && itemsField.length > 0) {
    itemsField.forEach((entry, index) => {
      const label =
        typeof entry === "string" || typeof entry === "number"
          ? String(entry)
          : `item-${index + 1}`;
      entries.push({
        id: `${item.id}:swarm:${label}`,
        description: `${baseDescription} · #${label}`.slice(0, 160),
        status,
      });
    });
  }

  const output = getToolOutput(item) ?? "";
  const subagentTagRegex =
    /<subagent\b([^>]*)>([\s\S]*?)<\/subagent>/gi;
  let match: RegExpExecArray | null;
  while ((match = subagentTagRegex.exec(output)) !== null) {
    const attrs = match[1] ?? "";
    const body = (match[2] ?? "").trim();
    const agentId =
      /agent_id\s*=\s*"([^"]+)"/i.exec(attrs)?.[1] ??
      /agent-id\s*=\s*"([^"]+)"/i.exec(attrs)?.[1] ??
      null;
    const itemLabel = /item\s*=\s*"([^"]+)"/i.exec(attrs)?.[1] ?? null;
    const outcome = /outcome\s*=\s*"([^"]+)"/i.exec(attrs)?.[1]?.toLowerCase() ?? "";
    const entryStatus: SubagentCardStatus =
      outcome === "failed" || outcome === "error"
        ? "error"
        : outcome === "completed" || outcome === "success"
          ? "completed"
          : status;
    const firstLine = body.split(/\r?\n/, 1)[0]?.replace(/^#+\s*/, "").trim() || baseDescription;
    entries.push({
      id: `${item.id}:swarm-result:${agentId ?? itemLabel ?? entries.length}`,
      description: firstLine.slice(0, 160),
      status: entryStatus,
    });
  }

  return entries;
}

type CardBuildOptions = {
  index?: number;
  persona?: AssignedPersona;
  parentThreadId?: string | null;
  /** 覆盖 id / agentId / description / status（swarm / collab 展开用） */
  override?: {
    id?: string;
    agentId?: string | null;
    explicitThreadId?: string | null;
    description?: string;
    typeLabel?: string;
    status?: SubagentCardStatus;
  };
};

export function buildSubagentCardFromToolItem(
  item: ToolItem,
  options?: CardBuildOptions,
): SubagentCardViewModel {
  const args = parseToolArgs(getToolDetail(item));
  const status = options?.override?.status ?? mapToolStatus(item);
  const toolCount = extractToolCount(args, item);
  const description =
    options?.override?.description ?? extractDescription(args, item);
  const typeLabel = options?.override?.typeLabel ?? extractTypeLabel(args, item);
  const cardId = options?.override?.id ?? item.id;
  const persona = options?.persona ?? assignPersona(cardId);
  const outputText = getToolOutput(item);
  const outputFilePath = extractOutputFilePath(args, outputText);
  const agentId =
    options?.override?.agentId ?? extractAgentId(args, outputText);
  const sessionThreadId = resolveSubagentSessionThreadId({
    parentThreadId: options?.parentThreadId,
    agentId,
    explicitThreadId: options?.override?.explicitThreadId,
  });
  const taskId =
    typeof args?.task_id === "string"
      ? args.task_id
      : typeof args?.taskId === "string"
        ? args.taskId
        : null;
  const outputFileName = outputFilePath
    ? outputFilePath.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? outputFilePath
    : null;
  const engine = inferEngineFromThreadId(
    sessionThreadId ?? options?.parentThreadId,
  );

  const taskOutput: EngineTaskOutputSource = {
    id: cardId,
    engine,
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
    id: cardId,
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

/**
 * 将一个 tool item 展开为 1..N 张 persona 卡（collab multi-agent / agent swarm）。
 */
export function expandSubagentToolToCards(
  item: ToolItem,
  options?: { parentThreadId?: string | null; indexOffset?: number },
): SubagentCardViewModel[] {
  const indexOffset = options?.indexOffset ?? 0;
  const args = parseToolArgs(getToolDetail(item));

  // Codex collab spawn：按 receiver agent 展开
  if (isCollabSpawnTool(item)) {
    const agentIds = extractCollabAgentIds(item);
    if (agentIds.length > 0) {
      const personas = assignPersonasForSquad(
        agentIds.map((id) => `${item.id}:${id}`),
      );
      return agentIds.map((agentId, index) =>
        buildSubagentCardFromToolItem(item, {
          index: indexOffset + index,
          persona: personas[index],
          parentThreadId: options?.parentThreadId,
          override: {
            id: `${item.id}:${agentId}`,
            agentId,
            explicitThreadId: agentId,
            typeLabel: agentId,
            description: extractDescription(args, item),
          },
        }),
      );
    }
  }

  // Agent swarm：按 items / XML result 展开
  const swarmEntries = extractSwarmAgentEntries(item, args);
  if (swarmEntries.length > 0) {
    const personas = assignPersonasForSquad(swarmEntries.map((entry) => entry.id));
    return swarmEntries.map((entry, index) =>
      buildSubagentCardFromToolItem(item, {
        index: indexOffset + index,
        persona: personas[index],
        parentThreadId: options?.parentThreadId,
        override: {
          id: entry.id,
          agentId: entry.id.includes(":") ? entry.id.split(":").pop() ?? null : entry.id,
          description: entry.description,
          status: entry.status,
          typeLabel: extractTypeLabel(args, item),
        },
      }),
    );
  }

  return [
    buildSubagentCardFromToolItem(item, {
      index: indexOffset,
      parentThreadId: options?.parentThreadId,
    }),
  ];
}

export function buildSubagentCardsFromToolItems(
  items: readonly ToolItem[],
  options?: { parentThreadId?: string | null },
): SubagentCardViewModel[] {
  const cards: SubagentCardViewModel[] = [];
  items.forEach((item) => {
    const expanded = expandSubagentToolToCards(item, {
      parentThreadId: options?.parentThreadId,
      indexOffset: cards.length,
    });
    cards.push(...expanded);
  });
  // 同批 persona 尽量不重名：重算一次 squad persona
  const personas = assignPersonasForSquad(cards.map((card) => card.id));
  return cards.map((card, index) => ({
    ...card,
    ...applyPersonaFields(personas[index] ?? assignPersona(card.id)),
    indexLabel: formatIndexLabel(index),
  }));
}

export function buildSubagentCardFromSubagentInfo(
  agent: SubagentInfo,
  options?: { index?: number; parentThreadId?: string | null },
): SubagentCardViewModel {
  const persona = assignPersona(agent.id);
  const toolCount = null;
  const outputText = agent.taskOutput?.recentOutput ?? null;
  const agentIdFromOutput = extractAgentId(null, outputText);
  const navigationThreadId =
    agent.navigationTarget?.kind === "thread"
      ? agent.navigationTarget.threadId
      : null;
  const sessionThreadId =
    navigationThreadId ??
    agent.taskOutput?.threadId ??
    resolveSubagentSessionThreadId({
      parentThreadId: options?.parentThreadId,
      agentId: agentIdFromOutput ?? (agent.id.includes(":") ? agent.id : agent.id),
      explicitThreadId: navigationThreadId,
    });
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
    agentId: agentIdFromOutput ?? agent.id,
    sessionThreadId,
  };
}
