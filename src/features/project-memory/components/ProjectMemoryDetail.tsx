import Copy from "lucide-react/dist/esm/icons/copy";
import { useTranslation } from "react-i18next";
import { Markdown } from "../../../markdown/components/Markdown";
import type { ProjectMemoryItem } from "../../../services/tauri";
import type {
  ProjectMemoryDisplayRecordKind,
  ProjectMemorySourceLocator,
} from "../utils/projectMemoryDisplay";
import type { MemoryDetailSection } from "./projectMemoryPanelHelpers";
import type { ProjectMemoryPanelLabels } from "./projectMemoryPanelLabels";

type ProjectMemoryDetailProps = {
  selectedItem: ProjectMemoryItem | null;
  selectedRecordKind: ProjectMemoryDisplayRecordKind | null;
  selectedIsConversationTurn: boolean;
  selectedSourceLocator: ProjectMemorySourceLocator | null;
  detailLoading: boolean;
  detailError: string | null;
  detailTextDraft: string;
  detailSections: MemoryDetailSection[];
  copyMessage: string | null;
  detailSaving: boolean;
  labels: ProjectMemoryPanelLabels;
  formatMemoryDateTime: (value?: number) => string;
  onCopySourceLocator: () => void;
  onDetailTextChange: (value: string) => void;
  onSetReviewState: (state: "kept" | "obsolete" | "dismissed") => void;
  onConvertToManualNote: () => void;
};

export function ProjectMemoryDetail({
  selectedItem,
  selectedRecordKind,
  selectedIsConversationTurn,
  selectedSourceLocator,
  detailLoading,
  detailError,
  detailTextDraft,
  detailSections,
  copyMessage,
  detailSaving,
  labels,
  formatMemoryDateTime,
  onCopySourceLocator,
  onDetailTextChange,
  onSetReviewState,
  onConvertToManualNote,
}: ProjectMemoryDetailProps) {
  const { t } = useTranslation();
  const { kindLabel, importanceLabel, recordKindLabel } = labels;
  return (
    <div className="project-memory-detail" aria-label={t("memory.memoryDetail")}>
      {selectedItem ? (
        <>
          <div className="project-memory-detail-readonly-head">
            <div className="project-memory-detail-readonly-title">
              {selectedItem.title || selectedItem.summary || selectedItem.kind}
            </div>
            <div className="project-memory-detail-readonly-meta">
              {selectedRecordKind ? <span>{recordKindLabel(selectedRecordKind)}</span> : null}
              <span>{kindLabel(selectedItem.kind)}</span>
              <span>{importanceLabel(selectedItem.importance)}</span>
              <span>{formatMemoryDateTime(selectedItem.updatedAt)}</span>
              {selectedItem.threadId ? <span>{selectedItem.threadId}</span> : null}
              {selectedItem.turnId ? <span>{selectedItem.turnId}</span> : null}
              {selectedItem.engine ? <span>{selectedItem.engine}</span> : null}
            </div>
            {selectedItem.tags.length > 0 ? (
              <div className="project-memory-detail-readonly-tags">
                {selectedItem.tags.slice(0, 8).map((entry) => (
                  <span key={entry} className="project-memory-detail-readonly-tag">
                    #{entry}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="project-memory-source-locator">
              <div>
                <span className="project-memory-source-locator-label">{t("memory.sourceLocator")}</span>
                <span className="project-memory-source-locator-status">
                  {selectedSourceLocator?.available
                    ? t("memory.sourceLocatorAvailable")
                    : t("memory.sourceLocatorUnavailable")}
                </span>
              </div>
              <button
                type="button"
                className="project-memory-action-btn compact"
                onClick={onCopySourceLocator}
                disabled={!selectedSourceLocator?.available}
                aria-label={t("memory.copySourceLocator")}
              >
                <Copy size={13} aria-hidden />
                <span>{t("memory.copySourceLocator")}</span>
              </button>
            </div>
          </div>
          {detailLoading ? (
            <div className="project-memory-detail-status">{t("memory.detailLoading")}</div>
          ) : null}
          {detailError ? <div className="project-memory-error">{detailError}</div> : null}
          {selectedIsConversationTurn ? (
            <div className="project-memory-turn-grid">
              <section className="project-memory-turn-section">
                <h3>{t("memory.turnUserInput")}</h3>
                <Markdown
                  className="markdown project-memory-detail-preview-markdown"
                  value={selectedItem.userInput?.trim() || t("memory.detailPreviewEmpty")}
                />
              </section>
              {selectedItem.assistantThinkingSummary?.trim() ? (
                <section className="project-memory-turn-section">
                  <h3>{t("memory.turnAssistantThinkingSummary")}</h3>
                  <Markdown
                    className="markdown project-memory-detail-preview-markdown"
                    value={selectedItem.assistantThinkingSummary.trim()}
                  />
                </section>
              ) : null}
              <section className="project-memory-turn-section">
                <h3>{t("memory.turnAssistantResponse")}</h3>
                <Markdown
                  className="markdown project-memory-detail-preview-markdown"
                  value={selectedItem.assistantResponse?.trim() || t("memory.detailPreviewEmpty")}
                />
              </section>
            </div>
          ) : (
            <div className="project-memory-detail-editor">
              <label className="project-memory-detail-editor-label" htmlFor="project-memory-detail-editor">
                {t("memory.editManualDetail")}
              </label>
              <textarea
                id="project-memory-detail-editor"
                className="project-memory-detail-text"
                value={detailTextDraft}
                onChange={(event) => onDetailTextChange(event.target.value)}
              />
            </div>
          )}
          {!selectedIsConversationTurn ? (
            <div className="project-memory-detail-preview">
              <div className="project-memory-detail-preview-title">{t("memory.detailPreviewTitle")}</div>
              {detailSections.length > 0 ? (
                <div className="project-memory-detail-preview-sections">
                  {detailSections.map((section, index) => (
                    <div key={`${section.label}-${index}`} className="project-memory-detail-preview-section">
                      <div className="project-memory-detail-preview-section-label">{section.label}</div>
                      <div className="project-memory-detail-preview-section-content">
                        <Markdown
                          className="markdown project-memory-detail-preview-markdown"
                          value={section.content}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="project-memory-detail-preview-plain">
                  <Markdown
                    className="markdown project-memory-detail-preview-markdown"
                    value={detailTextDraft.trim() || t("memory.detailPreviewEmpty")}
                  />
                </div>
              )}
            </div>
          ) : null}
          {copyMessage ? <div className="project-memory-detail-status">{copyMessage}</div> : null}
          <div className="project-memory-review-actions" aria-label={t("memory.reviewActions")}>
            <button
              type="button"
              className="project-memory-action-btn compact"
              onClick={() => onSetReviewState("kept")}
              disabled={detailSaving}
            >
              {t("memory.reviewKeep")}
            </button>
            <button
              type="button"
              className="project-memory-action-btn compact"
              onClick={onConvertToManualNote}
              disabled={detailSaving || !selectedIsConversationTurn}
            >
              {t("memory.reviewConvert")}
            </button>
            <button
              type="button"
              className="project-memory-action-btn compact"
              onClick={() => onSetReviewState("obsolete")}
              disabled={detailSaving}
            >
              {t("memory.reviewObsolete")}
            </button>
            <button
              type="button"
              className="project-memory-action-btn compact"
              onClick={() => onSetReviewState("dismissed")}
              disabled={detailSaving}
            >
              {t("memory.reviewDismiss")}
            </button>
          </div>
        </>
      ) : (
        <div className="project-memory-empty">{t("memory.selectRecord")}</div>
      )}
    </div>
  );
}
