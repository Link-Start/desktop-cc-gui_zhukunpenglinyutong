import type { EngineType } from "../../../types";
import engineIds from "../../engine/engineIds.json";

type Brand<Value, Name extends string> = Value & { readonly __brand: Name };

export type LogicalSessionId = Brand<string, "LogicalSessionId">;
export type NativeSessionId = Brand<string, "NativeSessionId">;
export type PendingSessionId = Brand<string, "PendingSessionId">;
export type EngineRunId = Brand<string, "EngineRunId">;
export type EngineTurnId = Brand<string, "EngineTurnId">;
export type EngineItemId = Brand<string, "EngineItemId">;

export type EngineRuntimeIdentity = {
  engine: EngineType;
  logicalSessionId: LogicalSessionId;
  nativeSessionId: NativeSessionId | null;
  pendingSessionId: PendingSessionId | null;
  source: "explicit" | "legacy-prefix" | "legacy-codex-fallback";
};

const ENGINE_IDS = new Set<EngineType>(engineIds.engineIds as EngineType[]);

function normalizeIdentityValue(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} must not be blank`);
  }
  return normalized;
}

export const asLogicalSessionId = (value: string) =>
  normalizeIdentityValue(value, "logicalSessionId") as LogicalSessionId;
export const asNativeSessionId = (value: string) =>
  normalizeIdentityValue(value, "nativeSessionId") as NativeSessionId;
export const asPendingSessionId = (value: string) =>
  normalizeIdentityValue(value, "pendingSessionId") as PendingSessionId;
export const asEngineRunId = (value: string) =>
  normalizeIdentityValue(value, "runId") as EngineRunId;
export const asEngineTurnId = (value: string) =>
  normalizeIdentityValue(value, "turnId") as EngineTurnId;
export const asEngineItemId = (value: string) =>
  normalizeIdentityValue(value, "itemId") as EngineItemId;

export function parseLegacyThreadIdentity(threadId: string): EngineRuntimeIdentity {
  const normalizedThreadId = normalizeIdentityValue(threadId, "threadId");
  const normalizedLowerCase = normalizedThreadId.toLowerCase();
  for (const engine of ENGINE_IDS) {
    if (normalizedLowerCase.startsWith(`${engine}:`)) {
      return {
        engine,
        logicalSessionId: asLogicalSessionId(normalizedThreadId),
        nativeSessionId: asNativeSessionId(normalizedThreadId.slice(engine.length + 1)),
        pendingSessionId: null,
        source: "legacy-prefix",
      };
    }
    if (normalizedLowerCase.startsWith(`${engine}-pending-`)) {
      return {
        engine,
        logicalSessionId: asLogicalSessionId(normalizedThreadId),
        nativeSessionId: null,
        pendingSessionId: asPendingSessionId(normalizedThreadId),
        source: "legacy-prefix",
      };
    }
  }
  return {
    engine: "codex",
    logicalSessionId: asLogicalSessionId(normalizedThreadId),
    nativeSessionId: null,
    pendingSessionId: null,
    source: "legacy-codex-fallback",
  };
}

export function createEngineRuntimeIdentity(input: {
  engine: EngineType;
  logicalSessionId: string;
  nativeSessionId?: string | null;
  pendingSessionId?: string | null;
}): EngineRuntimeIdentity {
  return {
    engine: input.engine,
    logicalSessionId: asLogicalSessionId(input.logicalSessionId),
    nativeSessionId: input.nativeSessionId ? asNativeSessionId(input.nativeSessionId) : null,
    pendingSessionId: input.pendingSessionId ? asPendingSessionId(input.pendingSessionId) : null,
    source: "explicit",
  };
}

export function inferEngineFromLegacyThreadId(threadId: string): EngineType {
  return parseLegacyThreadIdentity(threadId).engine;
}

export function isPendingSessionForEngine(
  engine: EngineType,
  threadId: string | null | undefined,
): threadId is string {
  if (!threadId?.trim()) {
    return false;
  }
  const identity = parseLegacyThreadIdentity(threadId);
  return identity.engine === engine && identity.pendingSessionId !== null;
}
