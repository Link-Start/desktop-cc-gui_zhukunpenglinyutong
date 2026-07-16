import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import LayoutDashboard from "lucide-react/dist/esm/icons/layout-dashboard";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import FilePlus2 from "lucide-react/dist/esm/icons/file-plus-2";
import FolderPlus from "lucide-react/dist/esm/icons/folder-plus";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import type { GitRepositorySummary } from "../../../types";
import { gitRepositoryStatusTokens } from "../../git/utils/gitRepositorySummary";

type FileTreeRootActionsProps = {
  rootLabel: string;
  repositorySummary?: GitRepositorySummary | null;
  onCreateFile?: () => void;
  onCreateFolder?: () => void;
  onRefreshFiles?: () => void;
  isSpecHubActive?: boolean;
  onOpenDetachedExplorer?: (initialFilePath?: string | null) => void;
  detachedInitialFilePath?: string | null;
  onOpenSpecHub?: () => void;
  showDetachedExplorerAction?: boolean;
  showSpecHubAction?: boolean;
  onRootContextMenu?: (event: MouseEvent<HTMLElement>) => void;
};

export function FileTreeRootActions({
  rootLabel,
  repositorySummary = null,
  onCreateFile,
  onCreateFolder,
  onRefreshFiles,
  isSpecHubActive = false,
  onOpenDetachedExplorer,
  detachedInitialFilePath,
  onOpenSpecHub,
  showDetachedExplorerAction = false,
  showSpecHubAction = true,
  onRootContextMenu,
}: FileTreeRootActionsProps) {
  const { t } = useTranslation();
  const displayRootLabel = rootLabel.toUpperCase();
  const repositoryStatus = repositorySummary
    ? gitRepositoryStatusTokens(repositorySummary).join(" ")
    : "";
  const [spinningAction, setSpinningAction] = useState<string | null>(null);
  const spinTimerRef = useRef<number | null>(null);
  const spinRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (spinTimerRef.current !== null) {
        window.clearTimeout(spinTimerRef.current);
      }
      if (spinRafRef.current !== null) {
        window.cancelAnimationFrame(spinRafRef.current);
      }
    };
  }, []);

  const triggerActionWithSpin = useCallback((actionId: string, action: () => void) => {
    if (spinTimerRef.current !== null) {
      window.clearTimeout(spinTimerRef.current);
      spinTimerRef.current = null;
    }
    if (spinRafRef.current !== null) {
      window.cancelAnimationFrame(spinRafRef.current);
      spinRafRef.current = null;
    }

    // Reset first so repeated clicks on the same action can replay animation reliably.
    setSpinningAction(null);
    spinRafRef.current = window.requestAnimationFrame(() => {
      spinRafRef.current = null;
      setSpinningAction(actionId);
      spinTimerRef.current = window.setTimeout(() => {
        setSpinningAction((current) => (current === actionId ? null : current));
        spinTimerRef.current = null;
      }, 420);
    });

    try {
      action();
    } catch (error) {
      console.error("[file-tree-root-actions] action handler failed", error);
    }
  }, []);

  return (
    <>
      <div
        className={`file-tree-root-label${onRootContextMenu ? " has-context-menu" : ""}`}
        title={displayRootLabel}
        onContextMenu={onRootContextMenu}
      >
        <span>{displayRootLabel}</span>
        {repositorySummary ? (
          <span
            className="file-tree-root-git-summary"
            title={repositorySummary.error ?? repositorySummary.upstream ?? undefined}
          >
            {repositoryStatus}
          </span>
        ) : null}
      </div>
      <div className="file-tree-root-actions">
        <button
          type="button"
          className={`ghost icon-button file-tree-root-action${spinningAction === "new-file" ? " is-spinning" : ""}`}
          onClick={() => triggerActionWithSpin("new-file", () => onCreateFile?.())}
          disabled={!onCreateFile}
          aria-label={t("files.newFile")}
          title={t("files.newFile")}
        >
          <FilePlus2 aria-hidden />
        </button>
        <button
          type="button"
          className={`ghost icon-button file-tree-root-action${spinningAction === "new-folder" ? " is-spinning" : ""}`}
          onClick={() => triggerActionWithSpin("new-folder", () => onCreateFolder?.())}
          disabled={!onCreateFolder}
          aria-label={t("files.newFolder")}
          title={t("files.newFolder")}
        >
          <FolderPlus aria-hidden />
        </button>
        <button
          type="button"
          className={`ghost icon-button file-tree-root-action${spinningAction === "refresh" ? " is-spinning" : ""}`}
          onClick={() => triggerActionWithSpin("refresh", () => onRefreshFiles?.())}
          disabled={!onRefreshFiles}
          aria-label={t("files.refreshFiles")}
          title={t("files.refreshFiles")}
        >
          <RefreshCw aria-hidden />
        </button>
        {showDetachedExplorerAction ? (
          <button
            type="button"
            className={`ghost icon-button file-tree-root-action${spinningAction === "detached" ? " is-spinning" : ""}`}
            onClick={() =>
              triggerActionWithSpin("detached", () => onOpenDetachedExplorer?.(detachedInitialFilePath))
            }
            disabled={!onOpenDetachedExplorer}
            aria-label={t("files.openDetachedExplorer")}
            title={t("files.openDetachedExplorer")}
          >
            <ExternalLink aria-hidden />
          </button>
        ) : null}
        {showSpecHubAction ? (
          <button
            type="button"
            className={`ghost icon-button file-tree-root-action${isSpecHubActive ? " is-active" : ""}${spinningAction === "spec-hub" ? " is-spinning" : ""}`}
            onClick={() => triggerActionWithSpin("spec-hub", () => onOpenSpecHub?.())}
            disabled={!onOpenSpecHub}
            aria-label={t("sidebar.specHub")}
            title={t("sidebar.specHub")}
          >
            <LayoutDashboard aria-hidden />
          </button>
        ) : null}
      </div>
    </>
  );
}
