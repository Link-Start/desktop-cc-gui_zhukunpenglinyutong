import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import Search from "lucide-react/dist/esm/icons/search";
import UserRound from "lucide-react/dist/esm/icons/user-round";
import X from "lucide-react/dist/esm/icons/x";
import type {
  GitHistoryCommitFilterValues,
  GitHistoryDatePreset,
} from "../utils/gitHistoryCommitFilters";
import {
  GitHistoryInlinePicker,
  type GitHistoryInlinePickerOption,
} from "./GitHistoryPanelPickers";

const FILTER_DEBOUNCE_MS = 300;

export type GitHistoryCommitFiltersProps = {
  headerTitle: ReactNode;
  draftScopeKey: string;
  values: GitHistoryCommitFilterValues;
  selectedBranch: string;
  currentBranch: string | null;
  branchOptions: GitHistoryInlinePickerOption[];
  authorSuggestions: string[];
  disabled?: boolean;
  onFiltersChange: (values: GitHistoryCommitFilterValues) => void;
  onBranchChange: (branch: string) => void;
  onClear: () => void;
};

type TextFilterFieldProps = {
  icon: ReactNode;
  name: string;
  label: string;
  clearLabel: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  autoComplete: string;
  spellCheck: boolean;
  list?: string;
  onChange: (value: string) => void;
};

function TextFilterField({
  icon,
  name,
  label,
  clearLabel,
  value,
  placeholder,
  disabled,
  autoComplete,
  spellCheck,
  list,
  onChange,
}: TextFilterFieldProps) {
  const inputId = useId();
  return (
    <div className={`git-history-filter-field${value.trim() ? " is-active" : ""}`}>
      <span className="git-history-filter-field-icon" aria-hidden>
        {icon}
      </span>
      <label className="git-history-filter-field-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        value={value}
        list={list}
        disabled={disabled}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
        aria-label={label}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button
          type="button"
          className="git-history-filter-field-clear"
          aria-label={clearLabel}
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onChange("");
          }}
        >
          <X size={11} />
        </button>
      ) : null}
    </div>
  );
}

export function GitHistoryCommitFilters({
  headerTitle,
  draftScopeKey,
  values,
  selectedBranch,
  currentBranch,
  branchOptions,
  authorSuggestions,
  disabled = false,
  onFiltersChange,
  onBranchChange,
  onClear,
}: GitHistoryCommitFiltersProps) {
  const { t } = useTranslation();
  const authorListId = useId();
  const [queryDraft, setQueryDraft] = useState(values.query);
  const [authorDraft, setAuthorDraft] = useState(values.author);

  useEffect(() => {
    setQueryDraft(values.query);
    setAuthorDraft(values.author);
  }, [draftScopeKey, values.author, values.query]);

  useEffect(() => {
    if (queryDraft === values.query && authorDraft === values.author) {
      return;
    }
    const timer = window.setTimeout(() => {
      onFiltersChange({
        ...values,
        query: queryDraft,
        author: authorDraft,
      });
    }, FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [authorDraft, draftScopeKey, onFiltersChange, queryDraft, values]);

  const dateOptions = useMemo<GitHistoryInlinePickerOption[]>(
    () => [
      { value: "all", label: t("git.historyFilterDateAll") },
      { value: "today", label: t("git.historyFilterDateToday") },
      { value: "7d", label: t("git.historyFilterDateLast7Days") },
      { value: "30d", label: t("git.historyFilterDateLast30Days") },
    ],
    [t],
  );
  const defaultBranch = currentBranch ?? "all";
  const hasActiveFilters = Boolean(
    queryDraft.trim()
      || authorDraft.trim()
      || values.datePreset !== "all"
      || selectedBranch !== defaultBranch,
  );

  return (
    <div className="git-history-commit-filters">
      <div className="git-history-column-header git-history-commit-filter-header">
        <span className="git-history-commit-filter-title">{headerTitle}</span>
        <div className="git-history-filter-row">
          <GitHistoryInlinePicker
            label={t("git.historyFilterBranchLabel")}
            value={selectedBranch}
            options={branchOptions}
            disabled={disabled}
            searchPlaceholder={t("git.historyFilterBranchSearch")}
            emptyText={t("git.historyFilterBranchEmpty")}
            triggerIcon={<GitBranch size={12} />}
            onSelect={(branch) => {
              onFiltersChange({
                ...values,
                query: queryDraft,
                author: authorDraft,
              });
              onBranchChange(branch);
            }}
          />

          <TextFilterField
            icon={<UserRound size={12} />}
            name="git-history-commit-author"
            label={t("git.historyFilterAuthorLabel")}
            clearLabel={t("git.historyFilterClearField", {
              field: t("git.historyFilterAuthorLabel"),
            })}
            value={authorDraft}
            placeholder={t("git.historyFilterAuthorPlaceholder")}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            list={authorListId}
            onChange={setAuthorDraft}
          />
          <datalist id={authorListId}>
            {authorSuggestions.map((author) => (
              <option key={author} value={author} />
            ))}
          </datalist>

          <GitHistoryInlinePicker
            label={t("git.historyFilterDateLabel")}
            value={values.datePreset}
            options={dateOptions}
            disabled={disabled}
            searchPlaceholder={t("git.historyFilterDateSearch")}
            emptyText={t("git.historyFilterDateEmpty")}
            triggerIcon={<CalendarDays size={12} />}
            dropdownAlign="end"
            onSelect={(datePreset) => {
              onFiltersChange({
                ...values,
                query: queryDraft,
                author: authorDraft,
                datePreset: datePreset as GitHistoryDatePreset,
              });
            }}
          />

          <button
            type="button"
            className="git-history-filter-clear-all"
            disabled={disabled || !hasActiveFilters}
            onClick={() => {
              setQueryDraft("");
              setAuthorDraft("");
              onClear();
            }}
          >
            <X size={12} />
            <span>{t("git.historyFilterClear")}</span>
          </button>
        </div>
      </div>

      <TextFilterField
        icon={<Search size={15} />}
        name="git-history-commit-query"
        label={t("git.historyFilterQueryLabel")}
        clearLabel={t("git.historyFilterClearField", {
          field: t("git.historyFilterQueryLabel"),
        })}
        value={queryDraft}
        placeholder={t("git.historyFilterQueryPlaceholder")}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        onChange={setQueryDraft}
      />
    </div>
  );
}
