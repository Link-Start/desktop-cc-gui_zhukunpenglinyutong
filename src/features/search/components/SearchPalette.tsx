import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import projectIconUrl from "../../../../icon.png";
import { isComposingEvent } from "../../../utils/keys";
import { loadSearchPaletteStyles } from "../../../styles/featureStyleLoaders";
import { useFeatureStylesReady } from "../../../styles/useFeatureStylesReady";
import type { SearchContentFilter, SearchResult, SearchScope } from "../types";

const INVISIBLE_QUERY_CHARS_REGEX = /[\u200B-\u200D\uFEFF]/g;
// Debounce before the typed query reaches the app-shell root (see commitQuery below).
const SEARCH_QUERY_DEBOUNCE_MS = 150;

function sanitizeSearchQueryInput(value: string): string {
  return value.replace(INVISIBLE_QUERY_CHARS_REGEX, "");
}

type SearchPaletteProps = {
  isOpen: boolean;
  scope: SearchScope;
  contentFilters: SearchContentFilter[];
  workspaceName?: string | null;
  query: string;
  results: SearchResult[];
  selectedIndex: number;
  onQueryChange: (value: string) => void;
  onMoveSelection: (direction: "up" | "down") => void;
  onSelect: (result: SearchResult) => void;
  onScopeChange: (scope: SearchScope) => void;
  onContentFilterToggle: (filter: SearchContentFilter) => void;
  onClose: () => void;
};

export function SearchPalette({
  isOpen,
  scope,
  contentFilters,
  workspaceName,
  query,
  results,
  selectedIndex,
  onQueryChange,
  onMoveSelection,
  onSelect,
  onScopeChange,
  onContentFilterToggle,
  onClose,
}: SearchPaletteProps) {
  const stylesReady = useFeatureStylesReady(loadSearchPaletteStyles, isOpen);
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isComposingRef = useRef(false);
  const lastCompositionEndAtRef = useRef(0);

  // The query is debounced before it reaches the app-shell root: typing updates only this
  // local input (a leaf re-render), while the committed query — which drives the root-level
  // results compute and a whole-app re-render — is pushed at most once per debounce window.
  // Without this, every keystroke re-rendered the entire app-shell (single-digit FPS).
  const [inputValue, setInputValue] = useState(query);
  const lastPushedQueryRef = useRef(query);
  const queryCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // External query changes (open/close reset, programmatic clear) override local input.
  useEffect(() => {
    if (query !== lastPushedQueryRef.current) {
      lastPushedQueryRef.current = query;
      setInputValue(query);
    }
  }, [query]);

  const commitQuery = useCallback(
    (value: string) => {
      setInputValue(value);
      if (queryCommitTimerRef.current) {
        clearTimeout(queryCommitTimerRef.current);
      }
      queryCommitTimerRef.current = setTimeout(() => {
        queryCommitTimerRef.current = null;
        lastPushedQueryRef.current = value;
        onQueryChange(value);
      }, SEARCH_QUERY_DEBOUNCE_MS);
    },
    [onQueryChange],
  );

  // IME composition end yields final text — commit it immediately (no debounce), both for
  // correct CJK input and because the committed word is the meaningful search trigger.
  const flushQuery = useCallback(
    (value: string) => {
      if (queryCommitTimerRef.current) {
        clearTimeout(queryCommitTimerRef.current);
        queryCommitTimerRef.current = null;
      }
      setInputValue(value);
      lastPushedQueryRef.current = value;
      onQueryChange(value);
    },
    [onQueryChange],
  );

  // Cancel a pending commit once the palette closes so it can't fire after the reset.
  useEffect(() => {
    if (isOpen) {
      return;
    }
    if (queryCommitTimerRef.current) {
      clearTimeout(queryCommitTimerRef.current);
      queryCommitTimerRef.current = null;
    }
  }, [isOpen]);
  const badgeLabelByKind: Record<SearchResult["kind"], string> = {
    file: t("searchPalette.typeFile"),
    kanban: t("searchPalette.typeKanban"),
    thread: t("searchPalette.typeThread"),
    message: t("searchPalette.typeMessage"),
    history: t("searchPalette.typeHistory"),
    skill: t("searchPalette.typeSkill"),
    command: t("searchPalette.typeCommand"),
  };

  const sourceLabelByKind: Record<NonNullable<SearchResult["sourceKind"]>, string> = {
    files: t("searchPalette.sourceFiles"),
    kanban: t("searchPalette.sourceKanban"),
    threads: t("searchPalette.sourceThreads"),
    messages: t("searchPalette.sourceMessages"),
    history: t("searchPalette.sourceHistory"),
    skills: t("searchPalette.sourceSkills"),
    commands: t("searchPalette.sourceCommands"),
  };
  const contentFilterOptions: Array<{
    value: SearchContentFilter;
    label: string;
  }> = [
    { value: "all", label: t("searchPalette.contentAll") },
    { value: "files", label: t("searchPalette.contentFiles") },
    { value: "kanban", label: t("searchPalette.contentKanban") },
    { value: "threads", label: t("searchPalette.contentThreads") },
    { value: "messages", label: t("searchPalette.contentMessages") },
    { value: "history", label: t("searchPalette.contentHistory") },
    { value: "skills", label: t("searchPalette.contentSkills") },
    { value: "commands", label: t("searchPalette.contentCommands") },
  ];
  const selectedContentLabels = contentFilterOptions
    .filter((option) => option.value !== "all" && contentFilters.includes(option.value))
    .map((option) => option.label);
  const placeholderText = selectedContentLabels.length
    ? t("searchPalette.placeholderFiltered", { content: selectedContentLabels.join(" / ") })
    : t("searchPalette.placeholder");
  const normalizedVisibleQuery = sanitizeSearchQueryInput(query);
  const shouldShowResults = normalizedVisibleQuery.trim().length > 0;
  const visibleResults = useMemo(
    () => (shouldShowResults ? results : []),
    [results, shouldShowResults],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    inputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      const isRecentlyComposing = Date.now() - lastCompositionEndAtRef.current < 120;
      if (isComposingRef.current || isRecentlyComposing || isComposingEvent(event)) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        onMoveSelection("down");
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        onMoveSelection("up");
        return;
      }
      if (event.key === "Enter") {
        if (!visibleResults.length || selectedIndex < 0 || selectedIndex >= visibleResults.length) {
          return;
        }
        event.preventDefault();
        const selectedResult = visibleResults[selectedIndex];
        if (selectedResult) {
          onSelect(selectedResult);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onMoveSelection, onSelect, selectedIndex, visibleResults]);

  if (!isOpen) {
    return null;
  }
  if (!stylesReady) {
    return null;
  }

  return (
    <div className="search-palette-overlay" onClick={onClose} role="presentation">
      <div
        className="search-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="search-palette-input-row">
          <SearchIcon className="search-palette-search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            className="search-palette-input"
            placeholder={placeholderText}
            aria-label={t("searchPalette.inputAria")}
            value={inputValue}
            onChange={(event) => commitQuery(sanitizeSearchQueryInput(event.target.value))}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={(event) => {
              isComposingRef.current = false;
              lastCompositionEndAtRef.current = Date.now();
              flushQuery(sanitizeSearchQueryInput(event.currentTarget.value));
            }}
          />
          <span className="search-palette-project-icon-box" aria-hidden="true">
            <img
              className="search-palette-project-icon"
              src={projectIconUrl}
              alt=""
            />
          </span>
        </div>
        <div className="search-palette-scope">
          <span className="search-palette-scope-label">{t("searchPalette.scope")}</span>
          <div className="search-palette-scope-toggle" role="group" aria-label={t("searchPalette.scope")}>
            <button
              type="button"
              className={`search-palette-scope-btn${scope === "active-workspace" ? " is-active" : ""}`}
              onClick={() => onScopeChange("active-workspace")}
            >
              {t("searchPalette.current")}
            </button>
            <button
              type="button"
              className={`search-palette-scope-btn${scope === "global" ? " is-active" : ""}`}
              onClick={() => onScopeChange("global")}
            >
              {t("searchPalette.global")}
            </button>
          </div>
          <span className="search-palette-scope-value">
            {scope === "active-workspace"
              ? `${t("searchPalette.currentWorkspace")}${workspaceName ? ` (${workspaceName})` : ""}`
              : t("searchPalette.allWorkspaces")}
          </span>
        </div>
        <div className="search-palette-content">
          <span className="search-palette-scope-label">{t("searchPalette.content")}</span>
          <div
            className="search-palette-content-toggle"
            role="group"
            aria-label={t("searchPalette.content")}
          >
            {contentFilterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`search-palette-content-btn${contentFilters.includes(option.value) ? " is-active" : ""}`}
                onClick={() => onContentFilterToggle(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="search-palette-results">
          {visibleResults.length === 0 ? (
            <div className="search-palette-empty">
              <div className="search-palette-empty-title">{t("searchPalette.noResults")}</div>
              <div className="search-palette-empty-hint">
                {t("searchPalette.noResultsHint")}
              </div>
            </div>
          ) : (
            visibleResults.map((result, index) => (
              <button
                key={result.id}
                type="button"
                className={`search-palette-result${index === selectedIndex ? " is-active" : ""}`}
                onClick={() => onSelect(result)}
              >
                <span className="search-palette-result-main">
                  <span className="search-palette-result-title">{result.title}</span>
                  {result.subtitle ? (
                    <span className="search-palette-result-subtitle">{result.subtitle}</span>
                  ) : null}
                  <span className="search-palette-result-tags">
                    {result.workspaceName ? (
                      <span className="search-palette-result-tag">
                        {t("searchPalette.projectTag")}: {result.workspaceName}
                      </span>
                    ) : null}
                    <span className="search-palette-result-tag">
                      {t("searchPalette.typeTag")}: {badgeLabelByKind[result.kind]}
                    </span>
                    {result.sourceKind ? (
                      <span className="search-palette-result-tag">
                        {t("searchPalette.sourceTag")}: {sourceLabelByKind[result.sourceKind]}
                      </span>
                    ) : null}
                    {result.locationLabel ? (
                      <span className="search-palette-result-tag">
                        {t("searchPalette.locationTag")}: {result.locationLabel}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className={`search-palette-kind-badge search-kind-${result.kind}`}>
                  {badgeLabelByKind[result.kind]}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="search-palette-footer">
          <span className="search-palette-key-hint">
            <kbd>↑↓</kbd> {t("searchPalette.navigate")}
          </span>
          <span className="search-palette-key-hint">
            <kbd>Enter</kbd> {t("searchPalette.open")}
          </span>
          <span className="search-palette-key-hint">
            <kbd>Esc</kbd> {t("searchPalette.close")}
          </span>
        </div>
      </div>
    </div>
  );
}
