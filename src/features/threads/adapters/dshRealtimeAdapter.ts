import { buildDshGoalPresentationMetadata } from "../../../utils/dshRuntimeContext";
import type {
  NormalizedThreadEvent,
  RealtimeAdapter,
} from "../contracts/conversationCurtainContracts";
import { mapCommonRealtimeEvent } from "./sharedRealtimeAdapter";

function asString(value: unknown): string {
  return typeof value === "string" ? value : value ? String(value) : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function mapDshGoalInjectionRaw(input: unknown): NormalizedThreadEvent | null {
  const payload = asRecord(input);
  const workspaceId = asString(payload.workspaceId ?? "");
  const message = asRecord(payload.message);
  const method = asString(message.method ?? "");
  if (!workspaceId || method !== "dsh/raw") {
    return null;
  }
  const params = asRecord(message.params);
  if (asString(params.kind ?? "") !== "dsh-goal-injection") {
    return null;
  }
  const threadId = asString(params.threadId ?? params.thread_id ?? "");
  const text = asString(params.text ?? "");
  if (!threadId || !text.trim()) {
    return null;
  }
  const itemId = asString(params.id ?? "").trim() || `dsh-goal-${threadId}`;
  return {
    engine: "dsh",
    workspaceId,
    threadId,
    eventId: `${itemId}:started`,
    itemKind: "message",
    timestampMs: Date.now(),
    item: {
      id: itemId,
      kind: "message",
      role: "user",
      text,
      presentationMetadata: buildDshGoalPresentationMetadata(text),
    },
    operation: "itemStarted",
    sourceMethod: method,
    delta: null,
    rawItem: params,
    rawUsage: null,
    turnId: null,
  };
}

export const dshRealtimeAdapter: RealtimeAdapter = {
  engine: "dsh",
  mapEvent(input: unknown) {
    return (
      mapDshGoalInjectionRaw(input) ??
      mapCommonRealtimeEvent("dsh", input, {
        allowTextDeltaAlias: true,
      })
    );
  },
};
