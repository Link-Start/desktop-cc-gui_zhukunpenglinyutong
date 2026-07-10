import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type UIEvent,
} from "react";
import { useTranslation } from "react-i18next";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import type { GitLineMarkers } from "../../files/utils/gitLineMarkers";
import { useFileDocumentState } from "../../files/hooks/useFileDocumentState";
import { computeFileCompareDiff } from "../../files/utils/fileCompareDiff";
import { resolveFileRenderProfile } from "../../files/utils/fileRenderProfile";
import {
  CompareEditorColumn,
  type CompareColumnDraft,
  useFileCompareEditorTheme,
} from "../../files/components/WorkspaceFileComparePanel";
import { resolveFileReadTarget } from "../../../utils/workspacePaths";
import { loadFileViewStyles } from "../../../styles/featureStyleLoaders";
import { reconstructPreviousVersion } from "../utils/reconstructPreviousVersion";

type WorkspaceEditableDiffCompareProps = {
  workspaceId: string;
  workspacePath: string;
  filePath: string;
  diff: string;
  fallback: ReactNode;
  onSaveSuccess: () => void;
  onDirtyChange: (isDirty: boolean) => void;
  onDraftActionsChange?: (actions: EditableDiffDraftActions | null) => void;
};

export type EditableDiffDraftActions = {
  save: () => Promise<boolean>;
  discard: () => void;
  isSaving: boolean;
};

const EMPTY_MARKERS: GitLineMarkers = { added: [], modified: [] };

export function WorkspaceEditableDiffCompare({
  workspaceId,
  workspacePath,
  filePath,
  diff,
  fallback,
  onSaveSuccess,
  onDirtyChange,
  onDraftActionsChange,
}: WorkspaceEditableDiffCompareProps) {
  const { t } = useTranslation();
  const editorTheme = useFileCompareEditorTheme();
  const scrollSyncingRef = useRef(false);
  const reconstructedBaselineRef = useRef<{ diff: string; source: string } | null>(null);
  const renderProfile = useMemo(() => resolveFileRenderProfile(filePath), [filePath]);
  const fileReadTarget = useMemo(
    () => resolveFileReadTarget(workspacePath, filePath, null),
    [filePath, workspacePath],
  );
  const documentState = useFileDocumentState({
    workspaceId,
    customSpecRoot: null,
    workspaceRelativeFilePath: fileReadTarget.workspaceRelativePath,
    fileReadTarget,
    skipTextRead: renderProfile.previewSourceKind !== "inline-bytes",
    externalAbsoluteReadOnlyMessage: t("files.externalAbsoluteReadOnly"),
  });
  const [previousSource, setPreviousSource] = useState<string | null>(null);
  const [hasResolvedBaseline, setHasResolvedBaseline] = useState(false);
  const [activeDifferenceIndex, setActiveDifferenceIndex] = useState(0);

  useEffect(() => {
    void loadFileViewStyles();
  }, []);

  useEffect(() => {
    reconstructedBaselineRef.current = null;
    setPreviousSource(null);
    setHasResolvedBaseline(false);
    setActiveDifferenceIndex(0);
  }, [filePath]);

  useEffect(() => {
    const savedSource = documentState.savedContentRef.current;
    const reconstructedBaseline = reconstructedBaselineRef.current;
    if (
      documentState.isLoading
      || (reconstructedBaseline?.diff === diff && reconstructedBaseline.source === savedSource)
    ) {
      return;
    }
    reconstructedBaselineRef.current = { diff, source: savedSource };
    setPreviousSource(reconstructPreviousVersion(savedSource, diff));
    setHasResolvedBaseline(true);
  }, [diff, documentState.content, documentState.isLoading, documentState.isSaving, documentState.savedContentRef]);

  useEffect(() => {
    onDirtyChange(documentState.isDirty);
    return () => onDirtyChange(false);
  }, [documentState.isDirty, onDirtyChange]);

  const deferredContentForDiff = useDeferredValue(documentState.content);
  const diffResult = useMemo(
    () => computeFileCompareDiff([previousSource ?? "", deferredContentForDiff]),
    [deferredContentForDiff, previousSource],
  );
  const activeDifference = diffResult.changedRows[activeDifferenceIndex] ?? null;
  const canNavigateDifferences = diffResult.changedRows.length > 0;
  const saveDocument = documentState.handleSave;
  const discardDocument = documentState.handleDiscard;

  useEffect(() => {
    if (activeDifferenceIndex < diffResult.changedRows.length) {
      return;
    }
    setActiveDifferenceIndex(Math.max(0, diffResult.changedRows.length - 1));
  }, [activeDifferenceIndex, diffResult.changedRows.length]);

  const handleSave = useCallback(async () => {
    const shouldRefresh = documentState.isDirty;
    const saved = await saveDocument();
    if (saved && shouldRefresh) {
      onSaveSuccess();
    }
    return saved;
  }, [documentState.isDirty, onSaveSuccess, saveDocument]);

  const handleDiscard = useCallback(() => {
    discardDocument();
    onDirtyChange(false);
  }, [discardDocument, onDirtyChange]);

  useEffect(() => {
    onDraftActionsChange?.({
      save: handleSave,
      discard: handleDiscard,
      isSaving: documentState.isSaving,
    });
    return () => onDraftActionsChange?.(null);
  }, [documentState.isSaving, handleDiscard, handleSave, onDraftActionsChange]);

  const drafts = useMemo<CompareColumnDraft[]>(
    () => [
      {
        id: `previous:${filePath}`,
        label: filePath,
        title: t("files.editableDiff.previousVersion"),
        content: previousSource ?? "",
        isDirty: false,
        isSaving: false,
        isLoading: documentState.isLoading,
        error: null,
        saveError: null,
        truncated: false,
        readOnlyReason: null,
        editable: false,
        onChange: () => {},
        onSave: () => false,
      },
      {
        id: filePath,
        label: filePath,
        title: t("files.editableDiff.sourceCode"),
        content: documentState.content,
        isDirty: documentState.isDirty,
        isSaving: documentState.isSaving,
        isLoading: documentState.isLoading,
        error: documentState.error,
        saveError: null,
        truncated: documentState.truncated,
        readOnlyReason: documentState.truncated
          ? t("files.fileCompare.truncatedReadOnly")
          : null,
        editable: !documentState.truncated && !documentState.error,
        onChange: documentState.setContent,
        onSave: handleSave,
      },
    ],
    [
      documentState.content,
      documentState.error,
      documentState.isDirty,
      documentState.isLoading,
      documentState.isSaving,
      documentState.setContent,
      documentState.truncated,
      filePath,
      handleSave,
      previousSource,
      t,
    ],
  );
  const markersByColumn = useMemo<GitLineMarkers[]>(
    () =>
      diffResult.changedLineNumbersByColumn.map((modified) => ({
        added: [],
        modified,
      })),
    [diffResult.changedLineNumbersByColumn],
  );

  const handlePanelScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const sourceScroller = event.target;
    if (
      scrollSyncingRef.current ||
      !(sourceScroller instanceof HTMLElement) ||
      !sourceScroller.classList.contains("cm-scroller")
    ) {
      return;
    }
    const scrollers = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        ".file-compare-cm .cm-scroller",
      ),
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

  if (hasResolvedBaseline && previousSource === null) {
    return fallback;
  }

  return (
    <div className="editable-diff-compare" onScrollCapture={handlePanelScroll}>
      <div className="editable-diff-compare-nav" aria-live="polite">
        <span>
          {canNavigateDifferences
            ? t("files.fileCompare.differenceCount", {
                current: activeDifferenceIndex + 1,
                total: diffResult.changedRows.length,
              })
            : t("files.fileCompare.noDifferences")}
        </span>
        <button
          type="button"
          className="ghost"
          onClick={() =>
            setActiveDifferenceIndex((current) =>
              (current - 1 + diffResult.changedRows.length) % diffResult.changedRows.length,
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
            setActiveDifferenceIndex((current) =>
              (current + 1) % diffResult.changedRows.length,
            )
          }
          disabled={!canNavigateDifferences}
          aria-label={t("files.fileCompare.nextDifference")}
          title={t("files.fileCompare.nextDifference")}
        >
          <ChevronDown size={14} aria-hidden />
        </button>
      </div>
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
            activeLineNumber={
              activeDifference?.lineNumbersByColumn[columnIndex] ?? null
            }
          />
        ))}
      </div>
    </div>
  );
}
