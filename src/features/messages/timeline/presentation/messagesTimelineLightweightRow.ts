import type { TimelineProjectionRow } from "../projection/messagesTimelineProjection";

export function resolveTimelineLightweightRowSummary(
  row: TimelineProjectionRow,
  labels: { assistantMessage: string; userMessage: string },
) {
  const singleMessage =
    row.kind === "entry" && row.entry.kind === "item" && row.entry.item.kind === "message"
      ? row.entry.item
      : null;
  let rowKindLabel: string = row.kind;
  if (row.kind === "entry") {
    if (row.entry.kind !== "item") {
      rowKindLabel = row.entry.kind;
    } else if (singleMessage) {
      rowKindLabel = singleMessage.role === "assistant"
        ? labels.assistantMessage
        : labels.userMessage;
    } else {
      rowKindLabel = row.entry.item.kind;
    }
  }
  return {
    itemCount: row.kind === "entry" ? row.itemIds.length : 1,
    rowKindLabel,
    singleMessage,
  };
}
