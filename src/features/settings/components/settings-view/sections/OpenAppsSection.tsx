import { useEffect, useMemo, useRef, useState } from "react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Plus from "lucide-react/dist/esm/icons/plus";
import Star from "lucide-react/dist/esm/icons/star";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OpenAppTarget } from "@/types";
import { useOpenAppIcons } from "../../../../app/hooks/useOpenAppIcons";
import {
  GENERIC_APP_ICON,
  getKnownOpenAppIcon,
} from "../../../../app/utils/openAppIcons";
import type { OpenAppDraft } from "../actions/settingsViewActions";

type OpenAppsSectionProps = {
  active: boolean;
  t: (key: string) => string;
  openAppDrafts: OpenAppDraft[];
  openAppIconById: Record<string, string>;
  openAppSelectedId: string;
  handleOpenAppDraftChange: (index: number, patch: Partial<OpenAppDraft>) => void;
  handleCommitOpenApps: (drafts: OpenAppDraft[]) => Promise<void>;
  handleOpenAppKindChange: (index: number, kind: OpenAppTarget["kind"]) => void;
  handleSelectOpenAppDefault: (id: string) => void;
  handleMoveOpenApp: (index: number, direction: "up" | "down") => void;
  handleDeleteOpenApp: (index: number) => void;
  handleAddOpenApp: () => void;
};

function kindLabel(
  t: (key: string) => string,
  kind: OpenAppTarget["kind"],
): string {
  if (kind === "app") return t("settings.typeApp");
  if (kind === "command") return t("settings.typeCommand");
  return t("settings.typeFinder");
}

function targetSubtitle(
  t: (key: string) => string,
  target: OpenAppDraft,
): string {
  const kind = kindLabel(t, target.kind);
  if (target.kind === "app") {
    const name = target.appName?.trim();
    return name ? `${kind} · ${name}` : kind;
  }
  if (target.kind === "command") {
    const command = target.command?.trim();
    return command ? `${kind} · ${command}` : kind;
  }
  return kind;
}

export function OpenAppsSection({
  active,
  t,
  openAppDrafts,
  openAppIconById,
  openAppSelectedId,
  handleOpenAppDraftChange,
  handleCommitOpenApps,
  handleOpenAppKindChange,
  handleSelectOpenAppDefault,
  handleMoveOpenApp,
  handleDeleteOpenApp,
  handleAddOpenApp,
}: OpenAppsSectionProps) {
  const lazyIconById = useOpenAppIcons(openAppDrafts, { enabled: active });
  const [editingId, setEditingId] = useState<string | null>(null);
  const prevCountRef = useRef(openAppDrafts.length);

  // Newly added app opens the editor dialog.
  useEffect(() => {
    if (openAppDrafts.length > prevCountRef.current) {
      const last = openAppDrafts[openAppDrafts.length - 1];
      if (last) {
        setEditingId(last.id);
      }
    }
    prevCountRef.current = openAppDrafts.length;
  }, [openAppDrafts]);

  const editingIndex = useMemo(
    () => openAppDrafts.findIndex((item) => item.id === editingId),
    [editingId, openAppDrafts],
  );
  const editingTarget =
    editingIndex >= 0 ? openAppDrafts[editingIndex] : null;

  const editingIconSrc = editingTarget
    ? getKnownOpenAppIcon(editingTarget.id) ??
      lazyIconById[editingTarget.id] ??
      openAppIconById[editingTarget.id] ??
      GENERIC_APP_ICON
    : GENERIC_APP_ICON;

  const closeEditor = () => {
    setEditingId(null);
    void handleCommitOpenApps(openAppDrafts);
  };

  if (!active) {
    return null;
  }

  return (
    <div className="settings-basic-open-apps settings-basic-surface">
      <div className="settings-basic-group-card settings-pref-card settings-open-apps-card">
        <div className="settings-pref-card-head">
          <div className="settings-pref-title">{t("settings.openInTitle")}</div>
          <div className="settings-pref-desc">
            {t("settings.openInDescription")}
          </div>
        </div>

        <div className="settings-open-apps-list" role="list">
          {openAppDrafts.map((target, index) => {
            const iconSrc =
              getKnownOpenAppIcon(target.id) ??
              lazyIconById[target.id] ??
              openAppIconById[target.id] ??
              GENERIC_APP_ICON;
            const isDefault = target.id === openAppSelectedId;
            const displayName =
              target.label.trim() || t("settings.label") || "App";

            return (
              <div
                key={target.id}
                className={`settings-open-app-item${isDefault ? " is-default" : ""}`}
                role="listitem"
              >
                <div className="settings-open-app-summary">
                  <button
                    type="button"
                    className="settings-open-app-summary-main"
                    onClick={() => setEditingId(target.id)}
                    aria-haspopup="dialog"
                    aria-label={displayName}
                  >
                    <span className="settings-open-app-icon-wrap" aria-hidden>
                      <img
                        className="settings-open-app-icon"
                        src={iconSrc}
                        alt=""
                        width={20}
                        height={20}
                      />
                    </span>
                    <span className="settings-open-app-summary-text">
                      <span className="settings-open-app-summary-title">
                        {displayName}
                      </span>
                      <span className="settings-open-app-summary-sub">
                        {targetSubtitle(t, target)}
                      </span>
                    </span>
                    <span className="settings-open-app-edit-hint" aria-hidden>
                      <Pencil size={13} />
                    </span>
                  </button>

                  <div className="settings-open-app-summary-actions">
                    {isDefault ? (
                      <span className="settings-open-app-default-badge">
                        <Star size={12} aria-hidden />
                        {t("settings.defaultRadio")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="settings-open-app-default-btn"
                        onClick={() => handleSelectOpenAppDefault(target.id)}
                      >
                        {t("settings.defaultRadio")}
                      </button>
                    )}
                    <div className="settings-open-app-icon-actions">
                      <button
                        type="button"
                        className="settings-open-app-icon-btn"
                        onClick={() => handleMoveOpenApp(index, "up")}
                        disabled={index === 0}
                        aria-label={t("settings.moveUp")}
                      >
                        <ChevronUp size={15} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="settings-open-app-icon-btn"
                        onClick={() => handleMoveOpenApp(index, "down")}
                        disabled={index === openAppDrafts.length - 1}
                        aria-label={t("settings.moveDown")}
                      >
                        <ChevronDown size={15} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="settings-open-app-icon-btn settings-open-app-icon-btn--danger"
                        onClick={() => {
                          if (editingId === target.id) {
                            setEditingId(null);
                          }
                          handleDeleteOpenApp(index);
                        }}
                        disabled={openAppDrafts.length <= 1}
                        aria-label={t("settings.removeAppAriaLabel")}
                        title={t("settings.removeApp")}
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="settings-open-app-footer">
          <button
            type="button"
            className="settings-open-app-add-btn"
            onClick={handleAddOpenApp}
          >
            <Plus size={15} aria-hidden />
            {t("settings.addApp")}
          </button>
          <div className="settings-pref-desc settings-open-app-help">
            {t("settings.openInHelp")}
          </div>
        </div>
      </div>

      <Dialog
        open={editingTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            closeEditor();
          }
        }}
      >
        {editingTarget && editingIndex >= 0 ? (
          <DialogContent
            className="settings-open-app-dialog"
            showCloseButton
          >
            <DialogHeader className="settings-open-app-dialog-header">
              <div className="settings-open-app-dialog-brand">
                <span className="settings-open-app-icon-wrap" aria-hidden>
                  <img
                    className="settings-open-app-icon"
                    src={editingIconSrc}
                    alt=""
                    width={20}
                    height={20}
                  />
                </span>
                <div className="settings-open-app-dialog-titles">
                  <DialogTitle>
                    {editingTarget.label.trim() ||
                      t("settings.editOpenAppTitle")}
                  </DialogTitle>
                  <DialogDescription>
                    {t("settings.editOpenAppDesc")}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="settings-open-app-dialog-body">
              <label className="settings-open-app-dialog-field">
                <span className="settings-open-app-dialog-label">
                  {t("settings.label")}
                </span>
                <input
                  className="settings-open-app-dialog-input"
                  value={editingTarget.label}
                  placeholder={t("settings.label")}
                  onChange={(event) =>
                    handleOpenAppDraftChange(editingIndex, {
                      label: event.target.value,
                    })
                  }
                  aria-label={`Open app label ${editingIndex + 1}`}
                  autoFocus
                />
              </label>

              <div className="settings-open-app-dialog-field">
                <span className="settings-open-app-dialog-label">
                  {t("settings.type")}
                </span>
                <div
                  className="settings-open-app-dialog-kind"
                  role="radiogroup"
                  aria-label={`Open app type ${editingIndex + 1}`}
                >
                  {(
                    [
                      ["app", t("settings.typeApp")],
                      ["command", t("settings.typeCommand")],
                      ["finder", t("settings.typeFinder")],
                    ] as const
                  ).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      role="radio"
                      aria-checked={editingTarget.kind === kind}
                      className={`settings-open-app-dialog-kind-option${
                        editingTarget.kind === kind ? " is-active" : ""
                      }`}
                      onClick={() =>
                        handleOpenAppKindChange(editingIndex, kind)
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {editingTarget.kind === "app" ? (
                <label className="settings-open-app-dialog-field">
                  <span className="settings-open-app-dialog-label">
                    {t("settings.appName")}
                  </span>
                  <input
                    className="settings-open-app-dialog-input"
                    value={editingTarget.appName ?? ""}
                    placeholder={t("settings.appName")}
                    onChange={(event) =>
                      handleOpenAppDraftChange(editingIndex, {
                        appName: event.target.value,
                      })
                    }
                    aria-label={`Open app name ${editingIndex + 1}`}
                  />
                </label>
              ) : null}

              {editingTarget.kind === "command" ? (
                <label className="settings-open-app-dialog-field">
                  <span className="settings-open-app-dialog-label">
                    {t("settings.command")}
                  </span>
                  <input
                    className="settings-open-app-dialog-input"
                    value={editingTarget.command ?? ""}
                    placeholder={t("settings.command")}
                    onChange={(event) =>
                      handleOpenAppDraftChange(editingIndex, {
                        command: event.target.value,
                      })
                    }
                    aria-label={`Open app command ${editingIndex + 1}`}
                  />
                </label>
              ) : null}

              {editingTarget.kind !== "finder" ? (
                <label className="settings-open-app-dialog-field">
                  <span className="settings-open-app-dialog-label">
                    {t("settings.args")}
                  </span>
                  <input
                    className="settings-open-app-dialog-input"
                    value={editingTarget.argsText}
                    placeholder={t("settings.args")}
                    onChange={(event) =>
                      handleOpenAppDraftChange(editingIndex, {
                        argsText: event.target.value,
                      })
                    }
                    aria-label={`Open app args ${editingIndex + 1}`}
                  />
                  <span className="settings-open-app-dialog-hint">
                    {t("settings.openInHelp")}
                  </span>
                </label>
              ) : null}
            </div>

            <DialogFooter className="settings-open-app-dialog-footer">
              {editingTarget.id !== openAppSelectedId ? (
                <button
                  type="button"
                  className="settings-open-app-dialog-secondary"
                  onClick={() => handleSelectOpenAppDefault(editingTarget.id)}
                >
                  <Star size={14} aria-hidden />
                  {t("settings.defaultRadio")}
                </button>
              ) : (
                <span className="settings-open-app-dialog-default-note">
                  <Star size={13} aria-hidden />
                  {t("settings.defaultRadio")}
                </span>
              )}
              <button
                type="button"
                className="settings-open-app-dialog-primary"
                onClick={closeEditor}
              >
                {t("settings.openAppDone")}
              </button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
