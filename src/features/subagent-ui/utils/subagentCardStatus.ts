import type { ConversationItem } from "../../../types";
import type { SubagentCardStatus, SubagentCardViewModel } from "./subagentViewModel";

type ThreadProcessingHint = {
  isProcessing?: boolean;
};

/**
 * 子代理 tool output 是否已表达「任务结束」（即便 item.status 仍是 started/running）。
 */
export function isSubagentFinishedOutput(output: string | null | undefined): boolean {
  const text = typeof output === "string" ? output.trim() : "";
  if (!text) {
    return false;
  }
  if (/(fail|error|abort|timeout)/i.test(text.slice(0, 400)) && /failed|error/i.test(text)) {
    // 明确失败留给 error 路径；这里不算 finished-success
  }
  if (/outcome\s*=\s*["']?(completed|success)["']?/i.test(text)) {
    return true;
  }
  if (/\[completed\]/i.test(text) || /status["']?\s*:\s*["']?completed/i.test(text)) {
    return true;
  }
  if (/duration_ms\s*=\s*\d+/i.test(text) && /subagent_meta/i.test(text)) {
    return true;
  }
  if (/Exit Code:\s*0/i.test(text) && /\[completed\]/i.test(text)) {
    return true;
  }
  if (/All\d*\s*subagents?\s+completed/i.test(text)) {
    return true;
  }
  // 仅有启动回执 → 未完成
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const onlyStartAck = lines.every((line) =>
    /^(subagent started|subagent_id\s*[:=]|type\s*[:=]|description\s*[:=]|use get_command|async agent launched)/i.test(
      line,
    ),
  );
  if (onlyStartAck) {
    return false;
  }
  // 有实质正文（问候/汇报）且超过启动回执
  if (
    lines.length >= 2 &&
    /(你好|hello|hi[!！]|完成|completed|任务|问候|欢迎)/i.test(text)
  ) {
    return true;
  }
  return false;
}

export function isSubagentFailedOutput(output: string | null | undefined): boolean {
  const text = typeof output === "string" ? output.trim() : "";
  if (!text) {
    return false;
  }
  return (
    /outcome\s*=\s*["']?(failed|error)["']?/i.test(text) ||
    /\[failed\]/i.test(text) ||
    /Exit Code:\s*[1-9]/i.test(text)
  );
}

function childThreadLooksCompleted(
  sessionThreadId: string | null,
  statusById: Record<string, ThreadProcessingHint> | undefined,
  itemsByThread: Record<string, ConversationItem[] | undefined> | undefined,
): boolean {
  if (!sessionThreadId) {
    return false;
  }
  const processing = statusById?.[sessionThreadId]?.isProcessing;
  // 明确仍在跑
  if (processing === true) {
    return false;
  }
  const items = itemsByThread?.[sessionThreadId] ?? [];
  const hasAssistantText = items.some(
    (item) =>
      item.kind === "message" &&
      item.role === "assistant" &&
      typeof item.text === "string" &&
      item.text.trim().length > 0,
  );
  if (hasAssistantText) {
    return true;
  }
  // 状态表写明 idle → 完成（历史子会话 / 侧栏绿点已灭）
  if (processing === false) {
    return true;
  }
  // 无状态条目且无缓存：无法判断，交给 output 启发式
  return false;
}

/**
 * 纠正 persona 卡状态：tool 卡 stuck 在 started/running、合成卡误用 isDegraded 时，
 * 结合 output / 子会话 items / isProcessing 升级为 completed。
 */
export function enrichSubagentCardStatuses(
  cards: readonly SubagentCardViewModel[],
  options?: {
    statusById?: Record<string, ThreadProcessingHint>;
    itemsByThread?: Record<string, ConversationItem[] | undefined>;
  },
): SubagentCardViewModel[] {
  return cards.map((card) => {
    if (card.status === "error") {
      return card;
    }
    if (card.status === "completed") {
      // 若子会话仍在 processing，降回 running
      const sessionId = card.sessionThreadId;
      if (
        sessionId &&
        options?.statusById?.[sessionId]?.isProcessing === true
      ) {
        return {
          ...card,
          status: "running" as const,
          progress: Math.min(card.progress, 0.85),
        };
      }
      return card;
    }

    // running → 尝试升级
    if (isSubagentFailedOutput(card.outputText)) {
      return { ...card, status: "error" as const, progress: 1 };
    }
    if (isSubagentFinishedOutput(card.outputText)) {
      return { ...card, status: "completed" as const, progress: 1 };
    }
    if (
      childThreadLooksCompleted(
        card.sessionThreadId,
        options?.statusById,
        options?.itemsByThread,
      )
    ) {
      return { ...card, status: "completed" as const, progress: 1 };
    }
    return card;
  });
}

export function resolveSyntheticChildToolStatus(
  threadId: string,
  options?: {
    isDegraded?: boolean;
    statusById?: Record<string, ThreadProcessingHint>;
    itemsByThread?: Record<string, ConversationItem[] | undefined>;
  },
): SubagentCardStatus {
  if (options?.statusById?.[threadId]?.isProcessing === true) {
    return "running";
  }
  if (
    childThreadLooksCompleted(
      threadId,
      options?.statusById,
      options?.itemsByThread,
    )
  ) {
    return "completed";
  }
  // 历史子会话默认 completed；仅明确 degraded 且无正文时 running
  if (options?.isDegraded) {
    return "running";
  }
  return "completed";
}
