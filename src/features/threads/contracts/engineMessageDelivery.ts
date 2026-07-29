import type { EngineType } from "../../../types";
import {
  getEngineCapabilityState,
  type EngineCapabilityState,
} from "../../engine/engineCapabilityMatrix";

export type EngineMessageDeliveryIntent =
  "prompt" | "steer" | "followUp" | "nextTurn";

export type EngineMessageDeliveryRequest = Readonly<{
  intent: EngineMessageDeliveryIntent;
  engine: EngineType;
  sessionId: string | null;
  activeRunId: string | null;
  allowFollowUpFallback?: boolean;
}>;

export type EngineMessageDeliveryEvidence = Readonly<{
  activeRun: boolean;
  midTurnCapability: EngineCapabilityState;
}>;

export type EngineMessageDeliveryResult =
  | Readonly<{
      status: "accepted";
      intent: EngineMessageDeliveryIntent;
      route: "dispatch" | "steer" | "queue";
      evidence: EngineMessageDeliveryEvidence;
    }>
  | Readonly<{
      status: "degraded";
      intent: EngineMessageDeliveryIntent;
      route: "steer" | "queue";
      fallbackIntent?: "followUp";
      reason: string;
      evidence: EngineMessageDeliveryEvidence;
    }>
  | Readonly<{
      status: "rejected";
      intent: EngineMessageDeliveryIntent;
      reason: string;
      evidence: EngineMessageDeliveryEvidence;
    }>;

function rejectOrQueueFallback(
  request: EngineMessageDeliveryRequest,
  evidence: EngineMessageDeliveryEvidence,
  reason: string,
): EngineMessageDeliveryResult {
  if (request.allowFollowUpFallback && request.sessionId) {
    return {
      status: "degraded",
      intent: request.intent,
      route: "queue",
      fallbackIntent: "followUp",
      reason,
      evidence,
    };
  }
  return { status: "rejected", intent: request.intent, reason, evidence };
}

export function decideEngineMessageDelivery(
  request: EngineMessageDeliveryRequest,
): EngineMessageDeliveryResult {
  const midTurnCapability = getEngineCapabilityState(
    request.engine,
    "input.mid-turn",
  );
  const evidence = {
    activeRun: Boolean(request.activeRunId),
    midTurnCapability,
  } satisfies EngineMessageDeliveryEvidence;

  if (request.intent === "prompt" || request.intent === "nextTurn") {
    if (request.activeRunId) {
      return {
        status: "rejected",
        intent: request.intent,
        reason: "active-run-requires-explicit-steer-or-follow-up",
        evidence,
      };
    }
    return {
      status: "accepted",
      intent: request.intent,
      route: "dispatch",
      evidence,
    };
  }

  if (request.intent === "followUp") {
    if (!request.sessionId) {
      return {
        status: "rejected",
        intent: request.intent,
        reason: "logical-session-required",
        evidence,
      };
    }
    return {
      status: "accepted",
      intent: request.intent,
      route: "queue",
      evidence,
    };
  }

  if (!request.activeRunId) {
    return rejectOrQueueFallback(request, evidence, "active-run-required");
  }
  if (midTurnCapability === "compat-input") {
    return rejectOrQueueFallback(
      request,
      evidence,
      "input.mid-turn:compat-input",
    );
  }
  if (midTurnCapability !== "supported") {
    return rejectOrQueueFallback(
      request,
      evidence,
      `input.mid-turn:${midTurnCapability}`,
    );
  }
  return {
    status: "accepted",
    intent: request.intent,
    route: "steer",
    evidence,
  };
}

export type EngineMessageDeliveryDiagnostic = Readonly<{
  intent: EngineMessageDeliveryIntent;
  engine: EngineType;
  sessionId: string | null;
  runId: string | null;
  result: EngineMessageDeliveryResult["status"];
  route: "dispatch" | "steer" | "queue" | null;
  reason: string | null;
  evidence: EngineMessageDeliveryEvidence;
}>;

export function createEngineMessageDeliveryDiagnostic(
  request: EngineMessageDeliveryRequest,
  result: EngineMessageDeliveryResult,
): EngineMessageDeliveryDiagnostic {
  return Object.freeze({
    intent: request.intent,
    engine: request.engine,
    sessionId: request.sessionId,
    runId: request.activeRunId,
    result: result.status,
    route: result.status === "rejected" ? null : result.route,
    reason: result.status === "accepted" ? null : result.reason,
    evidence: result.evidence,
  });
}
