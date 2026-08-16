import type { ConversationItem } from "../../../types";
import {
  isDshInjectedContextMessage,
  readDshMessageSourceKind,
} from "../../../utils/dshRuntimeContext";
import { asRecord, asString } from "./historyLoaderUtils";

function stringifyValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function parseDshHistoryMessages(messagesData: unknown): ConversationItem[] {
  if (!Array.isArray(messagesData)) {
    return [];
  }

  const items: ConversationItem[] = [];
  const toolIndexById = new Map<string, number>();

  for (const entry of messagesData) {
    const message = asRecord(entry);
    if (Object.keys(message).length === 0) {
      continue;
    }

    const kind = asString(message.kind ?? "").trim().toLowerCase();
    const itemId =
      asString(message.id ?? "").trim() || `dsh-history-item-${items.length + 1}`;

    if (kind === "message") {
      const role = asString(message.role ?? "").trim().toLowerCase() === "user"
        ? "user"
        : "assistant";
      const text = asString(message.text ?? "");
      if (!text.trim()) {
        continue;
      }
      if (
        role === "user" &&
        isDshInjectedContextMessage({
          text,
          sourceKind: readDshMessageSourceKind(message),
        })
      ) {
        continue;
      }
      items.push({
        id: itemId,
        kind: "message",
        role,
        text,
      });
      continue;
    }

    if (kind === "reasoning") {
      const text = asString(message.text ?? "").trim();
      if (!text) {
        continue;
      }
      const previous = items[items.length - 1];
      if (previous?.kind === "reasoning") {
        items[items.length - 1] = {
          ...previous,
          content: `${previous.content}\n\n${text}`,
        };
        continue;
      }
      items.push({
        id: itemId,
        kind: "reasoning",
        content: text,
        summary: text.split(/\r?\n/, 1)[0]?.slice(0, 100) ?? text,
      });
      continue;
    }

    if (kind !== "tool") {
      continue;
    }

    const title =
      asString(message.title ?? message.toolType ?? message.tool_type ?? "").trim() ||
      "Tool";
    const output = stringifyValue(
      message.toolOutput ?? message.tool_output ?? message.text ?? "",
    ).trim();
    const input = message.toolInput ?? message.tool_input ?? null;
    const existingIndex = toolIndexById.get(itemId);
    if (typeof existingIndex === "number") {
      const existing = items[existingIndex];
      if (existing?.kind === "tool") {
        items[existingIndex] = {
          ...existing,
          output: output || existing.output,
          status: output ? "completed" : existing.status,
        };
      }
      continue;
    }
    toolIndexById.set(itemId, items.length);
    items.push({
      id: itemId,
      kind: "tool",
      toolType: title,
      title,
      detail: stringifyValue(input).trim(),
      status: output ? "completed" : "in_progress",
      output: output || undefined,
    });
  }

  return items;
}
