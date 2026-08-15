import type { TFunction } from "i18next";
import type {
  ProjectMemoryHealthState,
  ProjectMemoryReviewState,
} from "../utils/projectMemoryDisplay";
import { getProjectMemoryDisplayRecordKind } from "../utils/projectMemoryDisplay";

export function createProjectMemoryPanelLabels(t: TFunction) {
  const kindLabel = (value: string) => {
    switch (value) {
      case "project_context":
        return t("memory.kind.projectContext");
      case "conversation":
        return t("memory.kind.conversation");
      case "code_decision":
        return t("memory.kind.codeDecision");
      case "known_issue":
        return t("memory.kind.knownIssue");
      case "note":
        return t("memory.kind.note");
      default:
        return value;
    }
  };
  const importanceLabel = (value: string) => {
    switch (value) {
      case "high":
        return t("memory.importance.high");
      case "medium":
        return t("memory.importance.medium");
      case "low":
        return t("memory.importance.low");
      default:
        return value;
    }
  };
  const recordKindLabel = (value: ReturnType<typeof getProjectMemoryDisplayRecordKind>) => {
    switch (value) {
      case "conversation_turn":
        return t("memory.recordKind.conversationTurn");
      case "manual_note":
        return t("memory.recordKind.manualNote");
      case "legacy":
        return t("memory.recordKind.legacy");
      default:
        return value;
    }
  };
  const healthStateLabel = (value: ProjectMemoryHealthState) => {
    switch (value) {
      case "complete":
        return t("memory.health.complete");
      case "input_only":
        return t("memory.health.inputOnly");
      case "assistant_only":
        return t("memory.health.assistantOnly");
      case "pending_fusion":
        return t("memory.health.pendingFusion");
      case "capture_failed":
        return t("memory.health.captureFailed");
      default:
        return value;
    }
  };
  const reviewStateLabel = (value: ProjectMemoryReviewState) => {
    switch (value) {
      case "unreviewed":
        return t("memory.review.unreviewed");
      case "kept":
        return t("memory.review.kept");
      case "converted":
        return t("memory.review.converted");
      case "obsolete":
        return t("memory.review.obsolete");
      case "dismissed":
        return t("memory.review.dismissed");
      default:
        return value;
    }
  };
  return {
    kindLabel,
    importanceLabel,
    recordKindLabel,
    healthStateLabel,
    reviewStateLabel,
  };
}

export type ProjectMemoryPanelLabels = ReturnType<typeof createProjectMemoryPanelLabels>;
