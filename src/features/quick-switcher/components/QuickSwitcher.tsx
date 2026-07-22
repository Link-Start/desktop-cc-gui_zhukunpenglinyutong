import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import Bot from "lucide-react/dist/esm/icons/bot";
import Columns3 from "lucide-react/dist/esm/icons/columns-3";
import FileClock from "lucide-react/dist/esm/icons/file-clock";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";
import GitCompareArrows from "lucide-react/dist/esm/icons/git-compare-arrows";
import History from "lucide-react/dist/esm/icons/history";
import MapIcon from "lucide-react/dist/esm/icons/map";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import MessagesSquare from "lucide-react/dist/esm/icons/messages-square";
import PanelsTopLeft from "lucide-react/dist/esm/icons/panels-top-left";
import Settings2 from "lucide-react/dist/esm/icons/settings-2";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import TerminalSquare from "lucide-react/dist/esm/icons/terminal-square";
import { FileIcon } from "../../../components/FileIcon";
import { loadQuickSwitcherStyles } from "../../../styles/featureStyleLoaders";
import { useFeatureStylesReady } from "../../../styles/useFeatureStylesReady";
import { formatRelativeTimeShort } from "../../../utils/time";
import { formatShortcutForPlatform } from "../../../utils/shortcuts";
import { EngineIcon } from "../../engine/components/EngineIcon";
import { SharedSessionIcon } from "../../shared-session/components/SharedSessionIcon";
import { useQuickSwitcherRecentFiles } from "../hooks/useQuickSwitcherRecentFiles";
import type {
  QuickSwitcherNavigationId,
  QuickSwitcherSessionGroup,
} from "../types";

const NAVIGATION_ITEMS: QuickSwitcherNavigationId[] = [
  "chat",
  "files",
  "git",
  "history",
  "kanban",
  "spec",
  "intentCanvas",
  "projectMap",
  "terminal",
  "settings",
];

const NAVIGATION_ICONS = {
  chat: MessageSquare,
  files: FolderOpen,
  git: GitCompareArrows,
  history: History,
  kanban: Columns3,
  spec: Bot,
  intentCanvas: PanelsTopLeft,
  projectMap: MapIcon,
  terminal: TerminalSquare,
  settings: Settings2,
} satisfies Record<QuickSwitcherNavigationId, typeof MessageSquare>;

type QuickSwitcherPane = "navigation" | "sessions" | "files";

type QuickSwitcherProps = {
  workspaces: Array<{ id: string; name: string }>;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  activeFilePath?: string | null;
  sessionGroups: QuickSwitcherSessionGroup[];
  onNavigate: (target: QuickSwitcherNavigationId) => void;
  onSelectSession: (workspaceId: string, threadId: string) => void;
  onSelectFile: (workspaceId: string, path: string) => void;
  onClose: () => void;
};

function splitFilePath(path: string) {
  const separator = path.lastIndexOf("/");
  return separator < 0
    ? { name: path, parent: "" }
    : { name: path.slice(separator + 1), parent: path.slice(0, separator) };
}

export function QuickSwitcher({
  workspaces,
  activeWorkspaceId,
  activeThreadId,
  activeFilePath,
  sessionGroups,
  onNavigate,
  onSelectSession,
  onSelectFile,
  onClose,
}: QuickSwitcherProps) {
  const stylesReady = useFeatureStylesReady(loadQuickSwitcherStyles, true);
  const { t } = useTranslation();
  const fileGroups = useQuickSwitcherRecentFiles(workspaces);
  const sessions = useMemo(
    () => sessionGroups.flatMap((group) => group.sessions),
    [sessionGroups],
  );
  const files = useMemo(
    () => fileGroups.flatMap((group) => group.files),
    [fileGroups],
  );
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const activeFileIndex = files.findIndex(
    (file) =>
      file.workspaceId === activeWorkspaceId && file.path === activeFilePath,
  );
  const activeSessionIndex = sessions.findIndex(
    (session) =>
      session.workspaceId === activeWorkspaceId && session.id === activeThreadId,
  );
  const [activePane, setActivePane] = useState<QuickSwitcherPane>(() =>
    activeFileIndex >= 0 ? "files" : sessions.length ? "sessions" : "navigation",
  );
  const [navigationIndex, setNavigationIndex] = useState(0);
  const [sessionIndex, setSessionIndex] = useState(() =>
    activeSessionIndex >= 0 && activeSessionIndex + 1 < sessions.length
      ? activeSessionIndex + 1
      : Math.max(0, activeSessionIndex),
  );
  const [fileIndex, setFileIndex] = useState(() =>
    activeFileIndex >= 0 && activeFileIndex + 1 < files.length
      ? activeFileIndex + 1
      : Math.max(0, activeFileIndex),
  );

  const sessionIndexes = useMemo(
    () =>
      new Map(
        sessions.map((session, index) => [
          `${session.workspaceId}:${session.id}`,
          index,
        ]),
      ),
    [sessions],
  );
  const fileIndexes = useMemo(
    () =>
      new Map(
        files.map((file, index) => [
          `${file.workspaceId}:${file.path}`,
          index,
        ]),
      ),
    [files],
  );

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    setSessionIndex((current) =>
      Math.min(current, Math.max(0, sessions.length - 1)),
    );
  }, [sessions.length]);

  useEffect(() => {
    setFileIndex((current) => Math.min(current, Math.max(0, files.length - 1)));
  }, [files.length]);

  useEffect(() => {
    const selectedRow = dialogRef.current?.querySelector<HTMLElement>(
      ".quick-switcher-row.is-selected",
    );
    selectedRow?.scrollIntoView?.({ block: "nearest" });
  }, [activePane, fileIndex, navigationIndex, sessionIndex]);

  const movePane = (direction: -1 | 1) => {
    const panes: QuickSwitcherPane[] = ["navigation", "sessions", "files"];
    const currentIndex = panes.indexOf(activePane);
    setActivePane(panes[(currentIndex + direction + panes.length) % panes.length]!);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      movePane(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      if (activePane === "navigation") {
        setNavigationIndex(
          (current) =>
            (current + delta + NAVIGATION_ITEMS.length) % NAVIGATION_ITEMS.length,
        );
      } else if (activePane === "sessions" && sessions.length) {
        setSessionIndex(
          (current) => (current + delta + sessions.length) % sessions.length,
        );
      } else if (activePane === "files" && files.length) {
        setFileIndex((current) => (current + delta + files.length) % files.length);
      }
      return;
    }
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (activePane === "navigation") {
      onNavigate(NAVIGATION_ITEMS[navigationIndex] ?? "chat");
    } else if (activePane === "sessions") {
      const session = sessions[sessionIndex];
      if (session) onSelectSession(session.workspaceId, session.id);
    } else {
      const file = files[fileIndex];
      if (file) onSelectFile(file.workspaceId, file.path);
    }
  };

  if (!stylesReady) {
    return null;
  }

  return (
    <div
      className="quick-switcher-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="quick-switcher"
        role="dialog"
        aria-modal="true"
        aria-label={t("quickSwitcher.title")}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="quick-switcher-header">
          <h2>{t("quickSwitcher.title")}</h2>
          <kbd>{formatShortcutForPlatform("cmd+e")}</kbd>
        </header>

        <div className="quick-switcher-body">
          <nav
            className={`quick-switcher-navigation${
              activePane === "navigation" ? " is-active-pane" : ""
            }`}
            aria-label={t("quickSwitcher.navigation")}
          >
            <div className="quick-switcher-section-label">
              {t("quickSwitcher.navigation")}
            </div>
            {NAVIGATION_ITEMS.map((item, index) => {
              const Icon = NAVIGATION_ICONS[item];
              const selected = activePane === "navigation" && navigationIndex === index;
              return (
                <button
                  key={item}
                  type="button"
                  className={`quick-switcher-row${selected ? " is-selected" : ""}`}
                  onMouseEnter={() => {
                    setActivePane("navigation");
                    setNavigationIndex(index);
                  }}
                  onClick={() => onNavigate(item)}
                >
                  <Icon size={15} aria-hidden strokeWidth={1.7} />
                  <span>{t(`quickSwitcher.nav.${item}`)}</span>
                </button>
              );
            })}
          </nav>

          <section
            className={`quick-switcher-recent-pane${
              activePane === "sessions" ? " is-active-pane" : ""
            }`}
            aria-label={t("quickSwitcher.recentSessions")}
          >
            <div className="quick-switcher-section-label quick-switcher-pane-heading">
              <span className="quick-switcher-section-title">
                <MessagesSquare size={13} aria-hidden />
                {t("quickSwitcher.recentSessions")}
              </span>
              <span>{sessions.length}</span>
            </div>
            <div className="quick-switcher-pane-scroll scrollable">
              {sessionGroups.length ? (
                sessionGroups.map((group) => (
                  <div className="quick-switcher-workspace-group" key={group.workspaceId}>
                    <div className="quick-switcher-workspace-heading">
                      <FolderOpen size={11} aria-hidden />
                      <span>{group.workspaceName}</span>
                      <small>{group.sessions.length}</small>
                    </div>
                    {group.sessions.map((session) => {
                      const index =
                        sessionIndexes.get(`${session.workspaceId}:${session.id}`) ?? 0;
                      const selected = activePane === "sessions" && sessionIndex === index;
                      const active =
                        session.workspaceId === activeWorkspaceId &&
                        session.id === activeThreadId;
                      return (
                        <button
                          key={session.id}
                          type="button"
                          className={`quick-switcher-row quick-switcher-recent-row${
                            selected ? " is-selected" : ""
                          }${active ? " is-current" : ""}`}
                          onMouseEnter={() => {
                            setActivePane("sessions");
                            setSessionIndex(index);
                          }}
                          onClick={() => onSelectSession(session.workspaceId, session.id)}
                        >
                          <span className="quick-switcher-leading-icon">
                            {session.isShared ? (
                              <SharedSessionIcon size={16} />
                            ) : (
                              <EngineIcon engine={session.engine} size={16} />
                            )}
                          </span>
                          <span className="quick-switcher-primary">{session.title}</span>
                          <time>{formatRelativeTimeShort(session.updatedAt)}</time>
                        </button>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div className="quick-switcher-empty">
                  {t("quickSwitcher.emptySessions")}
                </div>
              )}
            </div>
          </section>

          <section
            className={`quick-switcher-recent-pane${
              activePane === "files" ? " is-active-pane" : ""
            }`}
            aria-label={t("quickSwitcher.recentFiles")}
          >
            <div className="quick-switcher-section-label quick-switcher-pane-heading">
              <span className="quick-switcher-section-title">
                <FileClock size={13} aria-hidden />
                {t("quickSwitcher.recentFiles")}
              </span>
              <span>{files.length}</span>
            </div>
            <div className="quick-switcher-pane-scroll scrollable">
              {fileGroups.length ? (
                fileGroups.map((group) => (
                  <div className="quick-switcher-workspace-group" key={group.workspaceId}>
                    <div className="quick-switcher-workspace-heading">
                      <FolderOpen size={11} aria-hidden />
                      <span>{group.workspaceName}</span>
                      <small>{group.files.length}</small>
                    </div>
                    {group.files.map((file) => {
                      const index = fileIndexes.get(`${file.workspaceId}:${file.path}`) ?? 0;
                      const selected = activePane === "files" && fileIndex === index;
                      const active =
                        file.workspaceId === activeWorkspaceId &&
                        file.path === activeFilePath;
                      const pathParts = splitFilePath(file.path);
                      return (
                        <button
                          key={file.path}
                          type="button"
                          className={`quick-switcher-row quick-switcher-recent-row${
                            selected ? " is-selected" : ""
                          }${active ? " is-current" : ""}`}
                          onMouseEnter={() => {
                            setActivePane("files");
                            setFileIndex(index);
                          }}
                          onClick={() => onSelectFile(file.workspaceId, file.path)}
                        >
                          <FileIcon filePath={file.path} size={16} />
                          <span className="quick-switcher-primary quick-switcher-file-label">
                            <span>{pathParts.name}</span>
                            {pathParts.parent ? <small>{pathParts.parent}</small> : null}
                          </span>
                          {file.aiModifiedAt ? (
                            <span className="quick-switcher-ai-badge" title={t("quickSwitcher.aiModified")}>
                              <Sparkles size={9} aria-hidden />
                            </span>
                          ) : null}
                          <time>{formatRelativeTimeShort(file.touchedAt)}</time>
                        </button>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div className="quick-switcher-empty">
                  {t("quickSwitcher.emptyFiles")}
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="quick-switcher-footer">
          <span><kbd>←</kbd><kbd>→</kbd> {t("quickSwitcher.switchPaneHint")}</span>
          <span><kbd>↑</kbd><kbd>↓</kbd> {t("quickSwitcher.keyboardHint")}</span>
          <span><kbd>↵</kbd> {t("quickSwitcher.openHint")}</span>
          <span><kbd>esc</kbd> {t("quickSwitcher.closeHint")}</span>
        </footer>
      </div>
    </div>
  );
}
