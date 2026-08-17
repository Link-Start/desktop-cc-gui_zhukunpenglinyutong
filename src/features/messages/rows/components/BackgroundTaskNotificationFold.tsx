import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import { CollapsibleReveal } from "../../../../components/common/CollapsibleReveal";
import { EngineTaskOutputInspector } from "../../../engine-task-output/components/EngineTaskOutputInspector";
import {
  extractBackgroundCommandTitle,
  type AgentTaskNotification,
} from "../../../engine-task-output/contracts/agentTaskNotification";
import { useEngineTaskOutputSnapshot } from "../../../engine-task-output/hooks/useEngineTaskOutputSnapshot";
import type { EngineTaskOutputSnapshot } from "../../../engine-task-output/types";
import { normalizeAgentTaskStatus } from "../../utils/messagesRenderUtils";

type BackgroundTaskNotificationFoldProps = {
  notification: AgentTaskNotification;
  workspaceId: string;
  outputSnapshot: EngineTaskOutputSnapshot | null;
};

type FoldField = {
  key: string;
  label: string;
  value: string;
};

function resolveFoldHeadline(
  tone: ReturnType<typeof normalizeAgentTaskStatus>["tone"],
  translate: (key: string) => string,
): string {
  if (tone === "completed") {
    return translate("messages.backgroundTaskFoldCompleted");
  }
  if (tone === "error") {
    return translate("messages.backgroundTaskFoldFailed");
  }
  if (tone === "running") {
    return translate("messages.backgroundTaskFoldRunning");
  }
  return translate("messages.backgroundTaskFoldNeutral");
}

function collectVisibleFoldFields(
  notification: AgentTaskNotification,
  translate: (key: string) => string,
): FoldField[] {
  const candidates: Array<[string, string, string | null]> = [
    ["task-id", translate("messages.backgroundTaskFoldFieldTaskId"), notification.taskId],
    ["tool-use-id", translate("messages.backgroundTaskFoldFieldToolUseId"), notification.toolUseId],
    ["output-file", translate("messages.backgroundTaskFoldFieldOutputFile"), notification.outputFile],
    ["status", translate("messages.backgroundTaskFoldFieldStatus"), notification.status],
    ["summary", translate("messages.backgroundTaskFoldFieldSummary"), notification.summary],
    ["result", translate("messages.backgroundTaskFoldFieldResult"), notification.resultText],
  ];
  return candidates.flatMap(([key, label, value]) => {
    const trimmed = value?.trim() ?? "";
    return trimmed ? [{ key, label, value: trimmed }] : [];
  });
}

/**
 * 后台 Bash / shell wakeup 的幕布折叠条。
 * 默认只露 process-phase 风格摘要，不进用户蓝气泡、不进 legacy Agent session 卡。
 */
export const BackgroundTaskNotificationFold = memo(
  function BackgroundTaskNotificationFold({
    notification,
    workspaceId,
    outputSnapshot,
  }: BackgroundTaskNotificationFoldProps) {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const inspectedTaskOutputState = useEngineTaskOutputSnapshot({
      workspaceId,
      snapshot: isExpanded ? outputSnapshot : null,
    });
    const status = normalizeAgentTaskStatus(notification.status);
    const commandTitle = extractBackgroundCommandTitle(notification.summary);
    const headline = resolveFoldHeadline(status.tone, t);
    const collapsedLabel = commandTitle ? `${headline} · ${commandTitle}` : headline;
    const statusLabel = (notification.status ?? status.label).trim() || status.label;
    const fields = useMemo(
      () => collectVisibleFoldFields(notification, t),
      [notification, t],
    );
    const inspectorSnapshot = outputSnapshot
      ? (inspectedTaskOutputState.snapshot ?? outputSnapshot)
      : null;
    const ariaLabel = `${collapsedLabel}. ${
      isExpanded
        ? t("messages.backgroundTaskFoldCollapse")
        : t("messages.backgroundTaskFoldExpand")
    }`;

    return (
      <div
        className={`message-agent-task-fold-drawer${
          isExpanded ? " is-expanded" : " is-collapsed"
        }`}
        data-testid="background-task-notification-fold"
      >
        <button
          type="button"
          className={`messages-process-phase-toggle${
            isExpanded ? " is-expanded" : " is-collapsed"
          }`}
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          aria-label={ariaLabel}
        >
          <span className="messages-process-phase-toggle-copy">
            <span className={`message-agent-task-fold-status is-${status.tone}`}>
              {statusLabel}
            </span>
            <span className="message-agent-task-fold-label">{collapsedLabel}</span>
            <ChevronRight
              className="messages-process-phase-toggle-chevron"
              size={14}
              strokeWidth={2}
              aria-hidden
            />
          </span>
          <span className="messages-process-phase-toggle-rule" aria-hidden />
        </button>
        <CollapsibleReveal open={isExpanded}>
          <div className="message-agent-task-fold-detail">
            {inspectorSnapshot ? (
              <EngineTaskOutputInspector
                snapshot={inspectorSnapshot}
                refreshState={inspectedTaskOutputState.refreshState}
                onRefresh={inspectedTaskOutputState.refresh}
                className="border-border/60 bg-muted/30 shadow-none before:hidden"
              />
            ) : fields.length > 0 ? (
              <dl className="message-agent-task-fold-kv">
                {fields.map((field) => (
                  <div key={field.key} className="message-agent-task-fold-kv-row">
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </CollapsibleReveal>
      </div>
    );
  },
);
