import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { convertFileSrc } from "@tauri-apps/api/core";
import Archive from "lucide-react/dist/esm/icons/archive";
import ImagePlus from "lucide-react/dist/esm/icons/image-plus";
import MessageSquarePlus from "lucide-react/dist/esm/icons/message-square-plus";
import MoreHorizontal from "lucide-react/dist/esm/icons/more-horizontal";
import NotebookPen from "lucide-react/dist/esm/icons/notebook-pen";
import Plus from "lucide-react/dist/esm/icons/plus";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Save from "lucide-react/dist/esm/icons/save";
import Search from "lucide-react/dist/esm/icons/search";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Undo2 from "lucide-react/dist/esm/icons/undo-2";
import X from "lucide-react/dist/esm/icons/x";
import { confirm } from "@tauri-apps/plugin-dialog";
import { ImagePreviewOverlay } from "../../../components/common/ImagePreviewOverlay";
import { LocalImage } from "../../../components/common/LocalImage";
import { RichTextInput } from "../../../components/common/RichTextInput/RichTextInput";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { isWindowsPlatform } from "../../../utils/platform";
import { Markdown } from "../../messages/components/Markdown";
import { pickImageFiles, type WorkspaceNoteCard, type WorkspaceNoteCardSummary } from "../../../services/tauri";
import { pushErrorToast } from "../../../services/toasts";
import { noteCardsFacade } from "../services/noteCardsFacade";

type WorkspaceNoteCardPanelProps = {
  workspaceId: string | null;
  workspaceName?: string | null;
  workspacePath?: string | null;
  focusNoteId?: string | null;
  focusRequestKey?: number;
  onReferenceNote?: (note: WorkspaceNoteCard) => void;
};

type NoteCardCollection = "active" | "archive";
type NoteCardImagePreview = {
  src: string;
  localPath: string;
  fileName: string;
};

function attachmentPreviewSrc(path: string) {
  if (path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
}

function deriveProjectName(
  workspaceId?: string | null,
  workspaceName?: string | null,
  workspacePath?: string | null,
) {
  const rawCandidate = (() => {
    const normalizedPath = workspacePath?.trim().replace(/\\/g, "/") ?? "";
    if (normalizedPath) {
      const segments = normalizedPath.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment) {
        return lastSegment;
      }
    }
    return workspaceName?.trim() || workspaceId?.trim() || "workspace";
  })();

  const sanitized = Array.from(rawCandidate)
    .map((character) => (/^[a-z0-9]$/i.test(character) ? character.toLowerCase() : "-"))
    .join("");
  const collapsed = sanitized.split("-").filter(Boolean).join("-");
  return collapsed || "workspace";
}

function buildNoteCardStorageHintPath(projectName: string) {
  if (isWindowsPlatform()) {
    return `%USERPROFILE%\\.ccgui\\note_card\\${projectName}\\active | archive`;
  }
  return `~/.ccgui/note_card/${projectName}/active | archive`;
}

function areStringArraysEqual(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

type NoteCardDeleteMenuProps = {
  triggerLabel: string;
  deleteLabel: string;
  onDelete: () => void;
  iconSize?: number;
  triggerClassName?: string;
};

function NoteCardDeleteMenu({
  triggerLabel,
  deleteLabel,
  onDelete,
  iconSize = 13,
  triggerClassName = "ghost workspace-note-cards-icon-action",
}: NoteCardDeleteMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={triggerClassName}
          aria-label={triggerLabel}
          title={triggerLabel}
        >
          <MoreHorizontal size={iconSize} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="workspace-note-cards-action-menu">
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 aria-hidden />
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WorkspaceNoteCardPanel({
  workspaceId,
  workspaceName = null,
  workspacePath = null,
  focusNoteId = null,
  focusRequestKey = 0,
  onReferenceNote,
}: WorkspaceNoteCardPanelProps) {
  const { t, i18n } = useTranslation();
  const [collection, setCollection] = useState<NoteCardCollection>("active");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<WorkspaceNoteCardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWorkspaceScope, setSelectedWorkspaceScope] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<WorkspaceNoteCard | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const [attachmentDrafts, setAttachmentDrafts] = useState<string[]>([]);
  const [imagePreview, setImagePreview] = useState<NoteCardImagePreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const lastHandledFocusRequestRef = useRef<number | null>(null);

  const archived = collection === "archive";
  const projectName = useMemo(
    () => deriveProjectName(workspaceId, workspaceName, workspacePath),
    [workspaceId, workspaceName, workspacePath],
  );
  const workspaceScopeKey = useMemo(
    () => [workspaceId?.trim() ?? "", workspaceName?.trim() ?? "", workspacePath?.trim() ?? ""].join("::"),
    [workspaceId, workspaceName, workspacePath],
  );
  const persistedAttachmentPaths = useMemo(
    () => selectedNote?.attachments.map((attachment) => attachment.absolutePath) ?? [],
    [selectedNote],
  );
  const isDraftDirty = useMemo(() => {
    if (archived) {
      return false;
    }
    const baselineTitle = selectedNote?.title ?? "";
    const baselineBody = selectedNote?.bodyMarkdown ?? "";
    return (
      titleDraft !== baselineTitle ||
      bodyDraft !== baselineBody ||
      !areStringArraysEqual(attachmentDrafts, persistedAttachmentPaths)
    );
  }, [archived, attachmentDrafts, bodyDraft, persistedAttachmentPaths, selectedNote, titleDraft]);

  const resetDraft = useCallback(() => {
    setSelectedId(null);
    setSelectedWorkspaceScope(null);
    setSelectedNote(null);
    setTitleDraft("");
    setBodyDraft("");
    setAttachmentDrafts([]);
    setError(null);
    setSaveError(null);
  }, []);

  const refreshList = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    setItems([]);
    setLoading(false);
    setDetailLoading(false);
    setQuery("");
    setImagePreview(null);
    lastHandledFocusRequestRef.current = null;
    resetDraft();
  }, [resetDraft, workspaceScopeKey]);

  useEffect(() => {
    if (!workspaceId) {
      setItems([]);
      setSelectedId(null);
      setSelectedWorkspaceScope(null);
      setSelectedNote(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void noteCardsFacade
        .list({
          workspaceId,
          workspaceName,
          workspacePath,
          archived,
          query: query.trim() || null,
          page: 0,
          pageSize: 200,
        })
        .then((response) => {
          if (cancelled) {
            return;
          }
          setItems(response.items);
        })
        .catch((listError) => {
          if (cancelled) {
            return;
          }
          setItems([]);
          setError(
            listError instanceof Error ? listError.message : String(listError),
          );
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    archived,
    query,
    refreshNonce,
    workspaceId,
    workspaceName,
    workspacePath,
  ]);

  useEffect(() => {
    if (!workspaceId || !selectedId || selectedWorkspaceScope !== workspaceScopeKey) {
      setSelectedNote(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setError(null);
    void noteCardsFacade
      .get({
        noteId: selectedId,
        workspaceId,
        workspaceName,
        workspacePath,
      })
      .then((note) => {
        if (cancelled) {
          return;
        }
        setSelectedNote(note);
        if (!note || archived) {
          return;
        }
        setTitleDraft(note.title);
        setBodyDraft(note.bodyMarkdown);
        setAttachmentDrafts(note.attachments.map((attachment) => attachment.absolutePath));
      })
      .catch((detailError) => {
        if (!cancelled) {
          setError(detailError instanceof Error ? detailError.message : String(detailError));
          setSelectedNote(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [archived, selectedId, selectedWorkspaceScope, workspaceId, workspaceName, workspacePath, workspaceScopeKey]);

  const emptyMessage = useMemo(() => {
    if (!workspaceId) {
      return t("noteCards.emptyWorkspace");
    }
    if (loading) {
      return t("noteCards.loading");
    }
    if (query.trim()) {
      return t("noteCards.emptySearch");
    }
    return archived ? t("noteCards.emptyArchive") : t("noteCards.emptyPool");
  }, [archived, loading, query, t, workspaceId]);

  const formatDate = useCallback(
    (value?: number | null) => {
      if (!value) {
        return "--";
      }
      return new Intl.DateTimeFormat(i18n.language || undefined, {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    },
    [i18n.language],
  );

  const handlePickImages = useCallback(async () => {
    try {
      const picked = await pickImageFiles();
      if (picked.length === 0) {
        return;
      }
      setAttachmentDrafts((previous) => {
        const next = [...previous];
        for (const path of picked) {
          if (!next.includes(path)) {
            next.push(path);
          }
        }
        return next;
      });
    } catch (pickError) {
      setError(pickError instanceof Error ? pickError.message : String(pickError));
    }
  }, []);

  const handleAttachImages = useCallback((paths: string[]) => {
    setAttachmentDrafts((previous) => {
      const next = [...previous];
      for (const path of paths) {
        if (!next.includes(path)) {
          next.push(path);
        }
      }
      return next;
    });
  }, []);

  const handleRemoveAttachment = useCallback((path: string) => {
    setAttachmentDrafts((previous) => previous.filter((entry) => entry !== path));
  }, []);

  const confirmDiscardDraft = useCallback(async () => {
    if (!isDraftDirty) {
      return true;
    }
    return confirm(t("noteCards.discardConfirm"), {
      title: t("noteCards.unsavedTitle"),
      kind: "warning",
      okLabel: t("noteCards.discardAction"),
      cancelLabel: t("noteCards.keepEditing"),
    });
  }, [isDraftDirty, t]);

  const openNote = useCallback(
    (noteId: string) => {
      setSelectedNote(null);
      setSelectedId(noteId);
      setSelectedWorkspaceScope(workspaceScopeKey);
      setTitleDraft("");
      setBodyDraft("");
      setAttachmentDrafts([]);
      setError(null);
      setSaveError(null);
    },
    [workspaceScopeKey],
  );

  const handleSave = useCallback(async () => {
    if (!workspaceId) {
      return false;
    }
    if (!titleDraft.trim() && !bodyDraft.trim() && attachmentDrafts.length === 0) {
      return false;
    }
    setSaving(true);
    setError(null);
    setSaveError(null);
    try {
      const currentSelectedId = selectedId;
      const isUpdate = Boolean(currentSelectedId && !archived);
      const payload = {
        workspaceId,
        workspaceName,
        workspacePath,
        title: titleDraft.trim() || null,
        bodyMarkdown: bodyDraft,
        attachmentInputs: attachmentDrafts,
      };
      const note =
        isUpdate && currentSelectedId
          ? await noteCardsFacade.update(currentSelectedId, workspaceId, payload)
          : await noteCardsFacade.create(payload);
      setSelectedId(note.id);
      setSelectedWorkspaceScope(workspaceScopeKey);
      setSelectedNote(note);
      setTitleDraft(note.title);
      setBodyDraft(note.bodyMarkdown);
      setAttachmentDrafts(note.attachments.map((attachment) => attachment.absolutePath));
      if (archived) {
        setCollection("active");
      }
      refreshList();
      pushErrorToast({
        id: "workspace-note-card-save-success",
        title: t("noteCards.saveSuccessTitle"),
        message: t(isUpdate ? "noteCards.saveSuccessUpdateMessage" : "noteCards.saveSuccessCreateMessage"),
        variant: "success",
        durationMs: 2400,
      });
      return true;
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      setError(message);
      setSaveError(message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    archived,
    attachmentDrafts,
    bodyDraft,
    refreshList,
    selectedId,
    t,
    titleDraft,
    workspaceId,
    workspaceName,
    workspacePath,
    workspaceScopeKey,
  ]);

  const restoreNote = useCallback(
    async (noteId: string) => {
      if (!workspaceId) {
        return null;
      }
      try {
        return await noteCardsFacade.restore({
          noteId,
          workspaceId,
          workspaceName,
          workspacePath,
        });
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
        return null;
      }
    },
    [workspaceId, workspaceName, workspacePath],
  );

  const handleRestore = useCallback(
    async (noteId: string) => {
      const restored = await restoreNote(noteId);
      if (!restored) {
        return;
      }
      resetDraft();
      setCollection("active");
      openNote(restored.id);
      refreshList();
    },
    [openNote, refreshList, resetDraft, restoreNote],
  );

  const handleArchive = useCallback(
    async (noteId: string) => {
      if (!workspaceId || (selectedId === noteId && !(await confirmDiscardDraft()))) {
        return;
      }
      try {
        await noteCardsFacade.archive({
          noteId,
          workspaceId,
          workspaceName,
          workspacePath,
        });
        if (selectedId === noteId) {
          resetDraft();
        }
        refreshList();
        pushErrorToast({
          id: `workspace-note-card-archive-${noteId}`,
          title: t("noteCards.archiveSuccessTitle"),
          message: t("noteCards.archiveSuccessMessage"),
          variant: "success",
          durationMs: 6000,
          actions: [
            {
              label: t("noteCards.undoArchive"),
              pendingLabel: t("noteCards.restoring"),
              run: async () => {
                const restored = await restoreNote(noteId);
                if (!restored) {
                  throw new Error(t("noteCards.restoreFailed"));
                }
                refreshList();
              },
            },
          ],
        });
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
      }
    },
    [
      confirmDiscardDraft,
      refreshList,
      resetDraft,
      restoreNote,
      selectedId,
      t,
      workspaceId,
      workspaceName,
      workspacePath,
    ],
  );

  const handleDelete = useCallback(
    async (noteId: string, title?: string | null) => {
      const confirmed = await confirm(
        t("noteCards.deleteConfirm", {
          title: title?.trim() || t("noteCards.untitled"),
        }),
        {
          title: t("noteCards.deleteAction"),
          kind: "warning",
          okLabel: t("noteCards.deleteAction"),
          cancelLabel: t("common.cancel"),
        },
      );
      if (!confirmed) {
        return;
      }
      if (!workspaceId) {
        return;
      }
      try {
        await noteCardsFacade.delete({
          noteId,
          workspaceId,
          workspaceName,
          workspacePath,
        });
        if (selectedId === noteId) {
          resetDraft();
        }
        refreshList();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
      }
    },
    [refreshList, resetDraft, selectedId, t, workspaceId, workspaceName, workspacePath],
  );

  const handleSelectCard = useCallback(
    async (noteId: string) => {
      if (noteId === selectedId || !(await confirmDiscardDraft())) {
        return;
      }
      openNote(noteId);
    },
    [confirmDiscardDraft, openNote, selectedId],
  );

  const handleCreateNote = useCallback(async () => {
    if (!(await confirmDiscardDraft())) {
      return;
    }
    if (archived) {
      setCollection("active");
    }
    resetDraft();
  }, [archived, confirmDiscardDraft, resetDraft]);

  const handleCollectionChange = useCallback(
    async (nextCollection: NoteCardCollection) => {
      if (nextCollection === collection || !(await confirmDiscardDraft())) {
        return;
      }
      resetDraft();
      setCollection(nextCollection);
    },
    [collection, confirmDiscardDraft, resetDraft],
  );

  const handleClearEditor = useCallback(async () => {
    if (await confirmDiscardDraft()) {
      resetDraft();
    }
  }, [confirmDiscardDraft, resetDraft]);

  const handleReferenceNote = useCallback(() => {
    if (selectedNote && !archived) {
      onReferenceNote?.(selectedNote);
    }
  }, [archived, onReferenceNote, selectedNote]);

  const handleCollectionTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") {
        return;
      }
      event.preventDefault();
      const nextCollection = event.key === "ArrowLeft" || event.key === "Home" ? "active" : "archive";
      const nextTab = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
        `[data-note-collection="${nextCollection}"]`,
      );
      nextTab?.focus();
      void handleCollectionChange(nextCollection);
    },
    [handleCollectionChange],
  );

  const handleWorkbenchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!archived && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
    },
    [archived, handleSave],
  );

  useEffect(() => {
    if (
      !workspaceId ||
      !focusNoteId ||
      lastHandledFocusRequestRef.current === focusRequestKey
    ) {
      return;
    }
    lastHandledFocusRequestRef.current = focusRequestKey;
    void (async () => {
      if (!(await confirmDiscardDraft())) {
        return;
      }
      if (archived) {
        setCollection("active");
      }
      openNote(focusNoteId);
    })();
  }, [archived, confirmDiscardDraft, focusNoteId, focusRequestKey, openNote, workspaceId]);

  const previewNote = selectedNote;
  const saveLabel = selectedId && !archived ? t("noteCards.saveUpdate") : t("noteCards.saveCreate");
  const attachImageLabel = t("noteCards.attachImage");
  const editorHintLabel = t("noteCards.editorHint");
  const storageHint = t("noteCards.storageHint", {
    path: buildNoteCardStorageHintPath(projectName),
  });
  const isListEmpty = items.length === 0;
  const hasMeaningfulDraft = Boolean(titleDraft.trim() || bodyDraft.trim() || attachmentDrafts.length > 0);
  const saveStatusLabel = saving
    ? t("noteCards.saveStatusSaving")
    : saveError
      ? t("noteCards.saveStatusError")
      : isDraftDirty
        ? t("noteCards.saveStatusDirty")
        : selectedNote
          ? t("noteCards.saveStatusSaved")
          : t("noteCards.saveStatusIdle");

  return (
    <div className="workspace-note-cards-panel" onKeyDown={handleWorkbenchKeyDown}>
      <header className="workspace-note-cards-topbar">
        <div className="workspace-note-cards-topbar-main">
          <span className="workspace-note-cards-title-icon" aria-hidden>
            <NotebookPen size={16} />
          </span>
          <div className="workspace-note-cards-title-block">
            <h2>{t("noteCards.title")}</h2>
            <p>{t("noteCards.subtitle")}</p>
            <p className="workspace-note-cards-storage-meta">{storageHint}</p>
          </div>
          <div className="workspace-note-cards-header-actions">
            <button
              type="button"
              className="ghost icon-button"
              onClick={refreshList}
              aria-label={t("noteCards.refresh")}
              title={t("noteCards.refresh")}
            >
              <RefreshCw size={14} aria-hidden />
            </button>
            <button
              type="button"
              className="workspace-note-cards-primary-action"
              onClick={() => void handleCreateNote()}
              aria-label={t("noteCards.new")}
              title={t("noteCards.new")}
            >
              <Plus size={14} aria-hidden />
              <span>{t("noteCards.new")}</span>
            </button>
          </div>
        </div>
        <div className="workspace-note-cards-toolbar">
          <div className="workspace-note-cards-collection-switch" role="tablist" aria-label={t("noteCards.title")}>
            <button
              type="button"
              role="tab"
              aria-selected={!archived}
              aria-controls="workspace-note-cards-collection"
              data-note-collection="active"
              className={`workspace-note-cards-collection-tab${!archived ? " is-active" : ""}`}
              onClick={() => void handleCollectionChange("active")}
              onKeyDown={handleCollectionTabKeyDown}
            >
              {t("noteCards.pool")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={archived}
              aria-controls="workspace-note-cards-collection"
              data-note-collection="archive"
              className={`workspace-note-cards-collection-tab${archived ? " is-active" : ""}`}
              onClick={() => void handleCollectionChange("archive")}
              onKeyDown={handleCollectionTabKeyDown}
            >
              {t("noteCards.archive")}
            </button>
          </div>
          <label className="workspace-note-cards-search">
            <Search size={14} aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("noteCards.searchPlaceholder")}
              aria-label={t("noteCards.searchPlaceholder")}
              name="workspace-note-card-search"
              autoComplete="off"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("noteCards.clearSearch")}
                title={t("noteCards.clearSearch")}
              >
                <X size={13} aria-hidden />
              </button>
            ) : null}
          </label>
        </div>
      </header>

      <div className="workspace-note-cards-workbench">
      <section
        id="workspace-note-cards-collection"
        className={`workspace-note-cards-list${isListEmpty ? " is-empty" : ""}`}
        aria-label={archived ? t("noteCards.archive") : t("noteCards.pool")}
      >
        {isListEmpty ? (
          <div className="workspace-note-cards-empty">{emptyMessage}</div>
        ) : (
          items.map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <article
                key={item.id}
                className={`workspace-note-cards-card${isSelected ? " is-selected" : ""}`}
              >
                <button
                  type="button"
                  className="workspace-note-cards-card-main"
                  onClick={() => void handleSelectCard(item.id)}
                  aria-pressed={isSelected}
                >
                  <div className="workspace-note-cards-card-head">
                    <strong>{item.title || t("noteCards.untitled")}</strong>
                    {item.imageCount > 0 ? (
                      <span className="workspace-note-cards-card-badge">
                        {t("noteCards.imageCount", { count: item.imageCount })}
                      </span>
                    ) : null}
                  </div>
                  <p>{item.plainTextExcerpt || t("noteCards.previewEmpty")}</p>
                  <div className="workspace-note-cards-card-meta">
                    <span>{t("noteCards.updatedAt", { time: formatDate(item.updatedAt) })}</span>
                    {item.archived ? <span>{t("noteCards.archivedState")}</span> : null}
                  </div>
                </button>
                <div className="workspace-note-cards-card-actions">
                  {archived ? (
                    <button
                      type="button"
                      className="ghost workspace-note-cards-icon-action"
                      onClick={() => void handleRestore(item.id)}
                      aria-label={t("noteCards.restore")}
                      title={t("noteCards.restore")}
                    >
                      <Undo2 size={13} aria-hidden />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ghost workspace-note-cards-icon-action"
                      onClick={() => void handleArchive(item.id)}
                      aria-label={t("noteCards.archiveAction")}
                      title={t("noteCards.archiveAction")}
                    >
                      <Archive size={13} aria-hidden />
                    </button>
                  )}
                  <NoteCardDeleteMenu
                    triggerLabel={t("noteCards.moreActions")}
                    deleteLabel={t("noteCards.deleteAction")}
                    onDelete={() => void handleDelete(item.id, item.title)}
                  />
                </div>
              </article>
            );
          })
        )}
      </section>

      {!archived ? (
        <section className="workspace-note-cards-editor">
          <div className="workspace-note-cards-editor-head">
            <div className="workspace-note-cards-editor-copy" title={editorHintLabel}>
              <h3>{selectedId ? t("noteCards.editorEdit") : t("noteCards.editorCreate")}</h3>
              <span>{selectedId ? t("noteCards.selectedHint") : t("noteCards.editorHintShort")}</span>
            </div>
            <div className="workspace-note-cards-head-actions">
              {selectedNote && onReferenceNote ? (
                <button
                  type="button"
                  className="workspace-note-cards-reference-action"
                  onClick={handleReferenceNote}
                  disabled={isDraftDirty}
                  title={isDraftDirty ? t("noteCards.referenceSaveFirst") : t("noteCards.referenceInChat")}
                >
                  <MessageSquarePlus size={14} aria-hidden />
                  <span>{t("noteCards.referenceInChat")}</span>
                </button>
              ) : null}
              {selectedId ? (
                <NoteCardDeleteMenu
                  triggerLabel={t("noteCards.moreActions")}
                  deleteLabel={t("noteCards.deleteAction")}
                  iconSize={14}
                  onDelete={() => void handleDelete(selectedId, selectedNote?.title ?? titleDraft)}
                />
              ) : null}
              {selectedId ? (
                <button
                  type="button"
                  className="ghost workspace-note-cards-icon-action"
                  onClick={() => void handleClearEditor()}
                  aria-label={t("noteCards.clear")}
                  title={t("noteCards.clear")}
                >
                  <X size={14} aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
          <div className="workspace-note-cards-editor-body">
            <input
              className="workspace-note-cards-title-input"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              placeholder={t("noteCards.titlePlaceholder")}
              aria-label={t("noteCards.titlePlaceholder")}
              name="workspace-note-card-title"
              autoComplete="off"
            />
            <RichTextInput
              value={bodyDraft}
              onChange={setBodyDraft}
              attachments={attachmentDrafts}
              attachmentWorkspaceId={workspaceId}
              onAttachImages={handleAttachImages}
              onRemoveAttachment={handleRemoveAttachment}
              placeholder={t("noteCards.bodyPlaceholder")}
              enableResize={false}
              initialHeight={190}
              minHeight={150}
              maxHeight={520}
              className="workspace-note-cards-rich-input"
              footerClassName="workspace-note-cards-rich-footer"
              footerLeft={(
                <button
                  type="button"
                  className="ghost workspace-note-cards-icon-action"
                  onClick={() => void handlePickImages()}
                  aria-label={attachImageLabel}
                  title={attachImageLabel}
                >
                  <ImagePlus size={14} aria-hidden />
                </button>
              )}
              footerRight={(
                <div className="workspace-note-cards-save-group">
                  <span
                    className={`workspace-note-cards-save-status${saveError ? " is-error" : isDraftDirty ? " is-dirty" : ""}`}
                    role="status"
                    aria-live="polite"
                  >
                    {saveStatusLabel}
                  </span>
                  <button
                    type="button"
                    className="workspace-note-cards-save"
                    onClick={() => void handleSave()}
                    disabled={saving || !workspaceId || !hasMeaningfulDraft || !isDraftDirty}
                    title={t("noteCards.saveShortcut")}
                  >
                    <Save size={14} aria-hidden />
                    <span>{saveLabel}</span>
                  </button>
                </div>
              )}
            />
          </div>
        </section>
      ) : (
        <section className="workspace-note-cards-preview-panel">
          <div className="workspace-note-cards-editor-head">
            <div>
              <h3>{t("noteCards.previewTitle")}</h3>
              <p>{t("noteCards.previewHint")}</p>
            </div>
          </div>
          {detailLoading ? (
            <div className="workspace-note-cards-empty">{t("noteCards.loading")}</div>
          ) : previewNote ? (
            <article className="workspace-note-cards-preview-card">
              <div className="workspace-note-cards-preview-head">
                <div className="workspace-note-cards-preview-meta">
                  <h4>{previewNote.title || t("noteCards.untitled")}</h4>
                  <span>{t("noteCards.updatedAt", { time: formatDate(previewNote.updatedAt) })}</span>
                </div>
                <div className="workspace-note-cards-head-actions">
                  <button
                    type="button"
                    className="workspace-note-cards-inline-action workspace-note-cards-icon-action"
                    onClick={() => void handleRestore(previewNote.id)}
                    aria-label={t("noteCards.restore")}
                    title={t("noteCards.restore")}
                  >
                    <Undo2 size={14} aria-hidden />
                  </button>
                  <NoteCardDeleteMenu
                    triggerLabel={t("noteCards.moreActions")}
                    deleteLabel={t("noteCards.deleteAction")}
                    iconSize={14}
                    triggerClassName="ghost workspace-note-cards-inline-action workspace-note-cards-icon-action"
                    onDelete={() => void handleDelete(previewNote.id, previewNote.title)}
                  />
                </div>
              </div>
              <Markdown
                className="markdown workspace-note-cards-preview-markdown"
                value={previewNote.bodyMarkdown || previewNote.plainTextExcerpt}
              />
              {previewNote.attachments.length > 0 ? (
                <div className="workspace-note-cards-preview-images">
                  {previewNote.attachments.map((attachment) => {
                    const src = attachmentPreviewSrc(attachment.absolutePath);
                    return (
                      <button
                        key={attachment.id}
                        type="button"
                        className="workspace-note-cards-preview-image"
                        onClick={() => {
                          if (src) {
                            setImagePreview({
                              src,
                              localPath: attachment.absolutePath,
                              fileName: attachment.fileName,
                            });
                          }
                        }}
                        title={attachment.fileName}
                      >
                        {src ? (
                          <LocalImage
                            src={src}
                            localPath={attachment.absolutePath}
                            workspaceId={workspaceId}
                            alt={attachment.fileName}
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </article>
          ) : (
            <div className="workspace-note-cards-empty">{t("noteCards.previewEmpty")}</div>
          )}
        </section>
      )}
      </div>

      {error ? (
        <div className="workspace-note-cards-error" role="status" aria-live="polite">{error}</div>
      ) : null}

      {imagePreview ? (
        <ImagePreviewOverlay
          src={imagePreview.src}
          localPath={imagePreview.localPath}
          workspaceId={workspaceId}
          alt={imagePreview.fileName}
          onClose={() => setImagePreview(null)}
        />
      ) : null}
    </div>
  );
}
