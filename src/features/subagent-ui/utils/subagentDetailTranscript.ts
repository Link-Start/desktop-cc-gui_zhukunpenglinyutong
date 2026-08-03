import type { ConversationItem } from "../../../types";

/**
 * 将合成/失败回退文本尽量整理成 Messages 可用的 user+assistant 消息，
 * 避免 Shared Codex 详情只显示「交付报告」元数据块（与 Grok 会话幕布不一致）。
 */
export function buildTranscriptItemsFromSubagentFallback(input: {
  cardId: string;
  description?: string | null;
  outputText?: string | null;
}): ConversationItem[] {
  const raw = (input.outputText ?? "").trim();
  const description = (input.description ?? "").trim();
  if (!raw && !description) {
    return [];
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const metaLine = (line: string) =>
    /^(subagent(\s+completed|\s+started)?|subagent_id\s*[:=]|type\s*[:=]|description\s*[:=]|status\s*[:=]|agentId\s*[:=]|output_file\s*[:=]|use get_command)/i.test(
      line,
    );

  const bodyLines = lines.filter((line) => !metaLine(line));
  const descFromMeta =
    lines
      .map((line) => /description\s*[:=]\s*(.+)/i.exec(line)?.[1]?.trim())
      .find(Boolean) || description;

  const assistantText = bodyLines.join("\n").trim();
  const items: ConversationItem[] = [];
  const baseId = input.cardId || "subagent-fallback";

  if (descFromMeta) {
    items.push({
      id: `${baseId}:user`,
      kind: "message",
      role: "user",
      text: descFromMeta,
    });
  }
  if (assistantText) {
    items.push({
      id: `${baseId}:assistant`,
      kind: "message",
      role: "assistant",
      text: assistantText,
      isFinal: true,
    });
  }

  // 若整段都是 meta 且没有正文，不生成假消息
  if (items.length === 0 && description) {
    items.push({
      id: `${baseId}:user`,
      kind: "message",
      role: "user",
      text: description,
    });
  }

  return items;
}

/** 是否是我们合成的 subagent 元数据块（不应原样当交付报告） */
export function isSyntheticSubagentMetaOutput(text: string | null | undefined): boolean {
  const raw = (text ?? "").trim();
  if (!raw) {
    return false;
  }
  return (
    /^Subagent (completed|started)/i.test(raw) &&
    /subagent_id\s*[:=]/i.test(raw) &&
    /status\s*[:=]/i.test(raw)
  );
}

/** Codex 官方加密 message / 无意义 token，禁止当交付报告 */
export function isOpaqueCiphertextOutput(text: string | null | undefined): boolean {
  const raw = (text ?? "").trim();
  if (!raw) {
    return false;
  }
  if (raw.startsWith("gAAAAA")) {
    return true;
  }
  if (
    raw.length >= 64 &&
    !/\s/.test(raw) &&
    !/[\u4e00-\u9fff]/.test(raw) &&
    /^[A-Za-z0-9+/=_:-]+$/.test(raw)
  ) {
    return true;
  }
  return false;
}
