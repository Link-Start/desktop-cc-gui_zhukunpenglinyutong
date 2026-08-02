import type { ConversationItem, ThreadSummary } from "../../../types";
import { resolveSyntheticChildToolStatus } from "./subagentCardStatus";

type ChildStatusOptions = {
  statusById?: Record<string, { isProcessing?: boolean }>;
  itemsByThread?: Record<string, ConversationItem[] | undefined>;
};

/**
 * Shared 投影缺 spawn_subagent tool 时，用已挂到父会话下的子线程合成 tool items，
 * 以便 groupToolItems → SubagentSquadGrid 与 native 一致。
 */
export function buildSyntheticSpawnToolsFromChildren(
  children: readonly ThreadSummary[],
  options?: ChildStatusOptions,
): Extract<ConversationItem, { kind: "tool" }>[] {
  return children.map((thread, index) => {
    const rawId = thread.id.trim();
    // 保留完整 thread id（grok:… / claude:…），避免 shared 父下详情走错 loader
    const description = thread.name?.trim() || `SubAgent ${index + 1}`;
    const cardStatus = resolveSyntheticChildToolStatus(rawId, {
      isDegraded: thread.isDegraded,
      statusById: options?.statusById,
      itemsByThread: options?.itemsByThread,
    });
    const childItems = options?.itemsByThread?.[rawId] ?? [];
    const assistantTail = childItems
      .filter(
        (item): item is Extract<ConversationItem, { kind: "message" }> =>
          item.kind === "message" &&
          item.role === "assistant" &&
          typeof item.text === "string" &&
          item.text.trim().length > 0,
      )
      .map((item) => item.text.trim())
      .slice(-2)
      .join("\n");
    return {
      id: `synthetic-shared-subagent:${rawId}`,
      kind: "tool" as const,
      toolType: "spawn_subagent",
      title: "Spawn Subagent",
      detail: JSON.stringify({
        description,
        subagent_type: "general-purpose",
        subagent_id: rawId,
      }),
      status: cardStatus === "running" ? "running" : "completed",
      output: [
        cardStatus === "completed"
          ? "Subagent completed."
          : "Subagent started in background.",
        `subagent_id: ${rawId}`,
        "type: general-purpose",
        `description: ${description}`,
        cardStatus === "completed" ? "status: completed" : "status: running",
        ...(assistantTail ? [assistantTail] : []),
      ].join("\n"),
    };
  });
}

/**
 * 若 timeline 尚无 subagent tool，则把 synthetic tools 插到最后一条 user 消息之后。
 */
export function injectSyntheticSubagentToolsIfNeeded(
  items: readonly ConversationItem[],
  syntheticTools: readonly Extract<ConversationItem, { kind: "tool" }>[],
): ConversationItem[] {
  if (syntheticTools.length === 0) {
    return items as ConversationItem[];
  }
  let lastUserIndex = -1;
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item?.kind === "message" && item.role === "user") {
      lastUserIndex = i;
      break;
    }
  }
  if (lastUserIndex < 0) {
    return [...items, ...syntheticTools];
  }
  return [
    ...items.slice(0, lastUserIndex + 1),
    ...syntheticTools,
    ...items.slice(lastUserIndex + 1),
  ];
}
