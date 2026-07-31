import {
  sharedSessionV2AwaitTurnTerminal,
  type SharedV2ActiveAttemptRecovery,
  type SharedV2AwaitTurnTerminalResult,
} from "../services/sharedSessions";
import { beginTurn, endTurn } from "../target/targetStore";
import type { TurnExecutionSnapshot } from "../target/types";
import type { EngineType } from "../../../types";
import {
  isSharedSessionSupportedEngine,
  type SharedSessionSupportedEngine,
} from "../utils/sharedSessionEngines";
import {
  dispatchSharedSendEvent,
  getSharedSendActiveAttemptId,
  setSharedSendActiveAttempt,
} from "./sharedSendStateStore";
import { registerSharedSessionNativeBinding } from "./sharedSessionBridge";

type ActiveRecoveryOwner = {
  attemptId: string;
  bindingKey: string;
  nativeThreadId: string;
  runtimeTurnId: string;
  executionTargetSnapshot: TurnExecutionSnapshot & {
    engine: SharedSessionSupportedEngine;
  };
};

export type SharedSessionAttemptSettlement = {
  workspaceId: string;
  threadId: string;
  attemptId: string;
  runtimeTurnId: string;
  commit: SharedV2AwaitTurnTerminalResult;
};

type SettlementListener = (settlement: SharedSessionAttemptSettlement) => void;

const activeReattachments = new Map<
  string,
  Promise<SharedV2AwaitTurnTerminalResult>
>();
const settlementListeners = new Set<SettlementListener>();

function requiredIdentity(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`shared-active-recovery-invalid: ${field} is required`);
  }
  return value.trim();
}

function normalizeActiveRecovery(
  recovery: SharedV2ActiveAttemptRecovery,
): ActiveRecoveryOwner {
  const rawSnapshot = recovery.executionTargetSnapshot;
  if (!rawSnapshot || typeof rawSnapshot !== "object") {
    throw new Error(
      "shared-active-recovery-invalid: executionTargetSnapshot is required",
    );
  }
  const engine = requiredIdentity(
    rawSnapshot.engine,
    "target.engine",
  ).toLowerCase() as EngineType;
  if (!isSharedSessionSupportedEngine(engine)) {
    throw new Error(
      `shared-active-recovery-invalid: unsupported target.engine ${engine}`,
    );
  }
  const providerProfileSource = rawSnapshot.providerProfileSource;
  const providerProfileId =
    typeof rawSnapshot.providerProfileId === "string" &&
    rawSnapshot.providerProfileId.trim()
      ? rawSnapshot.providerProfileId.trim()
      : null;
  if (
    (providerProfileSource === "local" && providerProfileId !== null) ||
    (providerProfileSource === "managed" && providerProfileId === null) ||
    (providerProfileSource !== "local" && providerProfileSource !== "managed")
  ) {
    throw new Error(
      "shared-active-recovery-invalid: target provider identity is inconsistent",
    );
  }
  const reasoning = rawSnapshot.reasoning;
  const normalizedReasoning =
    reasoning === null || reasoning === undefined
      ? null
      : {
          effort: requiredIdentity(reasoning.effort, "target.reasoning.effort"),
        };
  const executionTargetSnapshot: ActiveRecoveryOwner["executionTargetSnapshot"] =
    Object.freeze({
      engine,
      providerProfileId,
      modelCatalogEntryId: requiredIdentity(
        rawSnapshot.modelCatalogEntryId,
        "target.modelCatalogEntryId",
      ),
      model: requiredIdentity(rawSnapshot.model, "target.model"),
      reasoning: normalizedReasoning,
      providerProfileNameSnapshot: requiredIdentity(
        rawSnapshot.providerProfileNameSnapshot,
        "target.providerProfileNameSnapshot",
      ),
      providerProfileSource,
      runtimeCapabilityFingerprint:
        typeof rawSnapshot.runtimeCapabilityFingerprint === "string" &&
        rawSnapshot.runtimeCapabilityFingerprint.trim()
          ? rawSnapshot.runtimeCapabilityFingerprint.trim()
          : null,
    });
  return {
    attemptId: requiredIdentity(recovery.attemptId, "attemptId"),
    bindingKey: requiredIdentity(recovery.bindingKey, "bindingKey"),
    nativeThreadId: requiredIdentity(recovery.nativeThreadId, "nativeThreadId"),
    runtimeTurnId: requiredIdentity(recovery.runtimeTurnId, "runtimeTurnId"),
    executionTargetSnapshot,
  };
}

function reattachmentKey(
  workspaceId: string,
  threadId: string,
  attemptId: string,
): string {
  return JSON.stringify([workspaceId, threadId, attemptId]);
}

export function subscribeSharedSessionAttemptSettlements(
  listener: SettlementListener,
): () => void {
  settlementListeners.add(listener);
  return () => {
    settlementListeners.delete(listener);
  };
}

function publishSettlement(settlement: SharedSessionAttemptSettlement): void {
  settlementListeners.forEach((listener) => {
    try {
      listener(settlement);
    } catch (error) {
      console.error(
        "[shared-session] reattachment settlement listener failed",
        error,
      );
    }
  });
}

export function reattachSharedSessionAttempt(
  workspaceId: string,
  threadId: string,
  recovery: SharedV2ActiveAttemptRecovery,
): Promise<SharedV2AwaitTurnTerminalResult> {
  const normalizedWorkspaceId = requiredIdentity(workspaceId, "workspaceId");
  const normalizedThreadId = requiredIdentity(threadId, "threadId");
  const owner = normalizeActiveRecovery(recovery);
  const key = reattachmentKey(
    normalizedWorkspaceId,
    normalizedThreadId,
    owner.attemptId,
  );
  const existing = activeReattachments.get(key);
  if (existing) {
    return existing;
  }

  if (
    !registerSharedSessionNativeBinding({
      workspaceId: normalizedWorkspaceId,
      sharedThreadId: normalizedThreadId,
      nativeThreadId: owner.nativeThreadId,
      engine: owner.executionTargetSnapshot.engine,
      providerProfileId: owner.executionTargetSnapshot.providerProfileId,
      attemptId: owner.attemptId,
      executionTargetSnapshot: owner.executionTargetSnapshot,
    })
  ) {
    throw new Error(
      "shared-active-recovery-invalid: native binding conflicts with another Shared thread",
    );
  }

  const observer: Promise<SharedV2AwaitTurnTerminalResult> =
    sharedSessionV2AwaitTurnTerminal(
      normalizedWorkspaceId,
      normalizedThreadId,
      owner.attemptId,
    )
      .then((commit) => {
        const ownsCurrentLifecycle =
          getSharedSendActiveAttemptId(
            normalizedWorkspaceId,
            normalizedThreadId,
          ) === owner.attemptId;
        // terminal barrier subscriber 必须先于 processing/send-state cleanup 观察
        // durable commit；即使 owner 已换代，旧 Runtime identity 仍需安装 barrier。
        publishSettlement({
          workspaceId: normalizedWorkspaceId,
          threadId: normalizedThreadId,
          attemptId: owner.attemptId,
          runtimeTurnId: owner.runtimeTurnId,
          commit,
        });
        if (!ownsCurrentLifecycle) {
          return commit;
        }
        dispatchSharedSendEvent(normalizedWorkspaceId, normalizedThreadId, {
          type: "runSettled",
        });
        if (commit.terminal.recoveryReason === "native-session-not-found") {
          dispatchSharedSendEvent(normalizedWorkspaceId, normalizedThreadId, {
            type: "bindingRecoveryRequired",
          });
        } else {
          dispatchSharedSendEvent(normalizedWorkspaceId, normalizedThreadId, {
            type: "canonicalCommitted",
          });
        }
        setSharedSendActiveAttempt(
          normalizedWorkspaceId,
          normalizedThreadId,
          null,
        );
        endTurn(
          normalizedWorkspaceId,
          normalizedThreadId,
          owner.attemptId,
        );
        return commit;
      })
      .catch((error: unknown) => {
        dispatchSharedSendEvent(normalizedWorkspaceId, normalizedThreadId, {
          type: "connectionLost",
        });
        throw error;
      })
      .finally(() => {
        if (activeReattachments.get(key) === observer) {
          activeReattachments.delete(key);
        }
      });

  activeReattachments.set(key, observer);
  setSharedSendActiveAttempt(
    normalizedWorkspaceId,
    normalizedThreadId,
    owner.attemptId,
  );
  beginTurn(
    normalizedWorkspaceId,
    normalizedThreadId,
    owner.executionTargetSnapshot,
    owner.attemptId,
  );
  dispatchSharedSendEvent(normalizedWorkspaceId, normalizedThreadId, {
    type: "probeActiveRun",
  });
  return observer;
}

export function resetSharedSessionAttemptReattachmentsForTests(): void {
  activeReattachments.clear();
  settlementListeners.clear();
}
