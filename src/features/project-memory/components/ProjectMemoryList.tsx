import { useTranslation } from "react-i18next";
import type { ProjectMemoryItem } from "../../../services/tauri";
import {
  deriveProjectMemoryHealthState,
  deriveProjectMemoryReviewState,
  getProjectMemoryDisplayRecordKind,
  isConversationTurnMemory,
  resolveProjectMemoryCompactSummary,
  resolveProjectMemoryCompactTitle,
} from "../utils/projectMemoryDisplay";
import type { ProjectMemoryPanelLabels } from "./projectMemoryPanelLabels";

type ProjectMemoryListProps = {
  emptyMessage: string | null;
  filteredItems: ProjectMemoryItem[];
  selectedId: string | null;
  selectedIds: Set<string>;
  page: number;
  pageSize: number;
  total: number;
  labels: ProjectMemoryPanelLabels;
  formatMemoryDateTime: (value?: number) => string;
  onToggleSelectItem: (id: string) => void;
  onSelectItem: (id: string) => void;
};

export function ProjectMemoryList({
  emptyMessage,
  filteredItems,
  selectedId,
  selectedIds,
  page,
  pageSize,
  total,
  labels,
  formatMemoryDateTime,
  onToggleSelectItem,
  onSelectItem,
}: ProjectMemoryListProps) {
  const { t } = useTranslation();
  const { kindLabel, recordKindLabel, importanceLabel, healthStateLabel, reviewStateLabel } = labels;
  return (
    <aside className="project-memory-list" aria-label={t("memory.memoryList")}>
      <div className="project-memory-list-toolbar">
        <span>{t("memory.memoryList")}</span>
        <span>
          {t("memory.pageMeta", {
            from: total === 0 ? 0 : page * pageSize + 1,
            to: Math.min(total, (page + 1) * pageSize),
            total,
          })}
        </span>
      </div>
      {emptyMessage ? (
        <div className="project-memory-empty">{emptyMessage}</div>
      ) : filteredItems.length === 0 ? (
        <div className="project-memory-empty">{t("memory.filteredEmpty")}</div>
      ) : (
        filteredItems.map((item) => {
          const recordKind = getProjectMemoryDisplayRecordKind(item);
          const healthState = deriveProjectMemoryHealthState(item);
          const reviewState = deriveProjectMemoryReviewState(item);
          const compactTitle = resolveProjectMemoryCompactTitle(item);
          const compactSummary = resolveProjectMemoryCompactSummary(item);
          return (
            <div
              key={item.id}
              className={`project-memory-list-item${
                selectedId === item.id ? " is-active" : ""
              }${selectedIds.has(item.id) ? " is-selected" : ""}${
                item.importance ? ` importance-${item.importance}` : ""
              }${reviewState === "obsolete" ? " is-obsolete" : ""}${
                reviewState === "dismissed" ? " is-dismissed" : ""
              }`}
              onClick={() => onToggleSelectItem(item.id)}
            >
              <label className="project-memory-list-checkbox" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => onToggleSelectItem(item.id)}
                />
                <span className="checkbox-indicator" />
              </label>
              <div
                className="project-memory-list-item-content"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectItem(item.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectItem(item.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="project-memory-list-item-head">
                  <div className="project-memory-list-head-left">
                    <span className={`project-memory-list-kind kind-${item.kind.replace(/_/g, "-")}`}>
                      {kindLabel(item.kind)}
                    </span>
                    <span className={`project-memory-record-kind record-${recordKind.replace(/_/g, "-")}`}>
                      {recordKindLabel(recordKind)}
                    </span>
                    {isConversationTurnMemory(item) && item.engine ? (
                      <span className="project-memory-list-engine">{item.engine.toUpperCase()}</span>
                    ) : null}
                  </div>
                  <span className="project-memory-list-importance">
                    {importanceLabel(item.importance)}
                  </span>
                </div>
                <div className="project-memory-list-title">{compactTitle}</div>
                <div className="project-memory-list-summary">{compactSummary}</div>
                <div className="project-memory-list-meta-row">
                  <span>{formatMemoryDateTime(item.updatedAt)}</span>
                  <span>{healthStateLabel(healthState)}</span>
                  <span>{reviewStateLabel(reviewState)}</span>
                </div>
                {item.tags && item.tags.length > 0 ? (
                  <div className="project-memory-list-tags">
                    {item.tags.slice(0, 3).map((entry) => (
                      <span key={entry} className="project-memory-list-tag">
                        {entry}
                      </span>
                    ))}
                    {item.tags.length > 3 ? (
                      <span className="project-memory-list-tag project-memory-list-tag-muted">
                        +{item.tags.length - 3}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </aside>
  );
}
