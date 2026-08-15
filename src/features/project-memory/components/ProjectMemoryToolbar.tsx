import Search from "lucide-react/dist/esm/icons/search";
import { useTranslation } from "react-i18next";
import type {
  ProjectMemoryHealthState,
  ProjectMemoryReviewState,
} from "../utils/projectMemoryDisplay";

type ProjectMemoryToolbarProps = {
  query: string;
  kind: string | null;
  importance: string | null;
  reviewFilter: ProjectMemoryReviewState | "all";
  healthFilter: ProjectMemoryHealthState | "all";
  tag: string;
  availableTags: string[];
  visibleQuickTags: string[];
  activeTagTerms: string[];
  showAllQuickTags: boolean;
  hiddenQuickTagCount: number;
  onQueryChange: (value: string) => void;
  onKindChange: (value: string | null) => void;
  onImportanceChange: (value: string | null) => void;
  onReviewFilterChange: (value: ProjectMemoryReviewState | "all") => void;
  onHealthFilterChange: (value: ProjectMemoryHealthState | "all") => void;
  onTagChange: (value: string) => void;
  onToggleQuickTag: (tag: string) => void;
  onToggleShowAllQuickTags: () => void;
};

export function ProjectMemoryToolbar({
  query,
  kind,
  importance,
  reviewFilter,
  healthFilter,
  tag,
  availableTags,
  visibleQuickTags,
  activeTagTerms,
  showAllQuickTags,
  hiddenQuickTagCount,
  onQueryChange,
  onKindChange,
  onImportanceChange,
  onReviewFilterChange,
  onHealthFilterChange,
  onTagChange,
  onToggleQuickTag,
  onToggleShowAllQuickTags,
}: ProjectMemoryToolbarProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="project-memory-toolbar">
        <label className="project-memory-search">
          <Search size={14} aria-hidden />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("memory.searchPlaceholder")}
          />
        </label>
        <select
          value={kind ?? ""}
          onChange={(event) => onKindChange(event.target.value || null)}
          className="project-memory-kind-select"
        >
          <option value="">{t("memory.kind.all")}</option>
          <option value="project_context">{t("memory.kind.projectContext")}</option>
          <option value="conversation">{t("memory.kind.conversation")}</option>
          <option value="code_decision">{t("memory.kind.codeDecision")}</option>
          <option value="known_issue">{t("memory.kind.knownIssue")}</option>
          <option value="note">{t("memory.kind.note")}</option>
        </select>
        <select
          value={importance ?? ""}
          onChange={(event) => onImportanceChange(event.target.value || null)}
          className="project-memory-kind-select"
        >
          <option value="">{t("memory.importance.all")}</option>
          <option value="high">{t("memory.importance.high")}</option>
          <option value="medium">{t("memory.importance.medium")}</option>
          <option value="low">{t("memory.importance.low")}</option>
        </select>
        <select
          value={reviewFilter}
          onChange={(event) =>
            onReviewFilterChange(event.target.value as ProjectMemoryReviewState | "all")
          }
          className="project-memory-kind-select"
        >
          <option value="all">{t("memory.review.all")}</option>
          <option value="unreviewed">{t("memory.review.unreviewed")}</option>
          <option value="kept">{t("memory.review.kept")}</option>
          <option value="converted">{t("memory.review.converted")}</option>
          <option value="obsolete">{t("memory.review.obsolete")}</option>
          <option value="dismissed">{t("memory.review.dismissed")}</option>
        </select>
        <select
          value={healthFilter}
          onChange={(event) =>
            onHealthFilterChange(event.target.value as ProjectMemoryHealthState | "all")
          }
          className="project-memory-kind-select"
        >
          <option value="all">{t("memory.health.all")}</option>
          <option value="complete">{t("memory.health.complete")}</option>
          <option value="input_only">{t("memory.health.inputOnly")}</option>
          <option value="assistant_only">{t("memory.health.assistantOnly")}</option>
          <option value="pending_fusion">{t("memory.health.pendingFusion")}</option>
          <option value="capture_failed">{t("memory.health.captureFailed")}</option>
        </select>
        <input
          className="project-memory-tag-input"
          list="project-memory-tag-suggestions"
          value={tag}
          onChange={(event) => onTagChange(event.target.value)}
          placeholder={t("memory.tagPlaceholder")}
        />
        <datalist id="project-memory-tag-suggestions">
          {availableTags.map((entry) => (
            <option key={entry} value={entry} />
          ))}
        </datalist>
      </div>

      {availableTags.length > 0 ? (
        <div className="project-memory-tag-quick-filters">
          <span className="project-memory-tag-quick-label">{t("memory.quickTags")}</span>
          {visibleQuickTags.map((entry) => {
            const active = activeTagTerms.includes(entry);
            return (
              <button
                key={entry}
                type="button"
                className={`project-memory-tag-chip${active ? " is-active" : ""}`}
                onClick={() => onToggleQuickTag(entry)}
              >
                {entry}
              </button>
            );
          })}
          {hiddenQuickTagCount > 0 || showAllQuickTags ? (
            <button
              type="button"
              className="project-memory-tag-chip project-memory-tag-chip-more"
              onClick={onToggleShowAllQuickTags}
              aria-expanded={showAllQuickTags}
            >
              {showAllQuickTags
                ? t("memory.quickTagsCollapse")
                : t("memory.quickTagsMore", { count: hiddenQuickTagCount })}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
