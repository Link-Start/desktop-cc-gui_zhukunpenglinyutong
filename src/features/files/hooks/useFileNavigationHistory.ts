import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { FileCodeMirrorEditorHandle } from "../components/FileCodeMirrorEditor";
import { lspPositionToEditorLocation, offsetToLspPosition } from "../utils/lspPosition";

type FileNavigationLocation = {
  path: string;
  line: number;
  column: number;
  scrollTop: number;
};

type NavigationTargetLocation = Omit<FileNavigationLocation, "scrollTop">;

type FileNavigationHistoryState = {
  entries: FileNavigationLocation[];
  index: number;
};

type UseFileNavigationHistoryArgs = {
  workspaceId: string;
  filePath: string;
  isSameWorkspacePath: (leftPath: string, rightPath: string) => boolean;
  onNavigateToLocation?: (
    path: string,
    location: { line: number; column: number },
  ) => void;
  cmRef: RefObject<FileCodeMirrorEditorHandle | null>;
};

const EMPTY_NAVIGATION_HISTORY: FileNavigationHistoryState = {
  entries: [],
  index: -1,
};

export function useFileNavigationHistory({
  workspaceId,
  filePath,
  isSameWorkspacePath,
  onNavigateToLocation,
  cmRef,
}: UseFileNavigationHistoryArgs) {
  const [history, setHistory] =
    useState<FileNavigationHistoryState>(EMPTY_NAVIGATION_HISTORY);
  const historyRef = useRef<FileNavigationHistoryState>(EMPTY_NAVIGATION_HISTORY);
  const expectedFilePathRef = useRef<string | null>(null);
  const pendingViewportRestoreRef = useRef<FileNavigationLocation | null>(null);
  const viewportRestoreFrameRef = useRef<number | null>(null);
  const currentFilePathRef = useRef(filePath);
  const currentWorkspaceIdRef = useRef(workspaceId);

  const publishHistory = useCallback((nextHistory: FileNavigationHistoryState) => {
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }, []);

  const cancelViewportRestore = useCallback(() => {
    if (viewportRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(viewportRestoreFrameRef.current);
      viewportRestoreFrameRef.current = null;
    }
    pendingViewportRestoreRef.current = null;
  }, []);

  const clearHistory = useCallback(() => {
    expectedFilePathRef.current = null;
    cancelViewportRestore();
    if (historyRef.current.index >= 0) {
      publishHistory(EMPTY_NAVIGATION_HISTORY);
    }
  }, [cancelViewportRestore, publishHistory]);

  const captureCurrentLocation = useCallback((): FileNavigationLocation | null => {
    const editorView = cmRef.current?.view;
    if (!editorView) {
      return null;
    }
    const position = offsetToLspPosition(
      editorView.state.doc,
      editorView.state.selection.main.head,
    );
    return {
      path: filePath,
      ...lspPositionToEditorLocation(position),
      scrollTop: editorView.scrollDOM.scrollTop,
    };
  }, [cmRef, filePath]);

  const recordCrossFileNavigation = useCallback(
    (target: NavigationTargetLocation) => {
      const source = captureCurrentLocation();
      if (!source) {
        return;
      }
      const currentHistory = historyRef.current;
      const currentEntry = currentHistory.entries[currentHistory.index];
      const entries = currentEntry && isSameWorkspacePath(currentEntry.path, source.path)
        ? [
            ...currentHistory.entries.slice(0, currentHistory.index),
            source,
            { ...target, scrollTop: 0 },
          ]
        : [source, { ...target, scrollTop: 0 }];
      cancelViewportRestore();
      expectedFilePathRef.current = target.path;
      publishHistory({ entries, index: entries.length - 1 });
    },
    [cancelViewportRestore, captureCurrentLocation, isSameWorkspacePath, publishHistory],
  );

  const navigateHistoryBy = useCallback(
    (offset: -1 | 1) => {
      const currentHistory = historyRef.current;
      const nextIndex = currentHistory.index + offset;
      const destination = currentHistory.entries[nextIndex];
      if (!destination || !onNavigateToLocation) {
        return;
      }
      const currentEntry = currentHistory.entries[currentHistory.index];
      const currentSnapshot = captureCurrentLocation();
      const entries = currentSnapshot
        && currentEntry
        && isSameWorkspacePath(currentEntry.path, currentSnapshot.path)
        ? currentHistory.entries.map((entry, index) =>
            index === currentHistory.index ? currentSnapshot : entry)
        : currentHistory.entries;
      cancelViewportRestore();
      expectedFilePathRef.current = destination.path;
      pendingViewportRestoreRef.current = destination;
      publishHistory({ entries, index: nextIndex });
      onNavigateToLocation(destination.path, {
        line: destination.line,
        column: destination.column,
      });
    },
    [
      cancelViewportRestore,
      captureCurrentLocation,
      isSameWorkspacePath,
      onNavigateToLocation,
      publishHistory,
    ],
  );

  const restoreHistoryViewport = useCallback(
    (path: string, line: number, column: number) => {
      const pendingRestore = pendingViewportRestoreRef.current;
      if (
        !pendingRestore
        || !isSameWorkspacePath(pendingRestore.path, path)
        || pendingRestore.line !== line
        || pendingRestore.column !== column
      ) {
        return;
      }
      pendingViewportRestoreRef.current = null;
      if (viewportRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(viewportRestoreFrameRef.current);
      }
      viewportRestoreFrameRef.current = window.requestAnimationFrame(() => {
        viewportRestoreFrameRef.current = null;
        if (!isSameWorkspacePath(currentFilePathRef.current, path)) {
          return;
        }
        const editorView = cmRef.current?.view;
        if (editorView) {
          editorView.scrollDOM.scrollTop = pendingRestore.scrollTop;
        }
      });
    },
    [cmRef, isSameWorkspacePath],
  );

  const navigateBack = useCallback(() => {
    navigateHistoryBy(-1);
  }, [navigateHistoryBy]);

  const navigateForward = useCallback(() => {
    navigateHistoryBy(1);
  }, [navigateHistoryBy]);

  useEffect(() => {
    const workspaceChanged = currentWorkspaceIdRef.current !== workspaceId;
    const fileChanged = !isSameWorkspacePath(currentFilePathRef.current, filePath);
    currentWorkspaceIdRef.current = workspaceId;
    currentFilePathRef.current = filePath;
    if (!workspaceChanged && !fileChanged) {
      return;
    }
    if (
      !workspaceChanged
      && expectedFilePathRef.current
      && isSameWorkspacePath(expectedFilePathRef.current, filePath)
    ) {
      expectedFilePathRef.current = null;
      return;
    }
    clearHistory();
  }, [clearHistory, filePath, isSameWorkspacePath, workspaceId]);

  useEffect(() => cancelViewportRestore, [cancelViewportRestore]);

  return {
    recordCrossFileNavigation,
    canNavigateBack: Boolean(onNavigateToLocation && history.index > 0),
    canNavigateForward: Boolean(
      onNavigateToLocation
      && history.index >= 0
      && history.index < history.entries.length - 1,
    ),
    navigateBack,
    navigateForward,
    restoreHistoryViewport,
  };
}
