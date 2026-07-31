import Brain from "lucide-react/dist/esm/icons/brain";
import CircleCheck from "lucide-react/dist/esm/icons/circle-check";
import GitCommitHorizontal from "lucide-react/dist/esm/icons/git-commit-horizontal";
import LayoutDashboard from "lucide-react/dist/esm/icons/layout-dashboard";
import Lock from "lucide-react/dist/esm/icons/lock";
import Settings from "lucide-react/dist/esm/icons/settings";
import type { RefObject } from "react";
import type { AppMode } from "../../../types";

type SidebarSettingsMenuProps = {
  isOpen: boolean;
  appMode: AppMode;
  menuRef: RefObject<HTMLDivElement | null>;
  buttonRef: RefObject<HTMLButtonElement | null>;
  t: (key: string) => string;
  onToggleOpen: () => void;
  onClose: () => void;
  onLockPanel?: () => void;
  onOpenSpecHub: () => void;
  onOpenProjectMemory: () => void;
  onOpenSettings: () => void;
  onAppModeChange: (mode: AppMode) => void;
  /** 打开侧栏运行时提示面板（入口已收入设置二级菜单，不再外显） */
  onOpenRuntimeNotice?: () => void;
  /** 是否展示运行时提示菜单项（受 clientUiVisibility 控制） */
  showRuntimeNotice?: boolean;
};

export function SidebarSettingsMenu({
  isOpen,
  appMode,
  menuRef,
  buttonRef,
  t,
  onToggleOpen,
  onClose,
  onLockPanel,
  onOpenSpecHub,
  onOpenProjectMemory,
  onOpenSettings,
  onAppModeChange,
  onOpenRuntimeNotice,
  showRuntimeNotice = false,
}: SidebarSettingsMenuProps) {
  return (
    <div className="sidebar-settings-dropdown-wrapper">
      {isOpen && (
        <div
          className="sidebar-settings-dropdown"
          ref={menuRef}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="sidebar-settings-dropdown-item"
            onClick={() => {
              onClose();
              onLockPanel?.();
            }}
          >
            <Lock size={14} aria-hidden />
            <span>{t("lockScreen.lock")}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="sidebar-settings-dropdown-item"
            onClick={() => {
              onClose();
              onOpenSpecHub();
            }}
          >
            <LayoutDashboard size={14} aria-hidden />
            <span>{t("sidebar.specHub")}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="sidebar-settings-dropdown-item"
            onClick={() => {
              onClose();
              onOpenProjectMemory();
            }}
          >
            <Brain size={14} aria-hidden />
            <span>{t("panels.memory")}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={`sidebar-settings-dropdown-item${appMode === "gitHistory" ? " is-active" : ""}`}
            onClick={() => {
              onClose();
              onAppModeChange(appMode === "gitHistory" ? "chat" : "gitHistory");
            }}
          >
            <GitCommitHorizontal size={14} aria-hidden />
            <span>{t("git.historyQuickAction")}</span>
          </button>
          {showRuntimeNotice && onOpenRuntimeNotice ? (
            <button
              type="button"
              role="menuitem"
              className="sidebar-settings-dropdown-item"
              onClick={() => {
                onClose();
                onOpenRuntimeNotice();
              }}
            >
              <CircleCheck size={14} aria-hidden />
              <span>{t("runtimeNotice.title")}</span>
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="sidebar-settings-dropdown-item"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
          >
            <Settings size={14} aria-hidden />
            <span>{t("settings.title")}</span>
          </button>
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        className={`sidebar-primary-nav-item sidebar-primary-nav-item-bottom${isOpen ? " is-active" : ""}`}
        onClick={onToggleOpen}
        title={t("settings.title")}
        aria-label={t("settings.title")}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        data-tauri-drag-region="false"
      >
        <Settings className="sidebar-primary-nav-icon" aria-hidden />
      </button>
    </div>
  );
}
