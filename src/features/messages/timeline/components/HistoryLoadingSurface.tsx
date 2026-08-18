import { useTranslation } from "react-i18next";
import appLogo from "../../../../assets/icon.png";
import type { HistoryLoadingProgress } from "../../../threads/utils/historyLoadingProgress";
import {
  HISTORY_LOADING_SPINE_PHASE_I18N_KEYS,
  resolveHistoryLoadingSpineNodes,
  type HistoryLoadingSpineNodeState,
} from "../presentation/historyLoadingSpine";

type HistoryLoadingSurfaceProps = {
  progress: HistoryLoadingProgress | null;
};

function spineNodeClassName(state: HistoryLoadingSpineNodeState): string {
  if (state === "done") {
    return "messages-history-loading-node is-done";
  }
  if (state === "current") {
    return "messages-history-loading-node is-current";
  }
  return "messages-history-loading-node";
}

export function HistoryLoadingSurface({ progress }: HistoryLoadingSurfaceProps) {
  const { t } = useTranslation();
  const title = progress
    ? t(`messages.${progress.titleKey}`, progress.detailParams)
    : t("messages.restoringHistory");
  const detail = progress
    ? t(`messages.${progress.detailKey}`, progress.detailParams)
    : t("messages.restoringHistoryHint");
  const percent = progress?.percent ?? null;
  const spineNodes = resolveHistoryLoadingSpineNodes(progress?.phase ?? null);
  const isShared = progress != null;

  return (
    <div
      className="empty messages-empty messages-history-loading"
      data-history-loading-mode={isShared ? "shared" : "native"}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="messages-history-loading-rail"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-label={title}
      >
        {isShared ? (
          <div className="messages-history-loading-nodes" aria-hidden="true">
            {spineNodes.map((node) => (
              <span
                key={node.id}
                className={spineNodeClassName(node.state)}
                data-spine-node={node.id}
              />
            ))}
          </div>
        ) : (
          <div className="messages-history-loading-track" aria-hidden="true">
            <div className="messages-history-loading-shuttle">
              <span className="messages-history-loading-traveler" />
            </div>
          </div>
        )}
        <img
          className="messages-history-loading-logo"
          src={appLogo}
          alt=""
          draggable={false}
        />
      </div>
      <div className="messages-history-loading-copy">
        <strong>{title}</strong>
        <span>{detail}</span>
        {isShared ? (
          <div className="messages-history-loading-phases" aria-hidden="true">
            {spineNodes.map((node) => {
              const label = t(
                `messages.${HISTORY_LOADING_SPINE_PHASE_I18N_KEYS[node.id]}`,
              );
              const isCurrent = node.state === "current";
              return (
                <span
                  key={node.id}
                  className={
                    isCurrent
                      ? "messages-history-loading-phase is-current"
                      : "messages-history-loading-phase"
                  }
                >
                  {isCurrent && percent != null ? `${label} · ${percent}%` : label}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
