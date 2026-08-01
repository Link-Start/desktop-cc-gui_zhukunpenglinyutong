import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";
import RotateCw from "lucide-react/dist/esm/icons/rotate-cw";
import X from "lucide-react/dist/esm/icons/x";
import { getGitCommitDiff, getGitCommitHistory } from "../../../services/tauri";
import type { GitCommitDiff, GitHistoryCommit } from "../../../types";
import { formatRelativeTime } from "../../../utils/time";
import { loadFileHistoryStyles } from "../../../styles/featureStyleLoaders";
import { GitDiffViewer } from "../../git/components/GitDiffViewer";
import { WorkspaceReadOnlyDiffCompare } from "../../git/components/WorkspaceReadOnlyDiffCompare";
import type { FileHistoryTarget } from "../types";

const HISTORY_PAGE_SIZE = 100;

// ponytail: outer splitter math stays local to FileHistoryView; the reusable
// compare splitter belongs to WorkspaceReadOnlyDiffCompare.
const FILE_HISTORY_SPLITTER_SIZE = 8;
const COMMIT_RAIL_DEFAULT_PX = 300;
const COMMIT_RAIL_MIN_PX = 200;
const COMMIT_RAIL_MAX_RATIO = 0.6;
const COMPARE_DIFF_MIN_WIDTH = 240;
const COMMIT_RAIL_KEYBOARD_STEP_PX = 20;

type FileHistoryViewProps = {
  target: FileHistoryTarget;
  onClose: () => void;
  showHeader?: boolean;
};

function targetKey(target: FileHistoryTarget): string {
  return [target.workspaceId, target.repositoryRoot, target.path].join("\u001f");
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function FileHistoryView({ target, onClose, showHeader = true }: FileHistoryViewProps) {
  const { t } = useTranslation();
  const [commits, setCommits] = useState<GitHistoryCommit[]>([]);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<GitCommitDiff[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffRetryRevision, setDiffRetryRevision] = useState(0);
  const historyGenerationRef = useRef(0);
  const diffGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeTargetKey = targetKey(target);

  const workbenchRef = useRef<HTMLDivElement | null>(null);
  const commitRailResizerRef = useRef<HTMLDivElement | null>(null);
  const commitRailWidthRef = useRef(COMMIT_RAIL_DEFAULT_PX);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    void loadFileHistoryStyles();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadFirstPage = useCallback(() => {
    const generation = ++historyGenerationRef.current;
    ++diffGenerationRef.current;
    setCommits([]);
    setSnapshotId(null);
    setHasMore(false);
    setTotal(0);
    setSelectedSha(null);
    setDiffs([]);
    setHistoryError(null);
    setDiffError(null);
    setHistoryLoading(true);
    setDiffLoading(false);

    void getGitCommitHistory(target.workspaceId, {
      path: target.path,
      repositoryRoot: target.repositoryRoot,
      limit: HISTORY_PAGE_SIZE,
    }).then(
      (response) => {
        if (!mountedRef.current || historyGenerationRef.current !== generation) return;
        setCommits(response.commits);
        setSnapshotId(response.snapshotId);
        setHasMore(response.hasMore);
        setTotal(response.total);
        setSelectedSha(response.commits[0]?.sha ?? null);
        setHistoryLoading(false);
      },
      (error: unknown) => {
        if (!mountedRef.current || historyGenerationRef.current !== generation) return;
        setHistoryError(error instanceof Error ? error.message : String(error));
        setHistoryLoading(false);
      },
    );
  }, [target.path, target.repositoryRoot, target.workspaceId]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const loadNextPage = useCallback(() => {
    if (!hasMore || historyLoading || historyLoadingMore || !snapshotId) return;
    const generation = historyGenerationRef.current;
    setHistoryLoadingMore(true);
    setHistoryError(null);
    void getGitCommitHistory(target.workspaceId, {
      path: target.path,
      repositoryRoot: target.repositoryRoot,
      snapshotId,
      offset: commits.length,
      limit: HISTORY_PAGE_SIZE,
    }).then(
      (response) => {
        if (!mountedRef.current || historyGenerationRef.current !== generation) return;
        setCommits((current) => {
          const known = new Set(current.map((commit) => commit.sha));
          return [...current, ...response.commits.filter((commit) => !known.has(commit.sha))];
        });
        setHasMore(response.hasMore);
        setTotal(response.total);
        setHistoryLoadingMore(false);
      },
      (error: unknown) => {
        if (!mountedRef.current || historyGenerationRef.current !== generation) return;
        setHistoryError(error instanceof Error ? error.message : String(error));
        setHistoryLoadingMore(false);
      },
    );
  }, [commits.length, hasMore, historyLoading, historyLoadingMore, snapshotId, target]);

  const selectedCommit = useMemo(
    () => commits.find((commit) => commit.sha === selectedSha) ?? null,
    [commits, selectedSha],
  );
  const selectedFilePath = selectedCommit?.filePath ?? target.path;
  useEffect(() => {
    if (!selectedSha) {
      setDiffs([]);
      setDiffError(null);
      setDiffLoading(false);
      return;
    }
    const generation = ++diffGenerationRef.current;
    setDiffs([]);
    setDiffError(null);
    setDiffLoading(true);
    void getGitCommitDiff(target.workspaceId, selectedSha, {
      path: selectedFilePath,
      repositoryRoot: target.repositoryRoot,
    }).then(
      (response) => {
        if (!mountedRef.current || diffGenerationRef.current !== generation) return;
        const scoped = response.filter((entry) => entry.path === selectedFilePath);
        setDiffs(scoped);
        setDiffLoading(false);
      },
      (error: unknown) => {
        if (!mountedRef.current || diffGenerationRef.current !== generation) return;
        setDiffError(error instanceof Error ? error.message : String(error));
        setDiffLoading(false);
      },
    );
  }, [
    activeTargetKey,
    diffRetryRevision,
    selectedFilePath,
    selectedSha,
    target.repositoryRoot,
    target.workspaceId,
  ]);

  const virtualizer = useVirtualizer({
    count: commits.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const lastVirtualIndex = virtualRows.at(-1)?.index ?? -1;
  useEffect(() => {
    if (!historyError && lastVirtualIndex >= commits.length - 8) loadNextPage();
  }, [commits.length, historyError, lastVirtualIndex, loadNextPage]);

  const selectedDiff = useMemo(
    () => diffs.find((entry) => entry.path === selectedFilePath) ?? null,
    [diffs, selectedFilePath],
  );

  const applyCommitRailWidth = useCallback((width: number) => {
    const normalizedWidth = Math.round(width);
    commitRailWidthRef.current = normalizedWidth;
    workbenchRef.current?.style.setProperty(
      "--file-history-commit-rail-width",
      `${normalizedWidth}px`,
    );
    commitRailResizerRef.current?.setAttribute("aria-valuenow", String(normalizedWidth));
  }, []);

  const resetCommitRailWidth = useCallback(() => {
    applyCommitRailWidth(COMMIT_RAIL_DEFAULT_PX);
  }, [applyCommitRailWidth]);

  useEffect(() => {
    resizeCleanupRef.current?.();
    resetCommitRailWidth();
  }, [activeTargetKey, resetCommitRailWidth]);

  useEffect(
    () => () => {
      resizeCleanupRef.current?.();
    },
    [],
  );

  const handleCommitRailResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const host = workbenchRef.current;
      if (!host) return;
      const hostWidth = host.getBoundingClientRect().width;
      if (hostWidth <= 0) return;

      event.preventDefault();
      resizeCleanupRef.current?.();

      const startX = event.clientX;
      const startWidth = commitRailWidthRef.current;
      const maxCommitWidth = Math.max(
        COMMIT_RAIL_MIN_PX,
        hostWidth - FILE_HISTORY_SPLITTER_SIZE - COMPARE_DIFF_MIN_WIDTH,
      );
      const upperBound = Math.min(maxCommitWidth, hostWidth * COMMIT_RAIL_MAX_RATIO);
      commitRailResizerRef.current?.setAttribute(
        "aria-valuemax",
        String(Math.round(upperBound)),
      );
      const previousBodyStyles = {
        cursor: document.body.style.cursor,
        userSelect: document.body.style.userSelect,
        webkitUserSelect: document.body.style.webkitUserSelect,
      };
      let pendingWidth = startWidth;
      let animationFrame: number | null = null;

      const flushWidth = () => {
        animationFrame = null;
        applyCommitRailWidth(pendingWidth);
      };
      const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
        pendingWidth = clamp(
          startWidth + moveEvent.clientX - startX,
          COMMIT_RAIL_MIN_PX,
          upperBound,
        );
        if (animationFrame === null) {
          animationFrame = window.requestAnimationFrame(flushWidth);
        }
      };
      const cleanup = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", cleanup);
        if (animationFrame !== null) {
          window.cancelAnimationFrame(animationFrame);
          flushWidth();
        }
        document.body.style.cursor = previousBodyStyles.cursor;
        document.body.style.userSelect = previousBodyStyles.userSelect;
        document.body.style.webkitUserSelect = previousBodyStyles.webkitUserSelect;
        delete document.body.dataset.fileHistoryColumnResizing;
        resizeCleanupRef.current = null;
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      document.body.dataset.fileHistoryColumnResizing = "true";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", cleanup);
      resizeCleanupRef.current = cleanup;
    },
    [applyCommitRailWidth],
  );

  const handleCommitRailResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const hostWidth = workbenchRef.current?.getBoundingClientRect().width ?? 0;
      if (hostWidth <= 0) return;
      const upperBound = Math.min(
        Math.max(
          COMMIT_RAIL_MIN_PX,
          hostWidth - FILE_HISTORY_SPLITTER_SIZE - COMPARE_DIFF_MIN_WIDTH,
        ),
        hostWidth * COMMIT_RAIL_MAX_RATIO,
      );
      commitRailResizerRef.current?.setAttribute(
        "aria-valuemax",
        String(Math.round(upperBound)),
      );
      const direction =
        event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      if (direction === 0 && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      if (event.key === "Home") {
        applyCommitRailWidth(COMMIT_RAIL_MIN_PX);
      } else if (event.key === "End") {
        applyCommitRailWidth(upperBound);
      } else {
        applyCommitRailWidth(
          clamp(
            commitRailWidthRef.current + direction * COMMIT_RAIL_KEYBOARD_STEP_PX,
            COMMIT_RAIL_MIN_PX,
            upperBound,
          ),
        );
      }
    },
    [applyCommitRailWidth],
  );

  return (
    <section className="file-history-view" aria-label={t("git.fileHistoryTitle")}>
      {showHeader ? (
        <header className="file-history-header">
          <div className="file-history-heading">
            <strong>{t("git.fileHistoryTitle")}</strong>
            <span title={target.displayPath}>{target.displayPath}</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("git.fileHistoryClose")}>
            <X size={16} aria-hidden="true" />
          </button>
        </header>
      ) : null}
      <div className="file-history-workbench" ref={workbenchRef}>
        <aside className="file-history-commits" aria-label={t("git.historyCommits")}>
          <div className="file-history-list-summary">
            {t("git.historyCommitCount", { count: total })}
          </div>
          {historyLoading ? (
            <div className="file-history-state"><LoaderCircle className="spin" size={18} />{t("git.fileHistoryLoading")}</div>
          ) : historyError && commits.length === 0 ? (
            <div className="file-history-state is-error" role="alert">
              <span>{historyError}</span>
              <button type="button" onClick={loadFirstPage}><RotateCw size={14} />{t("git.fileHistoryRetry")}</button>
            </div>
          ) : commits.length === 0 ? (
            <div className="file-history-state">{t("git.fileHistoryEmpty")}</div>
          ) : (
            <div ref={listRef} className="file-history-list" data-testid="file-history-list">
              <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                {virtualRows.map((row) => {
                  const commit = commits[row.index];
                  return (
                    <button
                      type="button"
                      key={commit.sha}
                      data-index={row.index}
                      ref={virtualizer.measureElement}
                      className={`file-history-commit${commit.sha === selectedSha ? " is-selected" : ""}`}
                      style={{ position: "absolute", transform: `translateY(${row.start}px)`, width: "100%" }}
                      onClick={() => setSelectedSha(commit.sha)}
                    >
                      <span className="file-history-commit-summary">{commit.summary || commit.shortSha}</span>
                      <span className="file-history-commit-meta">{commit.author} · {formatRelativeTime(commit.timestamp * 1000)}</span>
                      <code>{commit.shortSha}</code>
                    </button>
                  );
                })}
              </div>
              {historyLoadingMore ? <div className="file-history-loading-more"><LoaderCircle className="spin" size={14} />{t("git.fileHistoryLoadingMore")}</div> : null}
              {historyError ? <button type="button" className="file-history-load-retry" onClick={loadNextPage}>{historyError} · {t("git.fileHistoryRetry")}</button> : null}
            </div>
          )}
        </aside>
        <div
          ref={commitRailResizerRef}
          className="file-history-vertical-resizer"
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-valuemin={COMMIT_RAIL_MIN_PX}
          aria-valuemax={Math.round(COMMIT_RAIL_DEFAULT_PX / COMMIT_RAIL_MAX_RATIO)}
          aria-valuenow={COMMIT_RAIL_DEFAULT_PX}
          aria-label={t("git.historyResizeCommitsAndDiff")}
          onMouseDown={handleCommitRailResizeStart}
          onKeyDown={handleCommitRailResizeKeyDown}
          onDoubleClick={resetCommitRailWidth}
          data-testid="file-history-commit-resizer"
        />
        <main className="file-history-diff">
          {selectedCommit ? <div className="file-history-diff-title">{selectedCommit.summary || selectedCommit.shortSha}</div> : null}
          {diffError ? (
            <div className="file-history-state is-error" role="alert">
              <span>{diffError}</span>
              <button type="button" onClick={() => setDiffRetryRevision((current) => current + 1)}>{t("git.fileHistoryRetry")}</button>
            </div>
          ) : diffLoading ? (
            <div className="file-history-state"><LoaderCircle className="spin" size={18} />{t("git.refreshingDiff")}</div>
          ) : selectedDiff?.isImage ? (
            <GitDiffViewer
              workspaceId={target.workspaceId}
              diffs={[selectedDiff]}
              selectedPath={selectedDiff.path}
              isLoading={false}
              error={null}
              showContentModeControls={false}
              showAllContentControl={false}
              onRequestClose={null}
            />
          ) : selectedDiff?.diff.trim() ? (
            <WorkspaceReadOnlyDiffCompare
              filePath={selectedFilePath}
              diff={selectedDiff.diff}
              resizableColumns
            />
          ) : selectedDiff?.isBinary ? (
            <div className="file-history-state">{t("git.binaryFile")}</div>
          ) : (
            <div className="file-history-state">{t("git.diffUnavailable")}</div>
          )}
        </main>
      </div>
    </section>
  );
}
