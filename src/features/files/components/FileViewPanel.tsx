import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";
import { useTranslation } from "react-i18next";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Columns2 from "lucide-react/dist/esm/icons/columns-2";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Eye from "lucide-react/dist/esm/icons/eye";
import Code from "lucide-react/dist/esm/icons/code";
import FileSearch from "lucide-react/dist/esm/icons/file-search";
import GitCommitHorizontal from "lucide-react/dist/esm/icons/git-commit-horizontal";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import History from "lucide-react/dist/esm/icons/history";
import Copy from "lucide-react/dist/esm/icons/copy";
import CopyX from "lucide-react/dist/esm/icons/copy-x";
import ClipboardPaste from "lucide-react/dist/esm/icons/clipboard-paste";
import Scissors from "lucide-react/dist/esm/icons/scissors";
import PanelTopClose from "lucide-react/dist/esm/icons/panel-top-close";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Maximize2 from "lucide-react/dist/esm/icons/maximize-2";
import Minimize2 from "lucide-react/dist/esm/icons/minimize-2";
import Rows2 from "lucide-react/dist/esm/icons/rows-2";
import Save from "lucide-react/dist/esm/icons/save";
import Search from "lucide-react/dist/esm/icons/search";
import TextSelect from "lucide-react/dist/esm/icons/text-select";
import NotebookPen from "lucide-react/dist/esm/icons/notebook-pen";
import LocateFixed from "lucide-react/dist/esm/icons/locate-fixed";
import X from "lucide-react/dist/esm/icons/x";
import type { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  getGitFileFullDiff,
  readLocalImageDataUrl,
  readWorkspaceFilePreview,
} from "../../../services/tauri";
import { pushErrorToast } from "../../../services/toasts";
import type { IntentCanvasCodeSelectionAnchor } from "../../intent-canvas/types";
import {
  formatShortcutForPlatform,
  isEditableShortcutTarget,
  matchesShortcutForPlatform,
} from "../../../utils/shortcuts";
import { highlightLine } from "../../../utils/syntax";
import { OpenAppMenu } from "../../app/components/OpenAppMenu";
import {
  clampRendererContextMenuPosition,
  estimateRendererContextMenuHeight,
  RendererContextMenu,
  type RendererContextMenuItem,
  type RendererContextMenuLeafItem,
  type RendererContextMenuState,
} from "../../../components/ui/RendererContextMenu";
import type {
  GitFileStatus,
  GitRepositorySummary,
  OpenAppTarget,
} from "../../../types";
import type {
  CodeAnnotationDraftInput,
  CodeAnnotationLineRange,
  CodeAnnotationSelection,
} from "../../code-annotations/types";
import { isSameCodeAnnotationPath } from "../../code-annotations/utils/codeAnnotations";
import { loadCodeMirrorExtensionsForEditorLanguage } from "../utils/codemirrorLanguageExtensions";
import {
  parseLineMarkersFromDiff,
  type GitLineMarkers,
} from "../utils/gitLineMarkers";
import {
  isLikelyWindowsFsPath,
  normalizeComparablePath,
  normalizeFsPath,
  resolveFileReadTarget,
  resolveGitRootWorkspacePrefix,
  resolveGitStatusPathCandidates,
  resolveWorkspacePathCandidates,
} from "../../../utils/workspacePaths";
import { reorderTabPathsAtTarget } from "../utils/fileTabOrder";
import { getFileTreeIconSvg } from "../utils/fileTreeIcons";
import { reduceExternalChangeSyncState } from "../externalChangeStateMachine";
import { resolveFileRenderProfile } from "../utils/fileRenderProfile";
import { getFileDocumentSnapshotMetrics } from "../utils/fileDocumentSnapshot";
import {
  createFileEditorTypingDiagnosticsSession,
  type FileEditorTypingDiagnosticsSession,
} from "../utils/fileEditorTypingDiagnostics";
import { loadFileViewStyles } from "../../../styles/featureStyleLoaders";
import {
  resolveDefaultFileViewMode,
  resolveFileViewSurface,
} from "../utils/fileViewSurface";
import { FileViewBody } from "./FileViewBody";
import type { FileCodeMirrorEditorHandle } from "./FileCodeMirrorEditor";
import type { NoteCaptureDraft } from "../../note-cards/types";
import { buildCodeSelectionNoteDraft } from "../../note-cards/utils/noteCapture";
import type { FileHistoryTarget } from "../../git-history/types";
import { FileViewNavigationPanel } from "./FileViewNavigationPanel";
import { useFileDocumentState } from "../hooks/useFileDocumentState";
import { useFileExternalSync } from "../hooks/useFileExternalSync";
import { useFileGitBlame } from "../hooks/useFileGitBlame";
import { useFileNavigation } from "../hooks/useFileNavigation";
import { useFilePreviewPayload } from "../hooks/useFilePreviewPayload";
import { isThemeMutationAttribute } from "../../theme/utils/themeAppearance";
import {
  DEFAULT_FILE_RENDER_PRESSURE,
  type FileRenderPressure,
} from "../types/fileRenderPressure";
import {
  resolveFastMarkdownProfileInputs,
  resolveFastMarkdownRendererProfile,
  type FastMarkdownRendererProfileId,
} from "../../markdown/fastMarkdownRenderer";
import {
  buildDetachedFileExplorerSession,
  openNewDetachedFileExplorerWindow,
} from "../detachedFileExplorer";
import {
  EDITOR_LINE_RANGE_SYNC_DELAY_MS,
  EXTERNAL_CHANGE_POLL_INTERVAL_MS,
  formatEditorLineRangeKey,
  formatFileSize,
  hasGitLineMarkers,
  isSameEditorLineRange,
  resolveAbsolutePath,
  resolveDeclarationCodeSelectionAnchor,
  resolveEditorTheme,
  type AnnotationWidgetCallbacks,
  type EditorTheme,
} from "./fileViewPanelShared";
import { resolveFileMarkdownFastFeatureFlags } from "../utils/fileMarkdownFeatureFlags";
import {
  FILE_GIT_BLAME_MAX_BYTES,
  FILE_GIT_BLAME_MAX_LINES,
  resolveGitBlameRepositoryPath,
} from "../utils/gitBlame";
import { resolveFileGitScope } from "../utils/fileGitScope";

export { resolveEditorAnnotationWidgetOrder } from "./fileViewPanelShared";

function resetGitLineMarkersIfNeeded(markers: GitLineMarkers): GitLineMarkers {
  if (markers.added.length === 0 && markers.modified.length === 0) {
    return markers;
  }
  return { added: [], modified: [] };
}

type FileViewPanelProps = {
  workspaceId: string;
  workspaceName?: string | null;
  workspacePath: string;
  gitRoot?: string | null;
  gitRepositories?: GitRepositorySummary[];
  customSpecRoot?: string | null;
  filePath: string;
  gitStatusFiles?: GitFileStatus[];
  openTabs?: string[];
  activeTabPath?: string | null;
  onActivateTab?: (path: string) => void;
  onCloseTab?: (path: string) => void;
  onCloseOtherTabs?: (path: string) => void;
  onCloseAllTabs?: () => void;
  onReorderTabs?: (nextOrder: string[]) => void;
  fileReferenceMode?: "path" | "none";
  onFileReferenceModeChange?: (mode: "path" | "none") => void;
  activeFileLineRange?: { startLine: number; endLine: number } | null;
  onActiveFileLineRangeChange?: (
    range: { startLine: number; endLine: number } | null,
  ) => void;
  onActiveCodeAnchorChange?: (
    anchor: IntentCanvasCodeSelectionAnchor | null,
  ) => void;
  onAssociateIntentCanvasCodeAnchor?: (
    anchor: IntentCanvasCodeSelectionAnchor,
  ) => Promise<void> | void;
  initialMode?: "edit" | "preview";
  openTargets: OpenAppTarget[];
  openAppIconById: Record<string, string>;
  selectedOpenAppId: string;
  onSelectOpenAppId: (id: string) => void;
  editorSplitLayout?: "vertical" | "horizontal";
  onToggleEditorSplitLayout?: () => void;
  isEditorFileMaximized?: boolean;
  onToggleEditorFileMaximized?: () => void;
  navigationTarget?: {
    path: string;
    line: number;
    endLine?: number;
    column: number;
    scrollPosition?: "nearest" | "center";
    requestId: number;
  } | null;
  highlightMarkers?: GitLineMarkers | null;
  onNavigateToLocation?: (
    path: string,
    location: { line: number; column: number },
  ) => void;
  onOpenFileHistory?: (target: FileHistoryTarget) => void;
  onRevealInFileTree?: (path: string) => void;
  onClose: () => void;
  onInsertText?: (text: string) => void;
  onCreateCodeAnnotation?: (annotation: CodeAnnotationDraftInput) => void;
  onCaptureNote?: (draft: NoteCaptureDraft) => void;
  onRemoveCodeAnnotation?: (annotationId: string) => void;
  codeAnnotations?: CodeAnnotationSelection[];
  headerLayout?: "stacked" | "single-row";
  onSingleRowLeadingAction?: () => void;
  singleRowLeadingDirection?: "left" | "right";
  singleRowLeadingLabel?: string;
  externalChangeMonitoringEnabled?: boolean;
  externalChangeTransportMode?: "watcher" | "polling";
  externalChangePollIntervalMs?: number;
  externalChangeApplyMode?: "auto" | "manual";
  externalChangeAutoApplyDebounceMs?: number;
  markdownPreviewSnapshotMode?: "stable" | "live";
  fileRenderPressure?: FileRenderPressure;
  saveFileShortcut?: string | null;
  findInFileShortcut?: string | null;
  expandSelectionShortcut?: string | null;
  onSaveSuccess?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
};

export function FileViewPanel({
  workspaceId,
  workspaceName = null,
  workspacePath,
  gitRoot = null,
  gitRepositories,
  customSpecRoot = null,
  filePath,
  gitStatusFiles,
  openTabs,
  activeTabPath,
  onActivateTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  onReorderTabs,
  activeFileLineRange = null,
  onActiveFileLineRangeChange,
  onActiveCodeAnchorChange,
  onAssociateIntentCanvasCodeAnchor,
  initialMode = "edit",
  openTargets,
  openAppIconById,
  selectedOpenAppId,
  onSelectOpenAppId,
  editorSplitLayout = "vertical",
  onToggleEditorSplitLayout,
  isEditorFileMaximized = false,
  onToggleEditorFileMaximized,
  navigationTarget = null,
  highlightMarkers = null,
  onNavigateToLocation,
  onOpenFileHistory,
  onRevealInFileTree,
  onClose,
  onInsertText,
  onCreateCodeAnnotation,
  onCaptureNote,
  onRemoveCodeAnnotation,
  codeAnnotations = [],
  headerLayout = "stacked",
  onSingleRowLeadingAction,
  singleRowLeadingDirection = "left",
  singleRowLeadingLabel,
  externalChangeMonitoringEnabled = false,
  externalChangeTransportMode = "polling",
  externalChangePollIntervalMs = EXTERNAL_CHANGE_POLL_INTERVAL_MS,
  externalChangeApplyMode = "auto",
  externalChangeAutoApplyDebounceMs = 0,
  markdownPreviewSnapshotMode = "stable",
  fileRenderPressure = DEFAULT_FILE_RENDER_PRESSURE,
  saveFileShortcut = "cmd+s",
  findInFileShortcut = "cmd+f",
  expandSelectionShortcut = "cmd+w",
  onSaveSuccess,
  onDirtyChange,
}: FileViewPanelProps) {
  const { t } = useTranslation();
  useEffect(() => {
    void loadFileViewStyles();
  }, []);
  const renderProfile = useMemo(
    () => resolveFileRenderProfile(filePath),
    [filePath],
  );
  const defaultMode = useMemo(
    () => resolveDefaultFileViewMode(renderProfile, initialMode),
    [initialMode, renderProfile],
  );
  const isImage = renderProfile.kind === "image";
  const skipTextRead = renderProfile.previewSourceKind !== "inline-bytes";
  const canEditDocument = renderProfile.editCapability !== "read-only";
  const [mode, setMode] = useState<"preview" | "edit">(() => defaultMode);
  const [editorTheme, setEditorTheme] = useState<EditorTheme>(() =>
    resolveEditorTheme(),
  );
  const [gitLineMarkers, setGitLineMarkers] = useState<GitLineMarkers>({
    added: [],
    modified: [],
  });
  const [annotationDraft, setAnnotationDraft] = useState<{
    lineRange: CodeAnnotationLineRange;
    source: "file-preview-mode" | "file-edit-mode";
    body: string;
  } | null>(null);
  const [markdownPreviewOverride, setMarkdownPreviewOverride] = useState<{
    key: string;
    content: string;
    truncated: boolean;
  } | null>(null);
  const markdownPreviewOverrideRequestRef = useRef(0);
  const [editorLocalLineRange, setEditorLocalLineRange] =
    useState<CodeAnnotationLineRange | null>(() => activeFileLineRange);
  const annotationDraftBodyRef = useRef("");
  const editorLocalLineRangeRef = useRef<CodeAnnotationLineRange | null>(
    activeFileLineRange,
  );
  const pendingEditorLineRangeRef = useRef<CodeAnnotationLineRange | null>(
    activeFileLineRange,
  );
  const editorLineRangeSyncTimerRef = useRef<number | null>(null);
  const activeCodeAnchorResolveTimerRef = useRef<number | null>(null);
  const activeCodeAnchorResolveEpochRef = useRef(0);
  const lastPublishedEditorLineRangeKeyRef = useRef(
    formatEditorLineRangeKey(activeFileLineRange),
  );
  const [activeDeclarationCodeAnchor, setActiveDeclarationCodeAnchor] =
    useState<IntentCanvasCodeSelectionAnchor | null>(null);
  const cmRef = useRef<FileCodeMirrorEditorHandle | null>(null);
  const lastReportedLineRangeRef = useRef<string>("");
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const panelRootRef = useRef<HTMLDivElement | null>(null);
  const [tabContextMenu, setTabContextMenu] =
    useState<RendererContextMenuState | null>(null);
  const [fileContextMenu, setFileContextMenu] =
    useState<RendererContextMenuState | null>(null);
  const pendingGitBlamePathRef = useRef<string | null>(null);
  const [draggingTabPath, setDraggingTabPath] = useState<string | null>(null);
  const [dragOverTabPath, setDragOverTabPath] = useState<string | null>(null);
  const activeAnnotationLineRange =
    annotationDraft?.source === "file-edit-mode"
      ? annotationDraft.lineRange
      : (editorLocalLineRange ?? activeFileLineRange);
  const effectiveAnnotationDraftBody = annotationDraft
    ? annotationDraftBodyRef.current || annotationDraft.body
    : "";
  const effectiveAnnotationDraft = useMemo(
    () =>
      annotationDraft
        ? {
            ...annotationDraft,
            body: effectiveAnnotationDraftBody,
          }
        : null,
    [annotationDraft, effectiveAnnotationDraftBody],
  );
  const beginAnnotationDraft = useCallback(
    (
      lineRange: CodeAnnotationLineRange,
      source: "file-preview-mode" | "file-edit-mode",
    ) => {
      annotationDraftBodyRef.current = "";
      setAnnotationDraft({
        lineRange: {
          startLine: lineRange.startLine,
          endLine: lineRange.endLine,
        },
        source,
        body: "",
      });
    },
    [],
  );
  const handleStartEditorAnnotation = useCallback(() => {
    const lineRange =
      annotationDraft?.source === "file-edit-mode"
        ? annotationDraft.lineRange
        : (editorLocalLineRangeRef.current ?? activeAnnotationLineRange);
    if (!lineRange) {
      return;
    }
    beginAnnotationDraft(lineRange, "file-edit-mode");
  }, [activeAnnotationLineRange, annotationDraft, beginAnnotationDraft]);
  const handleConfirmAnnotationDraft = useCallback(
    (bodyOverride?: string) => {
      if (!annotationDraft) {
        return;
      }
      const body = (
        bodyOverride ??
        annotationDraftBodyRef.current ??
        annotationDraft.body
      ).trim();
      if (!body) {
        return;
      }
      onCreateCodeAnnotation?.({
        path: filePath,
        lineRange: annotationDraft.lineRange,
        body,
        source: annotationDraft.source,
      });
      annotationDraftBodyRef.current = "";
      setAnnotationDraft(null);
    },
    [annotationDraft, filePath, onCreateCodeAnnotation],
  );
  const clearPendingEditorLineRangeSync = useCallback(() => {
    if (editorLineRangeSyncTimerRef.current !== null) {
      window.clearTimeout(editorLineRangeSyncTimerRef.current);
      editorLineRangeSyncTimerRef.current = null;
    }
  }, []);
  const clearPendingActiveCodeAnchorResolve = useCallback(() => {
    if (activeCodeAnchorResolveTimerRef.current !== null) {
      window.clearTimeout(activeCodeAnchorResolveTimerRef.current);
      activeCodeAnchorResolveTimerRef.current = null;
    }
  }, []);
  const scheduleEditorLineRangePublish = useCallback(
    (lineRange: CodeAnnotationLineRange | null) => {
      pendingEditorLineRangeRef.current = lineRange;
      clearPendingEditorLineRangeSync();
      editorLineRangeSyncTimerRef.current = window.setTimeout(() => {
        editorLineRangeSyncTimerRef.current = null;
        const pendingLineRange = pendingEditorLineRangeRef.current;
        const pendingKey = formatEditorLineRangeKey(pendingLineRange);
        if (pendingKey === lastPublishedEditorLineRangeKeyRef.current) {
          return;
        }
        lastPublishedEditorLineRangeKeyRef.current = pendingKey;
        startTransition(() => {
          setEditorLocalLineRange((current) =>
            isSameEditorLineRange(current, pendingLineRange)
              ? current
              : pendingLineRange,
          );
          onActiveFileLineRangeChange?.(pendingLineRange);
        });
      }, EDITOR_LINE_RANGE_SYNC_DELAY_MS);
    },
    [clearPendingEditorLineRangeSync, onActiveFileLineRangeChange],
  );
  const handleEditorLineRangeChange = useCallback(
    (lineRange: CodeAnnotationLineRange | null) => {
      if (isSameEditorLineRange(editorLocalLineRangeRef.current, lineRange)) {
        return;
      }
      editorLocalLineRangeRef.current = lineRange;
      scheduleEditorLineRangePublish(lineRange);
    },
    [scheduleEditorLineRangePublish],
  );
  const [fileReferenceShouldRender, setFileReferenceShouldRender] =
    useState(false);
  const [fileReferenceVisible, setFileReferenceVisible] = useState(false);
  const usesSingleRowHeader = headerLayout === "single-row";
  const splitResizeCleanupRef = useRef<(() => void) | null>(null);
  const pendingOpenFindPanelRef = useRef(false);
  const gitRootWorkspacePrefix = useMemo(
    () => resolveGitRootWorkspacePrefix(workspacePath, gitRoot),
    [gitRoot, workspacePath],
  );
  const gitStatusMap = useMemo(() => {
    const map = new Map<string, { status: string; path: string }>();
    if (!gitStatusFiles) {
      return map;
    }
    for (const entry of gitStatusFiles) {
      const entryPath = entry.path?.trim();
      const entryStatus = entry.status?.trim();
      if (!entryPath || !entryStatus) {
        continue;
      }
      const candidates = resolveGitStatusPathCandidates(
        workspacePath,
        gitRootWorkspacePrefix,
        entryPath,
      );
      for (const candidate of candidates) {
        if (!map.has(candidate)) {
          map.set(candidate, { status: entryStatus, path: entryPath });
        }
      }
    }
    return map;
  }, [gitRootWorkspacePrefix, gitStatusFiles, workspacePath]);
  const fileReadTarget = useMemo(
    () => resolveFileReadTarget(workspacePath, filePath, customSpecRoot),
    [workspacePath, filePath, customSpecRoot],
  );
  const workspaceRelativeFilePath = fileReadTarget.workspaceRelativePath;
  const resolvedWorkspaceName = useMemo(() => {
    const explicitName = workspaceName?.trim();
    if (explicitName) {
      return explicitName;
    }
    const pathSegments = normalizeFsPath(workspacePath)
      .split("/")
      .filter(Boolean);
    return (
      pathSegments[pathSegments.length - 1] ??
      (workspacePath.trim() || workspaceId)
    );
  }, [workspaceId, workspaceName, workspacePath]);
  const matchedGitStatus = useMemo(() => {
    const fileCandidates = new Set<string>([
      ...resolveWorkspacePathCandidates(
        workspacePath,
        workspaceRelativeFilePath,
      ),
      ...resolveWorkspacePathCandidates(workspacePath, filePath),
    ]);
    for (const candidate of fileCandidates) {
      const matched = gitStatusMap.get(candidate);
      if (matched) {
        return matched;
      }
    }
    return null;
  }, [filePath, gitStatusMap, workspacePath, workspaceRelativeFilePath]);
  const fileGitStatus = matchedGitStatus?.status ?? null;
  const gitDiffTargetPath = matchedGitStatus?.path ?? workspaceRelativeFilePath;
  const resolveMatchedGitStatusByPath = useCallback(
    (path: string) => {
      for (const candidate of resolveWorkspacePathCandidates(
        workspacePath,
        path,
      )) {
        const matched = gitStatusMap.get(candidate);
        if (matched) {
          return matched;
        }
      }
      return null;
    },
    [gitStatusMap, workspacePath],
  );
  const absolutePath = useMemo(
    () =>
      fileReadTarget.domain === "workspace"
        ? resolveAbsolutePath(workspacePath, workspaceRelativeFilePath)
        : fileReadTarget.normalizedInputPath,
    [workspacePath, workspaceRelativeFilePath, fileReadTarget],
  );
  const caseInsensitivePathCompare = useMemo(
    () => isLikelyWindowsFsPath(normalizeFsPath(workspacePath)),
    [workspacePath],
  );
  const isSameWorkspacePath = useCallback(
    (leftPath: string, rightPath: string) =>
      normalizeComparablePath(leftPath, caseInsensitivePathCompare) ===
      normalizeComparablePath(rightPath, caseInsensitivePathCompare),
    [caseInsensitivePathCompare],
  );
  const {
    content,
    setContent,
    cacheDraftContent,
    documentSnapshot,
    replaceDocumentSnapshot,
    error,
    isDirty,
    isLoading,
    isSaving,
    savedContentRef,
    latestIsDirtyRef,
    externalDiskSnapshotRef,
    truncated,
    handleSave: handleDocumentSave,
  } = useFileDocumentState({
    workspaceId,
    customSpecRoot,
    workspaceRelativeFilePath,
    fileReadTarget,
    skipTextRead,
    externalAbsoluteReadOnlyMessage: t("files.externalAbsoluteReadOnly"),
  });
  const currentFileRenderToken = useMemo(
    () =>
      [
        workspaceId,
        workspaceRelativeFilePath,
        documentSnapshot.snapshotVersion,
      ].join("\u001f"),
    [documentSnapshot.snapshotVersion, workspaceId, workspaceRelativeFilePath],
  );
  const latestFileRenderTokenRef = useRef(currentFileRenderToken);
  latestFileRenderTokenRef.current = currentFileRenderToken;
  const editorDraftContentRef = useRef(content);
  const [editorDraftDirty, setEditorDraftDirty] = useState(false);
  const effectiveIsDirty = isDirty || editorDraftDirty;
  latestIsDirtyRef.current = effectiveIsDirty;
  const hasGitRepositoryInventory = Boolean(gitRepositories?.length);
  const aggregateGitScope = useMemo(
    () =>
      gitRepositories?.length
        ? resolveFileGitScope(workspaceRelativeFilePath, gitRepositories)
        : null,
    [gitRepositories, workspaceRelativeFilePath],
  );
  const configuredGitBlameRepositoryRoot = gitRootWorkspacePrefix || null;
  const gitBlameRepositoryRoot = hasGitRepositoryInventory
    ? aggregateGitScope?.repositoryRoot || null
    : configuredGitBlameRepositoryRoot;
  const gitBlamePath = useMemo(
    () =>
      hasGitRepositoryInventory
        ? (aggregateGitScope?.path ?? workspaceRelativeFilePath)
        : resolveGitBlameRepositoryPath(
            workspaceRelativeFilePath,
            configuredGitBlameRepositoryRoot,
          ),
    [
      aggregateGitScope,
      configuredGitBlameRepositoryRoot,
      hasGitRepositoryInventory,
      workspaceRelativeFilePath,
    ],
  );
  const fileBelongsToGitRepository = hasGitRepositoryInventory
    ? aggregateGitScope !== null
    : !configuredGitBlameRepositoryRoot ||
      workspaceRelativeFilePath === configuredGitBlameRepositoryRoot ||
      workspaceRelativeFilePath.startsWith(
        `${configuredGitBlameRepositoryRoot}/`,
      );
  const activeFileGitScope = useMemo(
    () =>
      fileReadTarget.domain === "workspace" && fileBelongsToGitRepository
        ? {
            repositoryRoot: gitBlameRepositoryRoot ?? "",
            path: gitBlamePath,
          }
        : null,
    [
      fileBelongsToGitRepository,
      fileReadTarget.domain,
      gitBlamePath,
      gitBlameRepositoryRoot,
    ],
  );
  const gitBlameEligible =
    canEditDocument &&
    !skipTextRead &&
    !truncated &&
    !isLoading &&
    fileReadTarget.domain === "workspace" &&
    fileBelongsToGitRepository &&
    documentSnapshot.byteLength <= FILE_GIT_BLAME_MAX_BYTES &&
    documentSnapshot.lineCount <= FILE_GIT_BLAME_MAX_LINES;
  const gitBlame = useFileGitBlame({
    workspaceId,
    repositoryRoot: gitBlameRepositoryRoot,
    path: gitBlamePath,
    renderToken: currentFileRenderToken,
    eligible: gitBlameEligible,
    isDirty: effectiveIsDirty,
  });
  const typingDiagnosticsRef = useRef<FileEditorTypingDiagnosticsSession>(
    createFileEditorTypingDiagnosticsSession({
      workspaceId,
      filePath,
      fileKind: renderProfile.kind,
      byteLength: null,
      lineCount: null,
    }),
  );

  useEffect(() => {
    typingDiagnosticsRef.current = createFileEditorTypingDiagnosticsSession({
      workspaceId,
      filePath,
      fileKind: renderProfile.kind,
      byteLength: null,
      lineCount: null,
    });
  }, [filePath, renderProfile.kind, workspaceId]);

  useEffect(() => {
    editorDraftContentRef.current = content;
    setEditorDraftDirty(false);
  }, [content]);

  const handleEditorContentDraftChange = useCallback(
    (nextContent: string) => {
      editorDraftContentRef.current = nextContent;
      if (!isLoading) {
        cacheDraftContent(nextContent);
      }
      const nextIsDirty = nextContent !== savedContentRef.current;
      latestIsDirtyRef.current = nextIsDirty;
      setEditorDraftDirty((current) =>
        current === nextIsDirty ? current : nextIsDirty,
      );
    },
    [cacheDraftContent, isLoading, latestIsDirtyRef, savedContentRef],
  );

  const flushEditorDraftToDocument = useCallback(() => {
    setContent(editorDraftContentRef.current);
  }, [setContent]);

  const handleEditorContentPublished = useCallback(() => {
    typingDiagnosticsRef.current.recordPublishedUpdate();
  }, []);

  const handleEditorTypingInput = useCallback((durationMs: number) => {
    typingDiagnosticsRef.current.recordInput(durationMs);
  }, []);

  const activeDeclarationLineRange =
    editorLocalLineRange ?? activeFileLineRange;

  useEffect(() => {
    const resolveEpoch = activeCodeAnchorResolveEpochRef.current + 1;
    activeCodeAnchorResolveEpochRef.current = resolveEpoch;
    clearPendingActiveCodeAnchorResolve();

    if (!activeDeclarationLineRange) {
      startTransition(() => {
        setActiveDeclarationCodeAnchor(null);
      });
      return;
    }

    activeCodeAnchorResolveTimerRef.current = window.setTimeout(() => {
      activeCodeAnchorResolveTimerRef.current = null;
      if (activeCodeAnchorResolveEpochRef.current !== resolveEpoch) {
        return;
      }
      const nextAnchor = resolveDeclarationCodeSelectionAnchor({
        filePath,
        content: editorDraftContentRef.current,
        lineRange: activeDeclarationLineRange,
      });
      startTransition(() => {
        setActiveDeclarationCodeAnchor(nextAnchor);
      });
    }, EDITOR_LINE_RANGE_SYNC_DELAY_MS);

    return clearPendingActiveCodeAnchorResolve;
  }, [
    activeDeclarationLineRange,
    clearPendingActiveCodeAnchorResolve,
    filePath,
  ]);

  useEffect(() => {
    onActiveCodeAnchorChange?.(activeDeclarationCodeAnchor);
  }, [activeDeclarationCodeAnchor, onActiveCodeAnchorChange]);

  const handleAssociateIntentCanvasCodeAnchor = useCallback(() => {
    if (!activeDeclarationCodeAnchor) {
      pushErrorToast({
        title: t("files.associateIntentCanvasUnavailableTitle"),
        message: t("files.associateIntentCanvasUnavailable"),
        variant: "info",
        durationMs: 4200,
      });
      return;
    }
    onAssociateIntentCanvasCodeAnchor?.(activeDeclarationCodeAnchor);
  }, [activeDeclarationCodeAnchor, onAssociateIntentCanvasCodeAnchor, t]);

  const {
    externalChangeConflict,
    externalPendingRefresh,
    externalCompareOpen,
    externalAutoSyncAt,
    externalChangeSyncState,
    handleExternalReloadFromDisk,
    handleExternalApplyPendingRefresh,
    handleExternalKeepLocal,
    handleExternalToggleCompare,
    setExternalChangeSyncState,
    setExternalChangeConflict,
    setExternalPendingRefresh,
    setExternalCompareOpen,
    setExternalAutoSyncAt,
  } = useFileExternalSync({
    filePath,
    workspaceId,
    workspaceRelativeFilePath,
    fileReadTargetDomain: fileReadTarget.domain,
    externalChangeMonitoringEnabled,
    externalChangeTransportMode,
    externalChangePollIntervalMs,
    externalChangeApplyMode,
    externalChangeAutoApplyDebounceMs,
    isBinary: skipTextRead,
    isDirty: effectiveIsDirty,
    isLoading,
    caseInsensitivePathCompare,
    replaceDocumentSnapshot,
    previewSnapshotVersion: documentSnapshot.snapshotVersion,
    fileRenderPressure,
    savedContentRef,
    latestIsDirtyRef,
    externalDiskSnapshotRef,
    autoSyncedMessage: t("files.externalChangeAutoSynced"),
  });
  const handleSave = useCallback(async () => {
    flushEditorDraftToDocument();
    const saved = await handleDocumentSave();
    if (!saved) {
      return;
    }
    typingDiagnosticsRef.current.recordTauriFileWrite();
    setEditorDraftDirty(false);
    setExternalChangeSyncState((current) =>
      reduceExternalChangeSyncState(current, { type: "file-loaded" }),
    );
    setExternalChangeConflict(null);
    setExternalPendingRefresh(null);
    setExternalCompareOpen(false);
    setExternalAutoSyncAt(null);
    if (gitBlame.enabled) {
      gitBlame.refresh();
    }
    onSaveSuccess?.();
  }, [
    flushEditorDraftToDocument,
    handleDocumentSave,
    gitBlame,
    onSaveSuccess,
    setExternalChangeConflict,
    setExternalPendingRefresh,
    setExternalChangeSyncState,
    setExternalCompareOpen,
    setExternalAutoSyncAt,
  ]);

  const {
    isDefinitionLoading,
    isReferencesLoading,
    isImplementationsLoading,
    navigationError,
    definitionCandidates,
    setDefinitionCandidates,
    referenceResults,
    setReferenceResults,
    implementationCandidates,
    setImplementationCandidates,
    navigateToLocation,
    runDefinitionFromCursor,
    runReferencesFromCursor,
    runImplementationsFromCursor,
    resolveDefinitionAtOffset,
    openFindPanelInEditor,
    toggleFindPanelInEditor,
  } = useFileNavigation({
    workspaceId,
    workspacePath,
    filePath,
    absolutePath,
    caseInsensitivePathCompare,
    isSameWorkspacePath,
    navigationTarget,
    isLoading,
    t,
    onNavigateToLocation,
    setMode,
    cmRef,
  });
  const hasExplicitHighlightMarkers = useMemo(
    () => hasGitLineMarkers(highlightMarkers),
    [highlightMarkers],
  );
  const effectiveGitLineMarkers = useMemo(
    () => (hasExplicitHighlightMarkers ? highlightMarkers! : gitLineMarkers),
    [hasExplicitHighlightMarkers, highlightMarkers, gitLineMarkers],
  );
  const gitAddedLineNumberSet = useMemo(
    () => new Set(effectiveGitLineMarkers.added),
    [effectiveGitLineMarkers.added],
  );
  const gitModifiedLineNumberSet = useMemo(
    () => new Set(effectiveGitLineMarkers.modified),
    [effectiveGitLineMarkers.modified],
  );

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);

  const [imageInfo, setImageInfo] = useState<{
    width: number;
    height: number;
    sizeBytes: number | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setImageSrc(null);
    setImageInfo(null);
    setImageLoadError(null);
    if (!isImage) return;

    const fallbackToAssetUrl = () => {
      try {
        return convertFileSrc(absolutePath);
      } catch {
        return null;
      }
    };

    readLocalImageDataUrl(workspaceId, absolutePath)
      .then((dataUrl) => {
        if (cancelled) return;
        setImageSrc(dataUrl ?? fallbackToAssetUrl());
      })
      .catch(() => {
        if (cancelled) return;
        setImageSrc(fallbackToAssetUrl());
      });

    return () => {
      cancelled = true;
    };
  }, [absolutePath, isImage, workspaceId]);

  useEffect(() => {
    setImageInfo(null);
    if (!imageSrc) return;
    let cancelled = false;
    fetch(imageSrc)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to read image bytes: ${res.status}`);
        }
        return res.blob();
      })
      .then((blob) => {
        if (!cancelled) {
          setImageInfo((prev) =>
            prev
              ? { ...prev, sizeBytes: blob.size }
              : { width: 0, height: 0, sizeBytes: blob.size },
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImageInfo(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  const handleImageLoad = useCallback((e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageLoadError(null);
    setImageInfo((prev) => ({
      width: img.naturalWidth,
      height: img.naturalHeight,
      sizeBytes: prev?.sizeBytes ?? null,
    }));
  }, []);
  const handleImageError = useCallback(() => {
    setImageInfo(null);
    setImageLoadError(t("files.imagePreviewLoadFailed"));
  }, [t]);

  useEffect(() => {
    const normalizedStatus = (fileGitStatus ?? "").toUpperCase();
    if (hasExplicitHighlightMarkers) {
      setGitLineMarkers(resetGitLineMarkersIfNeeded);
      return;
    }
    if (!gitBlame.enabled || fileReadTarget.domain !== "workspace") {
      setGitLineMarkers(resetGitLineMarkersIfNeeded);
      return;
    }
    if (
      isLoading ||
      !normalizedStatus ||
      normalizedStatus === "D" ||
      skipTextRead
    ) {
      setGitLineMarkers(resetGitLineMarkersIfNeeded);
      return;
    }
    if (effectiveIsDirty) {
      return;
    }

    let cancelled = false;
    const requestRenderToken = currentFileRenderToken;
    getGitFileFullDiff(workspaceId, gitDiffTargetPath)
      .then((diff) => {
        if (
          cancelled ||
          latestFileRenderTokenRef.current !== requestRenderToken
        ) {
          return;
        }
        setGitLineMarkers(parseLineMarkersFromDiff(diff));
      })
      .catch(() => {
        if (
          !cancelled &&
          latestFileRenderTokenRef.current === requestRenderToken
        ) {
          setGitLineMarkers(resetGitLineMarkersIfNeeded);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentFileRenderToken,
    effectiveIsDirty,
    workspaceId,
    gitDiffTargetPath,
    fileGitStatus,
    fileReadTarget.domain,
    gitBlame.enabled,
    hasExplicitHighlightMarkers,
    isLoading,
    skipTextRead,
  ]);

  useEffect(
    () => () => clearPendingEditorLineRangeSync(),
    [clearPendingEditorLineRangeSync],
  );
  useEffect(
    () => () => clearPendingActiveCodeAnchorResolve(),
    [clearPendingActiveCodeAnchorResolve],
  );

  useEffect(() => {
    if (
      editorLocalLineRangeRef.current !== null ||
      activeFileLineRange === null
    ) {
      return;
    }
    editorLocalLineRangeRef.current = activeFileLineRange;
    pendingEditorLineRangeRef.current = activeFileLineRange;
    lastPublishedEditorLineRangeKeyRef.current =
      formatEditorLineRangeKey(activeFileLineRange);
    setEditorLocalLineRange(activeFileLineRange);
  }, [activeFileLineRange]);

  // Reset mode when file changes
  useEffect(() => {
    pendingOpenFindPanelRef.current = false;
    setMode(defaultMode);
    clearPendingEditorLineRangeSync();
    clearPendingActiveCodeAnchorResolve();
    activeCodeAnchorResolveEpochRef.current += 1;
    editorLocalLineRangeRef.current = null;
    pendingEditorLineRangeRef.current = null;
    lastPublishedEditorLineRangeKeyRef.current = "none";
    setEditorLocalLineRange(null);
    setActiveDeclarationCodeAnchor(null);
    onActiveFileLineRangeChange?.(null);
    lastReportedLineRangeRef.current = "";
  }, [
    clearPendingEditorLineRangeSync,
    clearPendingActiveCodeAnchorResolve,
    defaultMode,
    filePath,
    onActiveFileLineRangeChange,
  ]);

  useEffect(() => {
    if (
      typeof document === "undefined" ||
      typeof MutationObserver === "undefined"
    ) {
      return;
    }
    const updateTheme = () => {
      setEditorTheme((prev) => {
        const next = resolveEditorTheme();
        return prev === next ? prev : next;
      });
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (isThemeMutationAttribute(mutation.attributeName)) {
          updateTheme();
          return;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });
    const media =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: light)")
        : null;
    const handleMediaChange = () => updateTheme();
    if (media?.addEventListener) {
      media.addEventListener("change", handleMediaChange);
    } else if (media?.addListener) {
      media.addListener(handleMediaChange);
    }
    return () => {
      observer.disconnect();
      if (media?.removeEventListener) {
        media.removeEventListener("change", handleMediaChange);
      } else if (media?.removeListener) {
        media.removeListener(handleMediaChange);
      }
    };
  }, []);

  useEffect(() => {
    onDirtyChange?.(effectiveIsDirty);
  }, [effectiveIsDirty, onDirtyChange]);

  // Auto-focus CodeMirror when entering edit mode
  useEffect(() => {
    if (mode === "edit" && !isLoading && !truncated) {
      requestAnimationFrame(() => {
        cmRef.current?.view?.focus();
      });
    }
  }, [mode, isLoading, truncated]);

  const languageExtensionRequestRef = useRef(0);
  const [languageExtensions, setLanguageExtensions] = useState<
    ReactCodeMirrorProps["extensions"]
  >([]);

  useEffect(() => {
    const requestId = languageExtensionRequestRef.current + 1;
    languageExtensionRequestRef.current = requestId;
    if (mode !== "edit" || !renderProfile.editorLanguage) {
      setLanguageExtensions([]);
      return;
    }
    loadCodeMirrorExtensionsForEditorLanguage(renderProfile.editorLanguage)
      .then((extensions) => {
        if (languageExtensionRequestRef.current === requestId) {
          setLanguageExtensions(extensions);
        }
      })
      .catch((error) => {
        console.error(
          "[file-view] failed to load CodeMirror language extension:",
          error,
        );
        if (languageExtensionRequestRef.current === requestId) {
          setLanguageExtensions([]);
        }
      });
  }, [mode, renderProfile.editorLanguage]);

  // Keyboard shortcut: Cmd+S / Ctrl+S (works in any mode, including preview)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) {
        return;
      }
      if (matchesShortcutForPlatform(event, saveFileShortcut)) {
        event.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleSave, saveFileShortcut]);

  // Handle close with unsaved changes
  const handleClose = useCallback(() => {
    if (effectiveIsDirty) {
      const confirmed = window.confirm(t("files.discardChangesMessage"));
      if (!confirmed) return;
    }
    onClose();
  }, [effectiveIsDirty, onClose, t]);

  // Switch to edit mode
  const handleEnterEdit = useCallback(() => {
    if (truncated || !canEditDocument) return;
    setMode("edit");
    requestAnimationFrame(() => {
      cmRef.current?.view?.focus();
    });
  }, [canEditDocument, truncated]);

  // Switch to preview mode
  const handleEnterPreview = useCallback(() => {
    flushEditorDraftToDocument();
    setMode("preview");
    clearPendingEditorLineRangeSync();
    editorLocalLineRangeRef.current = null;
    pendingEditorLineRangeRef.current = null;
    lastPublishedEditorLineRangeKeyRef.current = "none";
    setEditorLocalLineRange(null);
    onActiveFileLineRangeChange?.(null);
    lastReportedLineRangeRef.current = "";
  }, [
    clearPendingEditorLineRangeSync,
    flushEditorDraftToDocument,
    onActiveFileLineRangeChange,
  ]);

  const showClipboardError = useCallback(
    (action: string, error: unknown) => {
      pushErrorToast({
        title: t("files.clipboardActionFailedTitle"),
        message: t("files.clipboardActionFailed", {
          action,
          message: error instanceof Error ? error.message : String(error),
        }),
      });
    },
    [t],
  );

  const openFileContextMenu = useCallback(
    (
      event: ReactMouseEvent<HTMLDivElement>,
      selectionNoteDraft?: NoteCaptureDraft,
    ) => {
      const target = event.target instanceof Element ? event.target : null;
      const isCodeMirrorTarget = Boolean(target?.closest(".cm-editor"));
      const isIndependentEditableTarget = Boolean(
        target?.closest('input, textarea, [contenteditable="true"]'),
      );
      if (!isCodeMirrorTarget && isIndependentEditableTarget) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const editorView = mode === "edit" ? (cmRef.current?.view ?? null) : null;
      const editorSelectionText = editorView
        ? editorView.state.selection.ranges
            .filter((range) => !range.empty)
            .map((range) => editorView.state.sliceDoc(range.from, range.to))
            .join(editorView.state.lineBreak)
        : "";
      const selectedText = editorView
        ? editorSelectionText
        : (window.getSelection()?.toString() ?? "");
      const canMutateEditor = Boolean(
        editorView && canEditDocument && mode === "edit" && !truncated,
      );
      const wholeFileNoteDraft =
        !selectionNoteDraft && onCaptureNote && !skipTextRead && !truncated
          ? buildCodeSelectionNoteDraft({
              path: filePath,
              content: editorView
                ? editorView.state.doc.sliceString(
                    0,
                    editorView.state.doc.length,
                  )
                : content,
              startLine: 1,
              endLine: editorView
                ? editorView.state.doc.lines
                : documentSnapshot.lineCount,
              language: renderProfile.previewLanguage,
            })
          : null;
      const noteCaptureDraft = selectionNoteDraft ?? wholeFileNoteDraft;

      const writeClipboardText = async (action: string, text: string) => {
        try {
          if (!navigator.clipboard?.writeText) {
            throw new Error(t("files.clipboardUnavailable"));
          }
          await navigator.clipboard.writeText(text);
          return true;
        } catch (error) {
          showClipboardError(action, error);
          return false;
        }
      };

      const clipboardItems: RendererContextMenuItem[] = [
        {
          type: "item",
          id: "cut-selection",
          label: t("files.cutItem"),
          icon: <Scissors size={15} />,
          disabled: !canMutateEditor || !selectedText,
          onSelect: async () => {
            if (
              !editorView ||
              !(await writeClipboardText(t("files.cutItem"), selectedText))
            ) {
              return;
            }
            editorView.dispatch(editorView.state.replaceSelection(""));
            editorView.focus();
          },
        },
        {
          type: "item",
          id: "copy-selection",
          label: t("files.copyItem"),
          icon: <Copy size={15} />,
          disabled: !selectedText,
          onSelect: async () => {
            await writeClipboardText(t("files.copyItem"), selectedText);
          },
        },
        {
          type: "item",
          id: "paste-selection",
          label: t("files.pasteItem"),
          icon: <ClipboardPaste size={15} />,
          disabled: !canMutateEditor,
          onSelect: async () => {
            try {
              if (!editorView || !navigator.clipboard?.readText) {
                throw new Error(t("files.clipboardUnavailable"));
              }
              const clipboardText = await navigator.clipboard.readText();
              editorView.dispatch(
                editorView.state.replaceSelection(clipboardText),
              );
              editorView.focus();
            } catch (error) {
              showClipboardError(t("files.pasteItem"), error);
            }
          },
        },
      ];

      const gitItems: RendererContextMenuLeafItem[] = [
        ...(activeFileGitScope && onOpenFileHistory
          ? [
              {
                type: "item" as const,
                id: "show-file-history",
                label: t("files.tabShowFileHistory"),
                icon: <History size={15} />,
                onSelect: () =>
                  onOpenFileHistory({
                    workspaceId,
                    workspacePath,
                    repositoryRoot: activeFileGitScope.repositoryRoot,
                    path: activeFileGitScope.path,
                    displayPath: filePath,
                  }),
              },
            ]
          : []),
        ...(mode === "edit" && (gitBlameEligible || gitBlame.enabled)
          ? [
              {
                type: "item" as const,
                id: "toggle-file-git-blame",
                label:
                  gitBlame.status === "loading"
                    ? t("files.gitBlameLoading")
                    : gitBlame.status === "stale"
                      ? t("files.gitBlameStale")
                      : gitBlame.status === "error"
                        ? t("files.gitBlameError")
                        : gitBlame.enabled
                          ? t("files.gitBlameDisable")
                          : t("files.gitBlameEnable"),
                icon: <GitCommitHorizontal size={15} />,
                disabled: !gitBlameEligible && !gitBlame.enabled,
                onSelect: gitBlame.toggle,
              },
            ]
          : []),
      ];

      const commandItems: RendererContextMenuItem[] = !canEditDocument
        ? []
        : mode === "preview"
          ? [
              {
                type: "item",
                id: "enter-edit-mode",
                label: t("files.edit"),
                icon: <Pencil size={15} />,
                disabled: truncated,
                onSelect: handleEnterEdit,
              },
            ]
          : [
              ...(onAssociateIntentCanvasCodeAnchor
                ? [
                    {
                      type: "item" as const,
                      id: "associate-intent-canvas",
                      label: t("files.associateIntentCanvas"),
                      icon: <ExternalLink size={15} />,
                      onSelect: handleAssociateIntentCanvasCodeAnchor,
                    },
                  ]
                : []),
              ...(editorView && canMutateEditor
                ? [
                    {
                      type: "item" as const,
                      id: "expand-selection",
                      label: t("files.expandSelection"),
                      icon: <TextSelect size={15} />,
                      shortcut: expandSelectionShortcut
                        ? formatShortcutForPlatform(expandSelectionShortcut)
                        : undefined,
                      onSelect: () => {
                        cmRef.current?.expandSelection();
                      },
                    },
                  ]
                : []),
              {
                type: "item",
                id: "goto-definition",
                label: isDefinitionLoading
                  ? t("files.navigating")
                  : t("files.gotoDefinition"),
                icon: <Code size={15} />,
                onSelect: runDefinitionFromCursor,
              },
              {
                type: "item",
                id: "goto-implementations",
                label: isImplementationsLoading
                  ? t("files.navigating")
                  : t("files.gotoImplementations"),
                icon: <Code size={15} />,
                onSelect: runImplementationsFromCursor,
              },
              {
                type: "item",
                id: "find-references",
                label: isReferencesLoading
                  ? t("files.searchingReferences")
                  : t("files.findReferences"),
                icon: <Search size={15} />,
                onSelect: runReferencesFromCursor,
              },
              {
                type: "item",
                id: "enter-preview-mode",
                label: t("files.preview"),
                icon: <Eye size={15} />,
                onSelect: handleEnterPreview,
              },
              {
                type: "item",
                id: "save-file",
                label: isSaving
                  ? t("files.saving")
                  : effectiveIsDirty
                    ? t("files.save")
                    : t("files.saved"),
                icon: <Save size={15} />,
                disabled: !effectiveIsDirty || isSaving,
                onSelect: handleSave,
              },
            ];

      const itemGroups: RendererContextMenuItem[][] = [
        ...(noteCaptureDraft && onCaptureNote
          ? [
              [
                {
                  type: "item" as const,
                  id: "capture-file-note",
                  label: selectionNoteDraft
                    ? t("noteCards.captureSelection")
                    : t("noteCards.captureWholeFile"),
                  icon: <NotebookPen size={15} />,
                  onSelect: () => onCaptureNote(noteCaptureDraft),
                },
              ],
            ]
          : []),
        clipboardItems,
        ...(gitItems.length > 0
          ? [
              [
                {
                  type: "submenu" as const,
                  id: "git-actions",
                  label: t("files.tabGitActions"),
                  icon: <GitBranch size={15} />,
                  items: gitItems,
                },
              ],
            ]
          : []),
        ...(onRevealInFileTree
          ? [
              [
                {
                  type: "item" as const,
                  id: "reveal-in-file-tree",
                  label: t("files.revealInFileTree"),
                  icon: <LocateFixed size={15} />,
                  onSelect: () => onRevealInFileTree(filePath),
                },
              ],
            ]
          : []),
        ...(commandItems.length > 0 ? [commandItems] : []),
      ];
      const items = itemGroups.flatMap((group, groupIndex) =>
        groupIndex === 0
          ? group
          : [
              {
                type: "separator" as const,
                id: `file-command-separator-${groupIndex}`,
              },
              ...group,
            ],
      );
      const position = clampRendererContextMenuPosition(
        event.clientX,
        event.clientY,
        {
          width: 248,
          height: estimateRendererContextMenuHeight(items),
          padding: 10,
        },
      );
      setFileContextMenu({
        ...position,
        label: t("files.fileContextMenu"),
        items,
      });
    },
    [
      activeFileGitScope,
      canEditDocument,
      content,
      documentSnapshot.lineCount,
      effectiveIsDirty,
      expandSelectionShortcut,
      filePath,
      gitBlame,
      gitBlameEligible,
      handleAssociateIntentCanvasCodeAnchor,
      handleEnterEdit,
      handleEnterPreview,
      handleSave,
      isDefinitionLoading,
      isImplementationsLoading,
      isReferencesLoading,
      isSaving,
      mode,
      onAssociateIntentCanvasCodeAnchor,
      onCaptureNote,
      onOpenFileHistory,
      onRevealInFileTree,
      renderProfile.previewLanguage,
      runDefinitionFromCursor,
      runImplementationsFromCursor,
      runReferencesFromCursor,
      showClipboardError,
      skipTextRead,
      t,
      truncated,
      workspaceId,
      workspacePath,
    ],
  );

  const handleOpenFindPanel = useCallback(() => {
    if (skipTextRead || truncated) {
      return;
    }
    pendingOpenFindPanelRef.current = true;
    if (mode !== "edit") {
      setMode("edit");
      return;
    }
    if (toggleFindPanelInEditor()) {
      pendingOpenFindPanelRef.current = false;
    }
  }, [mode, skipTextRead, toggleFindPanelInEditor, truncated]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!matchesShortcutForPlatform(event, findInFileShortcut)) {
        return;
      }
      const panelRoot = panelRootRef.current;
      const target = event.target;
      if (
        !panelRoot ||
        !(target instanceof Node) ||
        !panelRoot.contains(target)
      ) {
        return;
      }
      if (isEditableShortcutTarget(target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      handleOpenFindPanel();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [findInFileShortcut, handleOpenFindPanel]);

  useEffect(() => {
    if (!pendingOpenFindPanelRef.current) {
      return;
    }
    if (mode !== "edit" || isLoading || truncated) {
      return;
    }
    let rafId = 0;
    let attemptCount = 0;
    const attemptOpen = () => {
      attemptCount += 1;
      if (openFindPanelInEditor()) {
        pendingOpenFindPanelRef.current = false;
        return;
      }
      if (attemptCount < 10) {
        rafId = window.requestAnimationFrame(attemptOpen);
      }
    };
    rafId = window.requestAnimationFrame(attemptOpen);
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isLoading, mode, openFindPanelInEditor, truncated]);

  useEffect(() => {
    const shouldLoadPreviewOverride =
      mode === "preview" &&
      truncated &&
      renderProfile.kind === "markdown" &&
      fileReadTarget.domain === "workspace";
    const overrideKey = `${workspaceId}:${workspaceRelativeFilePath}`;
    if (!shouldLoadPreviewOverride) {
      setMarkdownPreviewOverride(null);
      return;
    }

    let cancelled = false;
    const requestRenderToken = latestFileRenderTokenRef.current;
    markdownPreviewOverrideRequestRef.current += 1;
    const requestId = markdownPreviewOverrideRequestRef.current;
    readWorkspaceFilePreview(workspaceId, workspaceRelativeFilePath)
      .then((response) => {
        if (
          cancelled ||
          requestId !== markdownPreviewOverrideRequestRef.current ||
          latestFileRenderTokenRef.current !== requestRenderToken
        ) {
          return;
        }
        setMarkdownPreviewOverride({
          key: overrideKey,
          content: response.content ?? "",
          truncated: Boolean(response.truncated),
        });
      })
      .catch(() => {
        if (
          cancelled ||
          requestId !== markdownPreviewOverrideRequestRef.current ||
          latestFileRenderTokenRef.current !== requestRenderToken
        ) {
          return;
        }
        setMarkdownPreviewOverride(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    fileReadTarget.domain,
    mode,
    renderProfile.kind,
    truncated,
    workspaceId,
    workspaceRelativeFilePath,
  ]);

  const effectiveMarkdownPreviewContent =
    markdownPreviewOverride?.content ?? content;

  // Syntax highlighted lines for code preview
  const previewMetrics = useMemo(() => {
    if (
      mode === "preview" &&
      renderProfile.kind === "markdown" &&
      markdownPreviewOverride?.content
    ) {
      return {
        byteLength: 0,
        lineCount: 0,
        truncated: false,
      };
    }
    return getFileDocumentSnapshotMetrics(documentSnapshot);
  }, [documentSnapshot, markdownPreviewOverride, mode, renderProfile.kind]);
  const viewSurface = useMemo(
    () => resolveFileViewSurface(renderProfile, mode, previewMetrics),
    [mode, previewMetrics, renderProfile],
  );
  const markdownFastFeatureFlags = useMemo(
    resolveFileMarkdownFastFeatureFlags,
    [],
  );
  const markdownRendererProfile = useMemo<
    FastMarkdownRendererProfileId | undefined
  >(() => {
    if (viewSurface.kind !== "markdown-preview") {
      return undefined;
    }
    return resolveFastMarkdownRendererProfile(
      resolveFastMarkdownProfileInputs({
        rawMarkdown: effectiveMarkdownPreviewContent,
        featureFlags: markdownFastFeatureFlags,
      }),
    );
  }, [
    effectiveMarkdownPreviewContent,
    markdownFastFeatureFlags,
    viewSurface.kind,
  ]);
  const previewPayloadEnabled =
    mode === "preview" &&
    (viewSurface.kind === "pdf-preview" ||
      viewSurface.kind === "tabular-preview" ||
      viewSurface.kind === "document-preview");
  const {
    payload: previewPayload,
    isLoading: previewPayloadLoading,
    error: previewPayloadError,
  } = useFilePreviewPayload({
    workspaceId,
    customSpecRoot,
    fileReadTarget,
    absolutePath,
    renderProfile,
    content,
    truncated,
    enabled: previewPayloadEnabled,
  });
  const previewLanguage = renderProfile.previewLanguage;
  const shouldBuildCodePreviewLines =
    viewSurface.kind === "code-preview" && documentSnapshot.lineCount <= 1_000;
  const highlightedPreviewLanguage = useMemo(
    () =>
      shouldBuildCodePreviewLines && !viewSurface.useLowCostPreview
        ? previewLanguage
        : null,
    [
      previewLanguage,
      shouldBuildCodePreviewLines,
      viewSurface.useLowCostPreview,
    ],
  );
  const lines = useMemo(
    () =>
      shouldBuildCodePreviewLines
        ? documentSnapshot.getLines(0, documentSnapshot.lineCount)
        : [],
    [documentSnapshot, shouldBuildCodePreviewLines],
  );
  const visibleCodeAnnotations = useMemo(
    () =>
      codeAnnotations.filter((annotation) =>
        isSameCodeAnnotationPath(annotation.path, filePath),
      ),
    [codeAnnotations, filePath],
  );
  const highlightedLines = useMemo(
    () =>
      lines.map((line) => {
        const html = highlightLine(line, highlightedPreviewLanguage);
        return html || "&nbsp;";
      }),
    [highlightedPreviewLanguage, lines],
  );
  const annotationWidgetLabels = useMemo(
    () => ({
      title: t("files.annotationDraft"),
      remove: t("files.annotationRemove"),
      placeholder: t("files.annotationPlaceholder"),
      cancel: t("common.cancel"),
      submit: t("files.annotationSubmit"),
    }),
    [t],
  );
  const annotationWidgetCallbacks = useMemo<AnnotationWidgetCallbacks>(
    () => ({
      onDraftCancel: () => {
        annotationDraftBodyRef.current = "";
        setAnnotationDraft(null);
      },
      onDraftConfirm: handleConfirmAnnotationDraft,
      onRemoveAnnotation: onRemoveCodeAnnotation,
    }),
    [handleConfirmAnnotationDraft, onRemoveCodeAnnotation],
  );
  const editorCodeAnnotations = useMemo(
    () =>
      visibleCodeAnnotations.filter(
        (annotation) => annotation.source === "file-edit-mode",
      ),
    [visibleCodeAnnotations],
  );
  const editorAnnotationDraft =
    effectiveAnnotationDraft?.source === "file-edit-mode"
      ? effectiveAnnotationDraft
      : null;

  const visibleTabs = useMemo(
    () => (openTabs && openTabs.length > 0 ? openTabs : [filePath]),
    [openTabs, filePath],
  );
  const canCloseAllTabs = Boolean(onCloseAllTabs && visibleTabs.length > 0);
  const canReorderTabs = Boolean(onReorderTabs) && visibleTabs.length > 1;
  const visibleActiveFileLineRange =
    editorLocalLineRange ?? activeFileLineRange;
  const activeFileLineLabel = visibleActiveFileLineRange
    ? visibleActiveFileLineRange.startLine ===
      visibleActiveFileLineRange.endLine
      ? `L${visibleActiveFileLineRange.startLine}`
      : `L${visibleActiveFileLineRange.startLine}-L${visibleActiveFileLineRange.endLine}`
    : null;

  useEffect(() => {
    if (activeFileLineLabel) {
      setFileReferenceShouldRender(true);
      setFileReferenceVisible(true);
      return;
    }
    if (!fileReferenceShouldRender) {
      return;
    }
    setFileReferenceVisible(false);
    const timerId = window.setTimeout(() => {
      setFileReferenceShouldRender(false);
    }, 120);
    return () => window.clearTimeout(timerId);
  }, [activeFileLineLabel, fileReferenceShouldRender]);

  const closeTabContextMenu = useCallback(() => {
    setTabContextMenu(null);
  }, []);

  // Tab reordering uses pointer events rather than native HTML5 drag-and-drop:
  // the macOS Tauri webview (WKWebView) does not reliably start an HTML5 drag
  // that originates on the inner <button>, so a pointer-driven gesture is used.
  const tabDragOriginRef = useRef<{
    tabPath: string;
    pointerId: number;
    startX: number;
    moved: boolean;
  } | null>(null);
  const suppressTabClickRef = useRef(false);

  const resolveTabPathAtPoint = useCallback(
    (clientX: number, clientY: number) => {
      const element = document.elementFromPoint(clientX, clientY);
      const tab = element?.closest<HTMLElement>(".fvp-tab");
      return tab?.dataset.tabPath ?? null;
    },
    [],
  );

  const endTabDrag = useCallback(() => {
    tabDragOriginRef.current = null;
    setDraggingTabPath(null);
    setDragOverTabPath(null);
  }, []);

  const handleTabPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, tabPath: string) => {
      suppressTabClickRef.current = false;
      if (!canReorderTabs || event.button !== 0) {
        return;
      }
      // Let the close/detach buttons own their own gestures.
      if (
        (event.target as HTMLElement).closest(".fvp-tab-close, .fvp-tab-detach")
      ) {
        return;
      }
      tabDragOriginRef.current = {
        tabPath,
        pointerId: event.pointerId,
        startX: event.clientX,
        moved: false,
      };
    },
    [canReorderTabs],
  );

  const handleTabPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const origin = tabDragOriginRef.current;
      if (!origin || event.pointerId !== origin.pointerId) {
        return;
      }
      if (!origin.moved) {
        if (Math.abs(event.clientX - origin.startX) < 4) {
          return;
        }
        origin.moved = true;
        setDraggingTabPath(origin.tabPath);
        try {
          event.currentTarget.setPointerCapture(origin.pointerId);
        } catch {
          // Pointer capture is best-effort.
        }
      }
      const overPath = resolveTabPathAtPoint(event.clientX, event.clientY);
      setDragOverTabPath((current) =>
        current === overPath ? current : overPath,
      );
    },
    [resolveTabPathAtPoint],
  );

  const handleTabPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const origin = tabDragOriginRef.current;
      if (!origin || event.pointerId !== origin.pointerId) {
        return;
      }
      if (origin.moved) {
        // Swallow the click that the browser fires after the drag gesture so a
        // reorder never doubles as a tab activation.
        suppressTabClickRef.current = true;
        const source = origin.tabPath;
        const targetPath = resolveTabPathAtPoint(event.clientX, event.clientY);
        if (targetPath && targetPath !== source) {
          const nextOrder = reorderTabPathsAtTarget(
            visibleTabs,
            source,
            targetPath,
          );
          if (nextOrder.some((path, index) => path !== visibleTabs[index])) {
            onReorderTabs?.(nextOrder);
          }
        }
      }
      endTabDrag();
    },
    [endTabDrag, onReorderTabs, resolveTabPathAtPoint, visibleTabs],
  );

  const handleOpenDetachedTab = useCallback(
    (tabPath: string) => {
      void openNewDetachedFileExplorerWindow(
        buildDetachedFileExplorerSession({
          workspaceId,
          workspaceName: resolvedWorkspaceName,
          workspacePath,
          gitRoot,
          initialFilePath: tabPath,
          defaultSidebarCollapsed: true,
        }),
      ).catch((error) => {
        pushErrorToast({
          title: t("files.openDetachedTab"),
          message: error instanceof Error ? error.message : String(error),
        });
      });
    },
    [gitRoot, resolvedWorkspaceName, t, workspaceId, workspacePath],
  );

  const resolveTabGitScope = useCallback(
    (tabPath: string) => {
      if (gitRepositories?.length) {
        return resolveFileGitScope(tabPath, gitRepositories);
      }
      const normalizedPath = normalizeFsPath(tabPath)
        .replace(/^\.\//, "")
        .replace(/^\/+/, "");
      if (
        !normalizedPath ||
        normalizedPath.split("/").some((segment) => segment === "..") ||
        (configuredGitBlameRepositoryRoot &&
          normalizedPath !== configuredGitBlameRepositoryRoot &&
          !normalizedPath.startsWith(`${configuredGitBlameRepositoryRoot}/`))
      ) {
        return null;
      }
      return {
        repositoryRoot: configuredGitBlameRepositoryRoot ?? "",
        path: resolveGitBlameRepositoryPath(
          normalizedPath,
          configuredGitBlameRepositoryRoot,
        ),
      };
    },
    [configuredGitBlameRepositoryRoot, gitRepositories],
  );

  const handleTabGitBlame = useCallback(
    (tabPath: string) => {
      if (tabPath === filePath) {
        gitBlame.toggle();
        return;
      }
      if (!onActivateTab) {
        return;
      }
      pendingGitBlamePathRef.current = tabPath;
      onActivateTab(tabPath);
    },
    [filePath, gitBlame, onActivateTab],
  );

  useEffect(() => {
    if (pendingGitBlamePathRef.current !== filePath || isLoading) {
      return;
    }
    pendingGitBlamePathRef.current = null;
    if (gitBlameEligible && !gitBlame.enabled) {
      gitBlame.toggle();
    }
  }, [filePath, gitBlame, gitBlameEligible, isLoading]);

  const openTabContextMenu = useCallback(
    (event: ReactMouseEvent, tabPath: string) => {
      event.preventDefault();
      event.stopPropagation();
      const gitScope = resolveTabGitScope(tabPath);
      const canOpenHistory = Boolean(gitScope && onOpenFileHistory);
      const canToggleBlame = Boolean(
        gitScope &&
        (tabPath === filePath
          ? gitBlameEligible || gitBlame.enabled
          : onActivateTab),
      );
      const gitItems: RendererContextMenuLeafItem[] = [
        ...(canOpenHistory
          ? [
              {
                type: "item" as const,
                id: "show-file-history",
                label: t("files.tabShowFileHistory"),
                icon: <History size={15} />,
                onSelect: () => {
                  if (!gitScope || !onOpenFileHistory) {
                    return;
                  }
                  onOpenFileHistory({
                    workspaceId,
                    workspacePath,
                    repositoryRoot: gitScope.repositoryRoot,
                    path: gitScope.path,
                    displayPath: tabPath,
                  });
                },
              },
            ]
          : []),
        ...(canToggleBlame
          ? [
              {
                type: "item" as const,
                id: "toggle-git-blame",
                label:
                  tabPath === filePath && gitBlame.enabled
                    ? t("files.gitBlameDisable")
                    : t("files.gitBlameEnable"),
                icon: <GitCommitHorizontal size={15} />,
                onSelect: () => handleTabGitBlame(tabPath),
              },
            ]
          : []),
      ];
      const items: RendererContextMenuItem[] = [
        ...(gitItems.length > 0
          ? [
              {
                type: "submenu" as const,
                id: "git-actions",
                label: t("files.tabGitActions"),
                icon: <GitBranch size={15} />,
                items: gitItems,
              },
              { type: "separator" as const, id: "tab-close-separator" },
            ]
          : []),
        {
          type: "item",
          id: "close-current-tab",
          label: t("files.closeCurrentTab"),
          icon: <X size={15} />,
          disabled: !onCloseTab,
          onSelect: () => onCloseTab?.(tabPath),
        },
        {
          type: "item",
          id: "close-other-tabs",
          label: t("files.closeOtherTabs"),
          icon: <CopyX size={15} />,
          disabled: !onCloseOtherTabs || visibleTabs.length <= 1,
          onSelect: () => onCloseOtherTabs?.(tabPath),
        },
        {
          type: "item",
          id: "close-all-tabs",
          label: t("files.closeAllTabs"),
          icon: <PanelTopClose size={15} />,
          disabled: !canCloseAllTabs,
          onSelect: () => onCloseAllTabs?.(),
        },
        { type: "separator", id: "tab-detach-separator" },
        {
          type: "item",
          id: "open-detached-tab",
          label: t("files.openDetachedTab"),
          icon: <ExternalLink size={15} />,
          onSelect: () => handleOpenDetachedTab(tabPath),
        },
      ];
      const position = clampRendererContextMenuPosition(
        event.clientX,
        event.clientY,
        {
          width: 248,
          height: estimateRendererContextMenuHeight(items),
          padding: 10,
        },
      );
      setTabContextMenu({
        ...position,
        label: t("files.tabContextMenu"),
        items,
      });
    },
    [
      canCloseAllTabs,
      filePath,
      gitBlame.enabled,
      gitBlameEligible,
      handleOpenDetachedTab,
      handleTabGitBlame,
      onActivateTab,
      onCloseAllTabs,
      onCloseOtherTabs,
      onCloseTab,
      onOpenFileHistory,
      resolveTabGitScope,
      t,
      visibleTabs.length,
      workspaceId,
      workspacePath,
    ],
  );

  useEffect(() => {
    return () => {
      splitResizeCleanupRef.current?.();
      splitResizeCleanupRef.current = null;
    };
  }, []);

  const handleFooterPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "button,a,input,textarea,select,[role='button'],[role='menuitem']",
        )
      ) {
        return;
      }
      const footer = event.currentTarget;
      const splitRoot = footer.closest(
        ".content.is-editor-split-vertical",
      ) as HTMLElement | null;
      if (!splitRoot) {
        return;
      }
      const editorLayer = splitRoot.querySelector(
        ".content-layer--editor",
      ) as HTMLElement | null;
      const chatLayer = splitRoot.querySelector(
        ".content-layer--editor-companion",
      ) as HTMLElement | null;
      if (!editorLayer || !chatLayer) {
        return;
      }
      const editorRect = editorLayer.getBoundingClientRect();
      const chatRect = chatLayer.getBoundingClientRect();
      const totalHeight = editorRect.height + chatRect.height;
      if (totalHeight <= 0) {
        return;
      }

      event.preventDefault();

      const startY = event.clientY;
      const startEditorHeight = editorRect.height;
      const minEditorHeight = Math.max(140, totalHeight * 0.28);
      const maxEditorHeight = Math.min(totalHeight - 120, totalHeight * 0.82);
      if (maxEditorHeight <= minEditorHeight) {
        return;
      }

      document.body.classList.add("editor-split-resizing");

      const cleanup = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        document.body.classList.remove("editor-split-resizing");
        splitResizeCleanupRef.current = null;
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaY = moveEvent.clientY - startY;
        const nextHeight = Math.min(
          maxEditorHeight,
          Math.max(minEditorHeight, startEditorHeight + deltaY),
        );
        const nextRatio = (nextHeight / totalHeight) * 100;
        splitRoot.style.setProperty(
          "--editor-split-ratio",
          nextRatio.toFixed(2),
        );
      };

      const handlePointerUp = () => {
        cleanup();
      };

      splitResizeCleanupRef.current?.();
      splitResizeCleanupRef.current = cleanup;
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [],
  );

  const renderExternalChangeNotice = () => {
    if (externalChangeSyncState === "in-sync") {
      return null;
    }
    if (externalPendingRefresh) {
      return (
        <div
          className="fvp-external-change-banner is-pending"
          role="status"
          aria-live="polite"
        >
          <div className="fvp-external-change-banner-copy">
            <strong>{t("files.externalChangePendingTitle")}</strong>
            <span>
              {t("files.externalChangePendingBody", {
                count: externalPendingRefresh.updateCount,
              })}
            </span>
          </div>
          <div className="fvp-external-change-banner-actions">
            <button
              type="button"
              className="ghost fvp-action-btn"
              onClick={handleExternalToggleCompare}
            >
              {externalCompareOpen
                ? t("files.externalChangeHideCompare")
                : t("files.externalChangeCompare")}
            </button>
            <button
              type="button"
              className="ghost fvp-action-btn"
              onClick={handleExternalKeepLocal}
            >
              {t("files.externalChangeKeepCurrent")}
            </button>
            <button
              type="button"
              className="primary fvp-action-btn"
              onClick={handleExternalApplyPendingRefresh}
            >
              {t("files.externalChangeRefreshPreview")}
            </button>
          </div>
        </div>
      );
    }
    if (
      externalChangeSyncState !== "external-changed-dirty" ||
      !externalChangeConflict
    ) {
      return (
        <div
          className="fvp-external-change-banner is-auto-sync"
          role="status"
          aria-live="polite"
        >
          {t("files.externalChangeAutoSynced")}
        </div>
      );
    }
    return (
      <div
        className="fvp-external-change-banner is-conflict"
        role="status"
        aria-live="polite"
      >
        <div className="fvp-external-change-banner-copy">
          <strong>{t("files.externalChangeConflictTitle")}</strong>
          <span>
            {t("files.externalChangeConflictBody", {
              count: externalChangeConflict.updateCount,
            })}
          </span>
        </div>
        <div className="fvp-external-change-banner-actions">
          <button
            type="button"
            className="ghost fvp-action-btn"
            onClick={handleExternalToggleCompare}
          >
            {externalCompareOpen
              ? t("files.externalChangeHideCompare")
              : t("files.externalChangeCompare")}
          </button>
          <button
            type="button"
            className="ghost fvp-action-btn"
            onClick={handleExternalKeepLocal}
          >
            {t("files.externalChangeKeepLocal")}
          </button>
          <button
            type="button"
            className="primary fvp-action-btn"
            onClick={handleExternalReloadFromDisk}
          >
            {t("files.externalChangeReload")}
          </button>
        </div>
      </div>
    );
  };

  const renderExternalComparePanel = () => {
    const diskSnapshot = externalChangeConflict ?? externalPendingRefresh;
    if (!externalCompareOpen || !diskSnapshot) {
      return null;
    }
    const latestLocalContent = editorDraftContentRef.current;
    const localPreview =
      latestLocalContent.length > 6_000
        ? `${latestLocalContent.slice(0, 6_000)}\n\n...`
        : latestLocalContent;
    const diskPreview =
      diskSnapshot.diskContent.length > 6_000
        ? `${diskSnapshot.diskContent.slice(0, 6_000)}\n\n...`
        : diskSnapshot.diskContent;
    return (
      <div className="fvp-external-compare">
        <div className="fvp-external-compare-column">
          <header>{t("files.externalChangeCompareLocal")}</header>
          <pre>{localPreview}</pre>
        </div>
        <div className="fvp-external-compare-column">
          <header>{t("files.externalChangeCompareDisk")}</header>
          <pre>{diskPreview}</pre>
        </div>
      </div>
    );
  };

  const renderTabs = (className?: string) => (
    <div
      ref={tabsContainerRef}
      className={`fvp-tabs${className ? ` ${className}` : ""}`}
      role="tablist"
      aria-label="Open files"
    >
      <div className="fvp-tabs-track">
        {visibleTabs.map((tabPath) => {
          const isActive = (activeTabPath ?? filePath) === tabPath;
          const tabName = tabPath.split("/").pop() || tabPath;
          const tabGitStatus =
            resolveMatchedGitStatusByPath(tabPath)?.status ?? null;
          const tabGitStatusClass = tabGitStatus
            ? `git-${tabGitStatus.toLowerCase()}`
            : "";
          const isDragging = draggingTabPath === tabPath;
          const isDragOver =
            Boolean(draggingTabPath) &&
            dragOverTabPath === tabPath &&
            draggingTabPath !== tabPath;
          return (
            <div
              key={tabPath}
              className={`fvp-tab ${isActive ? "is-active" : ""} ${
                isDragging ? "is-dragging" : ""
              } ${isDragOver ? "is-drag-over" : ""} ${tabGitStatusClass}`
                .replace(/\s+/g, " ")
                .trim()}
              role="presentation"
              data-tab-path={tabPath}
              data-tauri-drag-region={canReorderTabs ? "false" : undefined}
              onPointerDown={
                canReorderTabs
                  ? (event) => handleTabPointerDown(event, tabPath)
                  : undefined
              }
              onPointerMove={canReorderTabs ? handleTabPointerMove : undefined}
              onPointerUp={canReorderTabs ? handleTabPointerUp : undefined}
              onPointerCancel={canReorderTabs ? endTabDrag : undefined}
            >
              <button
                type="button"
                className="fvp-tab-main"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  if (suppressTabClickRef.current) {
                    suppressTabClickRef.current = false;
                    return;
                  }
                  onActivateTab?.(tabPath);
                }}
                onDoubleClick={() => onToggleEditorFileMaximized?.()}
                onContextMenu={(event) => openTabContextMenu(event, tabPath)}
                title={tabPath}
                data-tauri-drag-region="false"
              >
                <span className="fvp-tab-main-content">
                  <span
                    className="fvp-tab-icon"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{
                      __html: getFileTreeIconSvg(tabName, false),
                    }}
                  />
                  <span className="fvp-tab-main-label">{tabName}</span>
                </span>
              </button>
              <button
                type="button"
                className="fvp-tab-detach"
                aria-label={t("files.openDetachedTabFor", { name: tabName })}
                title={t("files.openDetachedTab")}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleOpenDetachedTab(tabPath);
                }}
                onContextMenu={(event) => openTabContextMenu(event, tabPath)}
                data-tauri-drag-region="false"
              >
                <ExternalLink size={11} aria-hidden />
              </button>
              {onCloseTab ? (
                <button
                  type="button"
                  className="fvp-tab-close"
                  aria-label={`Close ${tabName}`}
                  onClick={() => onCloseTab(tabPath)}
                  onContextMenu={(event) => openTabContextMenu(event, tabPath)}
                  data-tauri-drag-region="false"
                >
                  <X size={11} aria-hidden />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderHeader = () => (
    <div className="fvp-header-row">
      <button
        type="button"
        className="icon-button fvp-back"
        onClick={onSingleRowLeadingAction ?? handleClose}
        aria-label={singleRowLeadingLabel ?? t("files.backToChat")}
        title={singleRowLeadingLabel ?? t("files.backToChat")}
        data-tauri-drag-region="false"
      >
        {singleRowLeadingDirection === "right" && onSingleRowLeadingAction ? (
          <ArrowRight size={16} aria-hidden />
        ) : (
          <ArrowLeft size={16} aria-hidden />
        )}
      </button>
      <div className="fvp-header-row-tabs">{renderTabs("fvp-tabs-inline")}</div>
      <div className="fvp-header-row-right">
        {effectiveIsDirty ? (
          <span
            className="fvp-dirty-dot"
            aria-label={t("files.unsavedChanges")}
          />
        ) : null}
        {truncated ? (
          <span className="fvp-truncated">{t("files.truncated")}</span>
        ) : null}
      </div>
    </div>
  );

  // ── Content area ──
  const renderContent = () => (
    <FileViewBody
      workspaceId={workspaceId}
      filePath={filePath}
      sourceFilePath={absolutePath}
      documentKey={`${workspaceId}:${fileReadTarget.domain}:${workspaceRelativeFilePath}`}
      imageSrc={imageSrc}
      imageInfo={imageInfo}
      handleImageLoad={handleImageLoad}
      handleImageError={handleImageError}
      imageLoadError={imageLoadError}
      error={error}
      isLoading={isLoading}
      previewPayload={previewPayload}
      previewPayloadLoading={previewPayloadLoading}
      previewPayloadError={previewPayloadError}
      viewSurface={viewSurface}
      documentSnapshot={documentSnapshot}
      content={content}
      setContent={setContent}
      onEditorContentDraftChange={handleEditorContentDraftChange}
      onEditorContentPublished={handleEditorContentPublished}
      onEditorTypingInput={handleEditorTypingInput}
      fileRenderPressure={fileRenderPressure}
      markdownPreviewSnapshotMode={markdownPreviewSnapshotMode}
      markdownPreviewRefreshKey={externalAutoSyncAt}
      markdownPreviewContentOverride={markdownPreviewOverride?.content ?? null}
      markdownRendererProfile={markdownRendererProfile}
      markdownFastFeatureFlags={markdownFastFeatureFlags}
      cmRef={cmRef}
      onActiveFileLineRangeChange={handleEditorLineRangeChange}
      languageExtensions={languageExtensions}
      gitLineMarkers={effectiveGitLineMarkers}
      gitBlameEnabled={gitBlame.enabled}
      gitBlameStatus={gitBlame.status}
      gitBlameResponse={gitBlame.response}
      onFileContextMenu={openFileContextMenu}
      editorCodeAnnotations={editorCodeAnnotations}
      editorAnnotationDraft={editorAnnotationDraft}
      annotationWidgetLabels={annotationWidgetLabels}
      annotationWidgetCallbacks={annotationWidgetCallbacks}
      runDefinitionFromCursor={runDefinitionFromCursor}
      runReferencesFromCursor={runReferencesFromCursor}
      resolveDefinitionAtOffset={resolveDefinitionAtOffset}
      onPreviewAnnotationStart={(lineRange) =>
        beginAnnotationDraft(lineRange, "file-preview-mode")
      }
      annotationDraft={effectiveAnnotationDraft}
      codeAnnotations={visibleCodeAnnotations}
      onRemoveCodeAnnotation={onRemoveCodeAnnotation}
      onAnnotationDraftBodyChange={(body) => {
        annotationDraftBodyRef.current = body;
      }}
      onAnnotationDraftCancel={() => {
        annotationDraftBodyRef.current = "";
        setAnnotationDraft(null);
      }}
      onAnnotationDraftConfirm={handleConfirmAnnotationDraft}
      lastReportedLineRangeRef={lastReportedLineRangeRef}
      saveFileShortcut={saveFileShortcut}
      expandSelectionShortcut={expandSelectionShortcut}
      handleSave={handleSave}
      editorTheme={editorTheme}
      previewLanguage={previewLanguage}
      highlightedLines={highlightedLines}
      lines={lines}
      gitAddedLineNumberSet={gitAddedLineNumberSet}
      gitModifiedLineNumberSet={gitModifiedLineNumberSet}
      formatFileSize={formatFileSize}
      t={t}
    />
  );

  // ── Footer ──
  const renderFooter = () => (
    <div
      className="fvp-footer"
      onPointerDown={handleFooterPointerDown}
      title={t("layout.resizePlanPanel")}
    >
      <div className="fvp-footer-left">
        {canEditDocument && mode === "edit" && effectiveIsDirty && (
          <span className="fvp-footer-hint">
            <span className="fvp-dirty-dot" />
            {t("files.unsavedChanges")}
            <span className="fvp-footer-shortcut">
              {t("files.saveShortcut")}
            </span>
          </span>
        )}
        {canEditDocument && mode === "edit" && !effectiveIsDirty && (
          <span className="fvp-footer-hint fvp-footer-saved">
            {t("files.saved")}
          </span>
        )}
        {mode === "preview" && (truncated || !canEditDocument) && (
          <span className="fvp-footer-hint">{t("files.readOnly")}</span>
        )}
      </div>
      <div className="fvp-footer-right">
        {fileReferenceShouldRender ? (
          <div
            className={`fvp-file-reference-bar${fileReferenceVisible ? " is-visible" : ""}`}
            role="group"
            aria-label={t("composer.fileReference")}
          >
            <span className="fvp-file-reference-label">
              {t("composer.activeFile")}:
            </span>
            <code className="fvp-file-reference-path" title={filePath}>
              {filePath.split("/").pop() || filePath}
            </code>
            {activeFileLineLabel ? (
              <span className="fvp-file-reference-lines">
                {activeFileLineLabel}
              </span>
            ) : null}
            {viewSurface.kind === "editor" && activeAnnotationLineRange ? (
              <button
                type="button"
                className="fvp-annotation-trigger fvp-file-reference-annotation"
                onClick={handleStartEditorAnnotation}
              >
                {t("files.annotateForAi")}
              </button>
            ) : null}
          </div>
        ) : null}
        {mode === "preview" && onInsertText && content.trim().length > 0 && (
          <button
            type="button"
            className="ghost fvp-action-btn"
            onClick={() => {
              const fence = previewLanguage
                ? `\`\`\`${previewLanguage}`
                : "```";
              const snippet = `${filePath}\n${fence}\n${content}\n\`\`\``;
              onInsertText(snippet);
            }}
          >
            {t("files.addToChat")}
          </button>
        )}
        {!skipTextRead && !truncated ? (
          <button
            type="button"
            className="ghost fvp-action-btn fvp-find-toggle"
            aria-label={t("files.openFind")}
            title={t("files.openFind")}
            onClick={handleOpenFindPanel}
          >
            <FileSearch size={12} aria-hidden />
          </button>
        ) : null}
        {onToggleEditorFileMaximized ? (
          <button
            type="button"
            className="ghost fvp-action-btn fvp-maximize-toggle"
            aria-label={
              isEditorFileMaximized ? t("common.restore") : t("menu.maximize")
            }
            title={
              isEditorFileMaximized ? t("common.restore") : t("menu.maximize")
            }
            onClick={onToggleEditorFileMaximized}
          >
            {isEditorFileMaximized ? (
              <Minimize2 size={12} aria-hidden />
            ) : (
              <Maximize2 size={12} aria-hidden />
            )}
          </button>
        ) : null}
        {onToggleEditorSplitLayout ? (
          <button
            type="button"
            className={`ghost fvp-action-btn fvp-layout-toggle${
              editorSplitLayout === "horizontal" ? " is-side-by-side" : ""
            }`}
            aria-label={
              editorSplitLayout === "horizontal"
                ? t("files.switchToStackedSplit")
                : t("files.switchToSideBySideSplit")
            }
            title={
              editorSplitLayout === "horizontal"
                ? t("files.switchToStackedSplit")
                : t("files.switchToSideBySideSplit")
            }
            onClick={onToggleEditorSplitLayout}
          >
            {editorSplitLayout === "horizontal" ? (
              <Rows2 size={12} aria-hidden />
            ) : (
              <Columns2 size={12} aria-hidden />
            )}
          </button>
        ) : null}
        <OpenAppMenu
          path={absolutePath}
          openTargets={openTargets}
          selectedOpenAppId={selectedOpenAppId}
          onSelectOpenAppId={onSelectOpenAppId}
          iconById={openAppIconById}
        />
      </div>
    </div>
  );

  const renderNavigationPanel = () => (
    <FileViewNavigationPanel
      workspacePath={workspacePath}
      navigationError={navigationError}
      definitionCandidates={definitionCandidates}
      onCloseDefinitionCandidates={() => setDefinitionCandidates([])}
      implementationCandidates={implementationCandidates}
      onCloseImplementationCandidates={() => setImplementationCandidates([])}
      referenceResults={referenceResults}
      onCloseReferenceResults={() => setReferenceResults(null)}
      onNavigateToLocation={navigateToLocation}
      t={t}
    />
  );

  return (
    <div
      className={`fvp${usesSingleRowHeader ? " fvp-single-row-header" : ""}`}
      ref={panelRootRef}
    >
      {renderHeader()}
      {tabContextMenu ? (
        <RendererContextMenu
          menu={tabContextMenu}
          onClose={closeTabContextMenu}
          className="renderer-context-menu fvp-tab-context-menu"
        />
      ) : null}
      {fileContextMenu ? (
        <RendererContextMenu
          menu={fileContextMenu}
          onClose={() => setFileContextMenu(null)}
          className="renderer-context-menu fvp-tab-context-menu fvp-file-context-menu"
        />
      ) : null}
      {renderExternalChangeNotice()}
      {renderExternalComparePanel()}
      <div className="fvp-body" onContextMenu={openFileContextMenu}>
        {renderContent()}
      </div>
      {renderNavigationPanel()}
      {renderFooter()}
    </div>
  );
}
