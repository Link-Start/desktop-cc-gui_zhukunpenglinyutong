import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { EditorView } from "@codemirror/view";
import type { FileCodeMirrorEditorHandle } from "../components/FileCodeMirrorEditor";
import {
  getCodeIntelDefinition,
  getCodeIntelImplementations,
  getCodeIntelReferences,
} from "../../../services/tauri";
import type { CodeNavigationResponse } from "../../../services/tauri/openCode";
import {
  isAbsoluteFsPath,
  normalizeFsPath,
  resolveWorkspaceRelativePath,
} from "../../../utils/workspacePaths";
import { lspPositionToEditorLocation, offsetToLspPosition } from "../utils/lspPosition";
import {
  areFileUrisEquivalent,
  CODE_INTEL_CACHE_TTL_MS,
  CODE_INTEL_REPEAT_DEBOUNCE_MS,
  extractLocations,
  makeLocationQueryKey,
  NAVIGATION_REQUEST_TIMEOUT_MS,
  readFreshCache,
  relativePathFromFileUri,
  resolveCodeNavigationErrorMessage,
  toFileUri,
  type CodeNavigationQueryStatus,
  type CodeNavigationResultSnapshot,
  type LocationCacheEntry,
  type LspLocationLike,
  type RecentTrigger,
  withTimeout,
} from "../utils/fileViewNavigationUtils";

function snapshotFromResponse(
  response: CodeNavigationResponse,
): CodeNavigationResultSnapshot {
  return {
    locations: extractLocations(response.result),
    mode: response.mode,
    provider: response.provider,
    language: response.language,
    fallbackReasonCode: response.fallbackReasonCode,
  };
}

function navigationLanguageFromPath(filePath: string) {
  const extension = filePath.split(".").pop()?.toLowerCase();
  if (extension === "java") {
    return "Java";
  }
  if (extension === "ts" || extension === "tsx") {
    return "TypeScript";
  }
  if (extension === "js" || extension === "jsx" || extension === "mjs" || extension === "cjs") {
    return "JavaScript";
  }
  if (extension === "rs") {
    return "Rust";
  }
  return null;
}

function loadingStatus(
  action: CodeNavigationQueryStatus["action"],
  filePath: string,
): CodeNavigationQueryStatus {
  return {
    action,
    phase: "loading",
    locations: [],
    mode: "fast-search",
    provider: "heuristic",
    language: navigationLanguageFromPath(filePath),
    fallbackReasonCode: null,
  };
}

function settledStatus(
  action: CodeNavigationQueryStatus["action"],
  snapshot: CodeNavigationResultSnapshot,
): CodeNavigationQueryStatus {
  return {
    action,
    phase: snapshot.mode === "semantic" ? "success" : "fallback",
    ...snapshot,
  };
}

function shouldPresentProviderRecovery(snapshot: CodeNavigationResultSnapshot) {
  return snapshot.fallbackReasonCode === "provider-unavailable";
}

type UseFileNavigationArgs = {
  workspaceId: string;
  workspacePath: string;
  filePath: string;
  absolutePath: string;
  caseInsensitivePathCompare: boolean;
  isSameWorkspacePath: (leftPath: string, rightPath: string) => boolean;
  navigationTarget: {
    path: string;
    line: number;
    endLine?: number;
    column: number;
    scrollPosition?: "nearest" | "center";
    requestId: number;
  } | null;
  isLoading: boolean;
  t: (key: string) => string;
  onNavigateToLocation?: (
    path: string,
    location: { line: number; column: number },
  ) => void;
  setMode: (mode: "edit") => void;
  cmRef: RefObject<FileCodeMirrorEditorHandle | null>;
};

export function useFileNavigation({
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
}: UseFileNavigationArgs) {
  const [isDefinitionLoading, setIsDefinitionLoading] = useState(false);
  const [isReferencesLoading, setIsReferencesLoading] = useState(false);
  const [isImplementationsLoading, setIsImplementationsLoading] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [definitionCandidates, setDefinitionCandidates] = useState<LspLocationLike[]>([]);
  const [referenceResults, setReferenceResults] = useState<LspLocationLike[] | null>(null);
  const [implementationCandidates, setImplementationCandidates] = useState<LspLocationLike[]>([]);
  const [navigationStatus, setNavigationStatus] =
    useState<CodeNavigationQueryStatus | null>(null);
  const lspRequestIdRef = useRef(0);
  const definitionCacheRef = useRef<Map<string, LocationCacheEntry>>(new Map());
  const referencesCacheRef = useRef<Map<string, LocationCacheEntry>>(new Map());
  const implementationsCacheRef = useRef<Map<string, LocationCacheEntry>>(new Map());
  const recentDefinitionTriggerRef = useRef<RecentTrigger | null>(null);
  const recentReferencesTriggerRef = useRef<RecentTrigger | null>(null);
  const recentImplementationsTriggerRef = useRef<RecentTrigger | null>(null);
  const appliedNavigationRequestRef = useRef(0);
  const navigationFocusTimerRef = useRef<number | null>(null);
  const navigationFlashTimerRef = useRef<number | null>(null);
  const currentFileUri = useMemo(() => toFileUri(absolutePath), [absolutePath]);

  const clearNavigationFocusTimer = useCallback(() => {
    if (navigationFocusTimerRef.current !== null) {
      window.clearTimeout(navigationFocusTimerRef.current);
      navigationFocusTimerRef.current = null;
    }
  }, []);

  const clearNavigationFlashTimer = useCallback(() => {
    if (navigationFlashTimerRef.current !== null) {
      window.clearTimeout(navigationFlashTimerRef.current);
      navigationFlashTimerRef.current = null;
    }
  }, []);

  const clearEditorNavigationFlash = useCallback(() => {
    clearNavigationFlashTimer();
    cmRef.current?.clearNavigationFlash();
  }, [clearNavigationFlashTimer, cmRef]);

  const flashEditorNavigationLine = useCallback((line: number) => {
    const view = cmRef.current?.view;
    if (!view || line < 1 || line > view.state.doc.lines) {
      return;
    }
    clearNavigationFlashTimer();
    const didFlash = cmRef.current?.flashNavigationLine(line) ?? false;
    if (!didFlash) {
      return;
    }
    navigationFlashTimerRef.current = window.setTimeout(() => {
      cmRef.current?.clearNavigationFlash();
      navigationFlashTimerRef.current = null;
    }, 2000);
  }, [clearNavigationFlashTimer, cmRef]);

  const focusEditorAtLocation = useCallback((
    line: number,
    column: number,
    scrollPosition: "nearest" | "center" = "nearest",
    endLine?: number,
  ) => {
    return cmRef.current?.focusLocation(line, column, scrollPosition, endLine) ?? false;
  }, [cmRef]);

  const focusEditorAtLocationWithRetry = useCallback(
    (
      line: number,
      column: number,
      scrollPosition: "nearest" | "center" = "nearest",
      endLine?: number,
      attempt = 0,
      onFocused?: () => void,
    ) => {
      const focused = focusEditorAtLocation(line, column, scrollPosition, endLine);
      if (focused && attempt >= 4) {
        clearNavigationFocusTimer();
        flashEditorNavigationLine(line);
        onFocused?.();
        return;
      }
      if (attempt >= 12) {
        clearNavigationFocusTimer();
        return;
      }
      clearNavigationFocusTimer();
      navigationFocusTimerRef.current = window.setTimeout(() => {
        focusEditorAtLocationWithRetry(
          line,
          column,
          scrollPosition,
          endLine,
          attempt + 1,
          onFocused,
        );
      }, 16);
    },
    [clearNavigationFocusTimer, flashEditorNavigationLine, focusEditorAtLocation],
  );

  const navigateToLocation = useCallback(
    (location: LspLocationLike) => {
      const relativePathFromUri = relativePathFromFileUri(location.uri, workspacePath);
      const relativePathFromLocation =
        typeof location.path === "string" && location.path.trim().length > 0
          ? resolveWorkspaceRelativePath(
              workspacePath,
              normalizeFsPath(location.path.trim()),
            )
          : null;
      const relativePath =
        relativePathFromLocation && !isAbsoluteFsPath(relativePathFromLocation)
          ? relativePathFromLocation
          : relativePathFromUri;
      const { line, column } = lspPositionToEditorLocation({
        line: location.line,
        character: location.character,
      });

      if (relativePath && onNavigateToLocation) {
        onNavigateToLocation(relativePath, { line, column });
        return;
      }

      const hitsCurrentFileByPath =
        (relativePath && isSameWorkspacePath(relativePath, filePath)) ||
        (relativePathFromUri && isSameWorkspacePath(relativePathFromUri, filePath));
      if (
        hitsCurrentFileByPath ||
        areFileUrisEquivalent(
          location.uri,
          currentFileUri,
          caseInsensitivePathCompare,
        )
      ) {
        setMode("edit");
        focusEditorAtLocationWithRetry(line, column);
      }
    },
    [
      caseInsensitivePathCompare,
      currentFileUri,
      filePath,
      focusEditorAtLocationWithRetry,
      isSameWorkspacePath,
      onNavigateToLocation,
      setMode,
      workspacePath,
    ],
  );

  const resolveDefinitionAtOffset = useCallback(
    async (offset: number, view?: EditorView) => {
      const editorView = view ?? cmRef.current?.view;
      if (!editorView) {
        return;
      }
      const position = offsetToLspPosition(editorView.state.doc, offset);
      const queryKey = makeLocationQueryKey(
        filePath,
        position.line,
        position.character,
      );
      const now = Date.now();
      const recentTrigger = recentDefinitionTriggerRef.current;
      if (
        recentTrigger &&
        recentTrigger.key === queryKey &&
        now - recentTrigger.at < CODE_INTEL_REPEAT_DEBOUNCE_MS
      ) {
        return;
      }
      recentDefinitionTriggerRef.current = { key: queryKey, at: now };
      const requestId = lspRequestIdRef.current + 1;
      lspRequestIdRef.current = requestId;
      setNavigationError(null);
      setDefinitionCandidates([]);
      const cachedLocations = readFreshCache(definitionCacheRef.current, queryKey);
      if (cachedLocations) {
        setNavigationStatus(settledStatus("definition", cachedLocations));
        setIsDefinitionLoading(false);
        if (cachedLocations.locations.length === 0) {
          setNavigationError(t("files.navigationNoDefinition"));
          return;
        }
        if (
          cachedLocations.locations.length === 1
          && !shouldPresentProviderRecovery(cachedLocations)
        ) {
          const onlyLocation = cachedLocations.locations[0];
          if (onlyLocation) {
            navigateToLocation(onlyLocation);
          }
          return;
        }
        setDefinitionCandidates(cachedLocations.locations);
        return;
      }
      setNavigationStatus(loadingStatus("definition", filePath));
      setIsDefinitionLoading(true);
      try {
        const response = await withTimeout(
          getCodeIntelDefinition(workspaceId, {
            filePath,
            line: position.line,
            character: position.character,
            documentText: editorView.state.doc.toString(),
          }),
          NAVIGATION_REQUEST_TIMEOUT_MS,
          t("files.navigationTimeout"),
        );
        if (requestId !== lspRequestIdRef.current) {
          return;
        }
        const snapshot = snapshotFromResponse(response);
        const locations = snapshot.locations;
        definitionCacheRef.current.set(queryKey, {
          expiresAt: Date.now() + CODE_INTEL_CACHE_TTL_MS,
          value: snapshot,
        });
        setNavigationStatus(settledStatus("definition", snapshot));
        if (locations.length === 0) {
          setNavigationError(t("files.navigationNoDefinition"));
          return;
        }
        if (locations.length === 1 && !shouldPresentProviderRecovery(snapshot)) {
          const onlyLocation = locations[0];
          if (onlyLocation) {
            navigateToLocation(onlyLocation);
          }
          return;
        }
        setDefinitionCandidates(locations);
      } catch (error) {
        if (requestId !== lspRequestIdRef.current) {
          return;
        }
        console.error("[file-navigation] definition query failed:", error);
        setNavigationError(resolveCodeNavigationErrorMessage(error, "definition", t));
        setNavigationStatus({ ...loadingStatus("definition", filePath), phase: "error" });
      } finally {
        if (requestId === lspRequestIdRef.current) {
          setIsDefinitionLoading(false);
        }
      }
    },
    [cmRef, filePath, navigateToLocation, t, workspaceId],
  );

  const findReferencesAtOffset = useCallback(
    async (offset: number) => {
      const editorView = cmRef.current?.view;
      if (!editorView) {
        return;
      }
      const position = offsetToLspPosition(editorView.state.doc, offset);
      const queryKey = makeLocationQueryKey(
        filePath,
        position.line,
        position.character,
        false,
      );
      const now = Date.now();
      const recentTrigger = recentReferencesTriggerRef.current;
      if (
        recentTrigger &&
        recentTrigger.key === queryKey &&
        now - recentTrigger.at < CODE_INTEL_REPEAT_DEBOUNCE_MS
      ) {
        return;
      }
      recentReferencesTriggerRef.current = { key: queryKey, at: now };
      const requestId = lspRequestIdRef.current + 1;
      lspRequestIdRef.current = requestId;
      setNavigationError(null);
      setReferenceResults(null);
      const cachedLocations = readFreshCache(referencesCacheRef.current, queryKey);
      if (cachedLocations) {
        setNavigationStatus(settledStatus("references", cachedLocations));
        setIsReferencesLoading(false);
        setReferenceResults(cachedLocations.locations);
        return;
      }
      setNavigationStatus(loadingStatus("references", filePath));
      setIsReferencesLoading(true);
      try {
        const response = await withTimeout(
          getCodeIntelReferences(workspaceId, {
            filePath,
            line: position.line,
            character: position.character,
            documentText: editorView.state.doc.toString(),
          }),
          NAVIGATION_REQUEST_TIMEOUT_MS,
          t("files.navigationTimeout"),
        );
        if (requestId !== lspRequestIdRef.current) {
          return;
        }
        const snapshot = snapshotFromResponse(response);
        const locations = snapshot.locations;
        referencesCacheRef.current.set(queryKey, {
          expiresAt: Date.now() + CODE_INTEL_CACHE_TTL_MS,
          value: snapshot,
        });
        setNavigationStatus(settledStatus("references", snapshot));
        setReferenceResults(locations);
      } catch (error) {
        if (requestId !== lspRequestIdRef.current) {
          return;
        }
        console.error("[file-navigation] references query failed:", error);
        setNavigationError(resolveCodeNavigationErrorMessage(error, "references", t));
        setNavigationStatus({ ...loadingStatus("references", filePath), phase: "error" });
      } finally {
        if (requestId === lspRequestIdRef.current) {
          setIsReferencesLoading(false);
        }
      }
    },
    [cmRef, filePath, t, workspaceId],
  );

  const runDefinitionFromCursor = useCallback(() => {
    const view = cmRef.current?.view;
    if (!view) {
      return;
    }
    void resolveDefinitionAtOffset(view.state.selection.main.head, view as unknown as EditorView);
  }, [cmRef, resolveDefinitionAtOffset]);

  const runReferencesFromCursor = useCallback(() => {
    const view = cmRef.current?.view;
    if (!view) {
      return;
    }
    void findReferencesAtOffset(view.state.selection.main.head);
  }, [cmRef, findReferencesAtOffset]);

  const findImplementationsAtOffset = useCallback(
    async (offset: number) => {
      const editorView = cmRef.current?.view;
      if (!editorView) {
        return;
      }
      const position = offsetToLspPosition(editorView.state.doc, offset);
      const queryKey = makeLocationQueryKey(filePath, position.line, position.character);
      const now = Date.now();
      const recentTrigger = recentImplementationsTriggerRef.current;
      if (
        recentTrigger
        && recentTrigger.key === queryKey
        && now - recentTrigger.at < CODE_INTEL_REPEAT_DEBOUNCE_MS
      ) {
        return;
      }
      recentImplementationsTriggerRef.current = { key: queryKey, at: now };
      const requestId = lspRequestIdRef.current + 1;
      lspRequestIdRef.current = requestId;
      setNavigationError(null);
      setImplementationCandidates([]);
      const cachedLocations = readFreshCache(
        implementationsCacheRef.current,
        queryKey,
      );
      if (cachedLocations) {
        setNavigationStatus(settledStatus("implementation", cachedLocations));
        setIsImplementationsLoading(false);
        if (cachedLocations.locations.length === 0) {
          setNavigationError(t("files.navigationNoImplementation"));
          return;
        }
        if (
          cachedLocations.locations.length === 1
          && !shouldPresentProviderRecovery(cachedLocations)
        ) {
          navigateToLocation(cachedLocations.locations[0]!);
          return;
        }
        setImplementationCandidates(cachedLocations.locations);
        return;
      }
      setNavigationStatus(loadingStatus("implementation", filePath));
      setIsImplementationsLoading(true);
      try {
        const response = await withTimeout(
          getCodeIntelImplementations(workspaceId, {
            filePath,
            line: position.line,
            character: position.character,
            documentText: editorView.state.doc.toString(),
          }),
          NAVIGATION_REQUEST_TIMEOUT_MS,
          t("files.navigationTimeout"),
        );
        if (requestId !== lspRequestIdRef.current) {
          return;
        }
        const snapshot = snapshotFromResponse(response);
        const locations = snapshot.locations;
        implementationsCacheRef.current.set(queryKey, {
          expiresAt: Date.now() + CODE_INTEL_CACHE_TTL_MS,
          value: snapshot,
        });
        setNavigationStatus(settledStatus("implementation", snapshot));
        if (locations.length === 0) {
          setNavigationError(t("files.navigationNoImplementation"));
          return;
        }
        if (locations.length === 1 && !shouldPresentProviderRecovery(snapshot)) {
          navigateToLocation(locations[0]!);
          return;
        }
        setImplementationCandidates(locations);
      } catch (error) {
        if (requestId !== lspRequestIdRef.current) {
          return;
        }
        console.error("[file-navigation] implementation query failed:", error);
        setNavigationError(resolveCodeNavigationErrorMessage(error, "implementation", t));
        setNavigationStatus({ ...loadingStatus("implementation", filePath), phase: "error" });
      } finally {
        if (requestId === lspRequestIdRef.current) {
          setIsImplementationsLoading(false);
        }
      }
    },
    [cmRef, filePath, navigateToLocation, t, workspaceId],
  );

  const runImplementationsFromCursor = useCallback(() => {
    const view = cmRef.current?.view;
    if (!view) {
      return;
    }
    void findImplementationsAtOffset(view.state.selection.main.head);
  }, [cmRef, findImplementationsAtOffset]);

  useEffect(() => {
    lspRequestIdRef.current += 1;
    recentDefinitionTriggerRef.current = null;
    recentReferencesTriggerRef.current = null;
    recentImplementationsTriggerRef.current = null;
    setIsDefinitionLoading(false);
    setIsReferencesLoading(false);
    setIsImplementationsLoading(false);
    setNavigationError(null);
    setDefinitionCandidates([]);
    setReferenceResults(null);
    setImplementationCandidates([]);
    setNavigationStatus(null);
  }, [filePath]);

  useEffect(() => {
    clearNavigationFocusTimer();
    clearEditorNavigationFlash();
    return () => {
      clearNavigationFocusTimer();
      clearEditorNavigationFlash();
    };
  }, [clearEditorNavigationFlash, clearNavigationFocusTimer, filePath]);

  useEffect(() => {
    if (!navigationTarget) {
      return;
    }
    if (!isSameWorkspacePath(navigationTarget.path, filePath)) {
      return;
    }
    if (navigationTarget.requestId === appliedNavigationRequestRef.current) {
      return;
    }
    if (isLoading) {
      return;
    }
    setMode("edit");
    focusEditorAtLocationWithRetry(
      navigationTarget.line,
      navigationTarget.column,
      navigationTarget.scrollPosition,
      navigationTarget.endLine,
      0,
      () => {
        appliedNavigationRequestRef.current = navigationTarget.requestId;
      },
    );
  }, [
    filePath,
    focusEditorAtLocationWithRetry,
    isLoading,
    isSameWorkspacePath,
    navigationTarget,
    setMode,
  ]);

  const openFindPanelInEditor = useCallback(() => {
    return cmRef.current?.openFindPanel() ?? false;
  }, [cmRef]);

  const toggleFindPanelInEditor = useCallback(() => {
    return cmRef.current?.toggleFindPanel() ?? false;
  }, [cmRef]);

  const retryNavigation = useCallback(() => {
    switch (navigationStatus?.action) {
      case "definition":
        recentDefinitionTriggerRef.current = null;
        definitionCacheRef.current.clear();
        runDefinitionFromCursor();
        break;
      case "references":
        recentReferencesTriggerRef.current = null;
        referencesCacheRef.current.clear();
        runReferencesFromCursor();
        break;
      case "implementation":
        recentImplementationsTriggerRef.current = null;
        implementationsCacheRef.current.clear();
        runImplementationsFromCursor();
        break;
    }
  }, [
    navigationStatus?.action,
    runDefinitionFromCursor,
    runImplementationsFromCursor,
    runReferencesFromCursor,
  ]);

  return {
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
    navigationStatus,
    retryNavigation,
    resolveDefinitionAtOffset,
    openFindPanelInEditor,
    toggleFindPanelInEditor,
  };
}
