import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type UIEvent,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import type { GitLineMarkers } from "../../files/utils/gitLineMarkers";
import { computeFileCompareDiff } from "../../files/utils/fileCompareDiff";
import {
  CompareEditorColumn,
  type CompareColumnDraft,
  useFileCompareEditorTheme,
} from "../../files/components/WorkspaceFileComparePanel";
import { parseDiff } from "../../../utils/diff";

type WorkspaceReadOnlyDiffCompareProps = {
  filePath: string;
  diff: string;
  loadFullDiff?: ((path: string) => Promise<string>) | null;
  useFullDiff?: boolean;
  headerControlsTarget?: HTMLElement | null;
};

const EMPTY_MARKERS: GitLineMarkers = { added: [], modified: [] };

export function buildReadOnlyCompareSources(diff: string): [string, string] {
  const previousLines: string[] = [];
  const sourceLines: string[] = [];
  let hasPreviousHunk = false;

  for (const line of parseDiff(diff)) {
    if (line.type === "hunk") {
      if (hasPreviousHunk) {
        previousLines.push("");
        sourceLines.push("");
      }
      hasPreviousHunk = true;
      continue;
    }
    if (line.type === "context") {
      previousLines.push(line.text);
      sourceLines.push(line.text);
    } else if (line.type === "del") {
      previousLines.push(line.text);
    } else if (line.type === "add") {
      sourceLines.push(line.text);
    }
  }

  return [previousLines.join("\n"), sourceLines.join("\n")];
}

export function WorkspaceReadOnlyDiffCompare({
  filePath,
  diff,
  loadFullDiff = null,
  useFullDiff = false,
  headerControlsTarget = null,
}: WorkspaceReadOnlyDiffCompareProps) {
  const { t } = useTranslation();
  const editorTheme = useFileCompareEditorTheme();
  const scrollSyncingRef = useRef(false);
  const [activeDifferenceIndex, setActiveDifferenceIndex] = useState(0);
  const [resolvedDiff, setResolvedDiff] = useState(diff);

  useEffect(() => {
    let cancelled = false;
    setResolvedDiff(diff);
    setActiveDifferenceIndex(0);
    if (!useFullDiff || !loadFullDiff) {
      return () => {
        cancelled = true;
      };
    }

    void loadFullDiff(filePath)
      .then((fullDiff) => {
        if (!cancelled && fullDiff.trim()) {
          setResolvedDiff(fullDiff);
        }
      })
      .catch(() => {
        // Keep the initial patch visible when full-context loading is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [diff, filePath, loadFullDiff, useFullDiff]);

  const sources = useMemo(() => buildReadOnlyCompareSources(resolvedDiff), [resolvedDiff]);
  const diffResult = useMemo(() => computeFileCompareDiff(sources), [sources]);
  const activeDifference = diffResult.changedBlocks[activeDifferenceIndex] ?? null;
  const canNavigateDifferences = diffResult.changedBlocks.length > 0;
  const markersByColumn = useMemo<GitLineMarkers[]>(
    () =>
      diffResult.changedLineNumbersByColumn.map((modified) => ({
        added: [],
        modified,
      })),
    [diffResult.changedLineNumbersByColumn],
  );
  const drafts = useMemo<CompareColumnDraft[]>(
    () => [
      {
        id: `previous:${filePath}`,
        label: filePath,
        title: t("files.editableDiff.previousVersion"),
        content: sources[0],
        isDirty: false,
        isSaving: false,
        isLoading: false,
        error: null,
        saveError: null,
        truncated: false,
        readOnlyReason: t("files.readOnly"),
        editable: false,
        onChange: () => {},
        onSave: () => false,
      },
      {
        id: `source:${filePath}`,
        label: filePath,
        title: t("files.editableDiff.sourceCode"),
        content: sources[1],
        isDirty: false,
        isSaving: false,
        isLoading: false,
        error: null,
        saveError: null,
        truncated: false,
        readOnlyReason: t("files.readOnly"),
        editable: false,
        onChange: () => {},
        onSave: () => false,
      },
    ],
    [filePath, sources, t],
  );

  const handlePanelScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const sourceScroller = event.target;
    if (
      scrollSyncingRef.current
      || !(sourceScroller instanceof HTMLElement)
      || !sourceScroller.classList.contains("cm-scroller")
    ) {
      return;
    }
    const scrollers = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(".file-compare-cm .cm-scroller"),
    );
    scrollSyncingRef.current = true;
    for (const scroller of scrollers) {
      if (scroller !== sourceScroller) {
        scroller.scrollTop = sourceScroller.scrollTop;
      }
    }
    window.requestAnimationFrame(() => {
      scrollSyncingRef.current = false;
    });
  }, []);

  const differenceNavigator = (
    <div
      className={`editable-diff-compare-nav${headerControlsTarget ? " is-external" : ""}`}
      aria-live="polite"
    >
      <span>
        {canNavigateDifferences
          ? t("files.fileCompare.differenceCount", {
              current: activeDifferenceIndex + 1,
              total: diffResult.changedBlocks.length,
            })
          : t("files.fileCompare.noDifferences")}
      </span>
      <button
        type="button"
        className="ghost"
        onClick={() =>
          setActiveDifferenceIndex(
            (current) =>
              (current - 1 + diffResult.changedBlocks.length) % diffResult.changedBlocks.length,
          )
        }
        disabled={!canNavigateDifferences}
        aria-label={t("files.fileCompare.previousDifference")}
        title={t("files.fileCompare.previousDifference")}
      >
        <ChevronUp size={14} aria-hidden />
      </button>
      <button
        type="button"
        className="ghost"
        onClick={() =>
          setActiveDifferenceIndex(
            (current) => (current + 1) % diffResult.changedBlocks.length,
          )
        }
        disabled={!canNavigateDifferences}
        aria-label={t("files.fileCompare.nextDifference")}
        title={t("files.fileCompare.nextDifference")}
      >
        <ChevronDown size={14} aria-hidden />
      </button>
    </div>
  );

  return (
    <div
      className={`editable-diff-compare${headerControlsTarget ? " has-external-nav" : ""}`}
      onScrollCapture={handlePanelScroll}
    >
      {headerControlsTarget
        ? createPortal(differenceNavigator, headerControlsTarget)
        : differenceNavigator}
      <div
        className="file-compare-columns editable-diff-compare-columns"
        style={{ "--file-compare-column-count": "2" } as CSSProperties}
      >
        {drafts.map((draft, columnIndex) => (
          <CompareEditorColumn
            key={draft.id}
            draft={draft}
            editorTheme={editorTheme}
            markers={markersByColumn[columnIndex] ?? EMPTY_MARKERS}
            lineGaps={diffResult.gapLineCountsByColumn[columnIndex] ?? []}
            saveFileShortcut="cmd+s"
            activeLineNumber={activeDifference?.lineNumbersByColumn[columnIndex] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
