import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import {
  clampRendererContextMenuPosition,
  estimateRendererContextMenuHeight,
  type RendererContextMenuItem,
  type RendererContextMenuState,
} from "../../../components/ui/RendererContextMenu";
import type { ConversationItem } from "../../../types";
import { buildSemanticThreadNote } from "../../../utils/threadText";
import type { NoteCaptureDraft } from "../../note-cards/types";
import { resolveUserMessagePresentation } from "../components/messagesUserPresentation";
import { snapshotConversationSelection } from "../utils/conversationSelection";

const NOTE_CAPTURE_TITLE_MAX_LENGTH = 60;

function deriveNoteCaptureTitle(text: string, fallback: string): string {
  const firstLine =
    text
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? fallback;
  const normalized = firstLine.replace(/\s+/g, " ");
  return normalized.length > NOTE_CAPTURE_TITLE_MAX_LENGTH
    ? `${normalized.slice(0, NOTE_CAPTURE_TITLE_MAX_LENGTH)}…`
    : normalized;
}

type UseConversationNoteCaptureMenuOptions = {
  canvasRootRef: RefObject<HTMLDivElement | null>;
  items: ConversationItem[];
  threadId: string | null;
  onCaptureNote?: (draft: NoteCaptureDraft) => void;
};

export function useConversationNoteCaptureMenu({
  canvasRootRef,
  items,
  threadId,
  onCaptureNote,
}: UseConversationNoteCaptureMenuOptions) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<RendererContextMenuState | null>(null);

  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);

  useEffect(() => {
    setMenu(null);
  }, [threadId]);

  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!onCaptureNote || !threadId || event.defaultPrevented) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          "a, button, input, textarea, select, [role='button'], [contenteditable='true']",
        )
      ) {
        return;
      }

      const selectionSnapshot = snapshotConversationSelection(
        typeof window === "undefined" ? null : window.getSelection(),
        canvasRootRef.current,
      );
      const semanticThread = buildSemanticThreadNote(items, {
        resolveUserMessageText: (item) =>
          resolveUserMessagePresentation({
            text: item.text,
            selectedAgentName: item.selectedAgentName,
            selectedAgentIcon: item.selectedAgentIcon,
            enableCollaborationBadge: true,
          }).displayText,
      });
      const menuItems: RendererContextMenuItem[] = [];
      const captureDraft = (draft: NoteCaptureDraft) => {
        setMenu(null);
        onCaptureNote(draft);
      };

      if (selectionSnapshot) {
        const selectionDraft: NoteCaptureDraft = {
          title: deriveNoteCaptureTitle(
            selectionSnapshot.text,
            t("noteCards.captureConversationSelectionTitle"),
          ),
          bodyMarkdown: selectionSnapshot.text,
          source: {
            kind: "conversationSelection",
            threadId,
            itemIds: selectionSnapshot.itemIds,
          },
        };
        menuItems.push({
          type: "item",
          id: "copy-conversation-selection",
          label: t("messages.copy"),
          onSelect: async () => {
            try {
              await navigator.clipboard.writeText(selectionSnapshot.text);
            } catch (error) {
              console.warn("Failed to copy conversation selection", {
                message: error instanceof Error ? error.message : String(error),
              });
            }
          },
        });
        menuItems.push({
          type: "item",
          id: "capture-conversation-selection",
          label: t("noteCards.captureConversationSelection"),
          onSelect: () => captureDraft(selectionDraft),
        });
      }

      if (semanticThread.markdown) {
        const threadDraft: NoteCaptureDraft = {
          title: t("noteCards.captureConversationThreadTitle"),
          bodyMarkdown: semanticThread.markdown,
          source: {
            kind: "conversationThread",
            threadId,
            itemCount: semanticThread.itemCount,
            capturedAt: Date.now(),
          },
        };
        menuItems.push({
          type: "item",
          id: "capture-conversation-thread",
          label: t("noteCards.captureConversationThread"),
          onSelect: () => captureDraft(threadDraft),
        });
      }

      if (menuItems.length === 0) {
        return;
      }
      event.preventDefault();
      const position = clampRendererContextMenuPosition(
        event.clientX,
        event.clientY,
        { height: estimateRendererContextMenuHeight(menuItems) },
      );
      setMenu({
        ...position,
        label: t("noteCards.captureMenu"),
        items: menuItems,
      });
    },
    [canvasRootRef, items, onCaptureNote, t, threadId],
  );

  return { menu, closeMenu, handleContextMenu };
}
