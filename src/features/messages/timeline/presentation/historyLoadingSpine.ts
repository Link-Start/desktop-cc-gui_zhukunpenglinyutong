import type { HistoryLoadingPhaseId } from "../../../threads/utils/historyLoadingProgress";

export const HISTORY_LOADING_SPINE_NODE_IDS = [
  "prepare",
  "session",
  "projection",
  "merge",
] as const;

export type HistoryLoadingSpineNodeId =
  (typeof HISTORY_LOADING_SPINE_NODE_IDS)[number];

export type HistoryLoadingSpineNodeState = "pending" | "current" | "done";

export type HistoryLoadingSpineNode = {
  id: HistoryLoadingSpineNodeId;
  state: HistoryLoadingSpineNodeState;
};

export const HISTORY_LOADING_SPINE_PHASE_I18N_KEYS = {
  prepare: "restoringHistoryPhasePrepare",
  session: "restoringHistoryPhaseSession",
  projection: "restoringHistoryPhaseProjection",
  merge: "restoringHistoryPhaseMerge",
} as const;

export const NATIVE_HISTORY_LOADING_SPINE_PHASE_I18N_KEYS = {
  prepare: "restoringHistoryPhasePrepare",
  session: "restoringHistoryPhaseSession",
  projection: "restoringHistoryPhaseParse",
  merge: "restoringHistoryPhaseHydrate",
} as const;

export function resolveHistoryLoadingSpinePhaseI18nKeys(
  surface: "shared" | "native",
): Record<HistoryLoadingSpineNodeId, string> {
  return surface === "shared"
    ? HISTORY_LOADING_SPINE_PHASE_I18N_KEYS
    : NATIVE_HISTORY_LOADING_SPINE_PHASE_I18N_KEYS;
}

const SPINE_PHASE_INDEX: Record<HistoryLoadingPhaseId, number> = {
  prepare: 0,
  session: 1,
  projection: 2,
  merge: 3,
  finalize: 4,
};

export function resolveHistoryLoadingSpineNodes(
  phase: HistoryLoadingPhaseId | null,
): HistoryLoadingSpineNode[] {
  if (phase == null) {
    return [];
  }
  const currentIndex = SPINE_PHASE_INDEX[phase];
  return HISTORY_LOADING_SPINE_NODE_IDS.map((id, index) => {
    if (index < currentIndex) {
      return { id, state: "done" };
    }
    if (index === currentIndex) {
      return { id, state: "current" };
    }
    return { id, state: "pending" };
  });
}
