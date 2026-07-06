import type { ConversationItem } from "../types";
import { resolveGeneratedImageArtifact } from "./generatedImageArtifacts";

function asString(value: unknown) {
  return typeof value === "string" ? value : value ? String(value) : "";
}

function normalizeConversationItemType(value: string) {
  return value.trim().toLowerCase();
}

export function isNativeGeneratedImageItemType(value: string) {
  const normalized = normalizeConversationItemType(value);
  return (
    normalized === "generatedimage" ||
    normalized === "generated_image" ||
    normalized === "image_generation_call" ||
    normalized === "imagegenerationcall" ||
    normalized === "image_generation_end" ||
    normalized === "imagegenerationend"
  );
}

export function resolveConversationItemId(
  type: string,
  item: Record<string, unknown>,
) {
  const directId = asString(item.id ?? "").trim();
  if (directId) {
    return directId;
  }
  if (!isNativeGeneratedImageItemType(type)) {
    return "";
  }
  return asString(
    item.call_id ?? item.callId ?? item.item_id ?? item.itemId ?? "",
  ).trim();
}

export function buildGeneratedImageConversationItem(
  id: string,
  type: string,
  item: Record<string, unknown>,
): Extract<ConversationItem, { kind: "generatedImage" }> {
  const artifact = resolveGeneratedImageArtifact(
    asString(item.status ?? ""),
    item.arguments ?? item.input ?? item,
    item,
  );
  const sourceToolName = asString(item.tool ?? item.name ?? type).trim() || type;
  return {
    id,
    kind: "generatedImage",
    status: artifact.status,
    sourceToolName,
    promptText: artifact.promptText,
    fallbackText: artifact.fallbackText,
    images: artifact.images,
  };
}
