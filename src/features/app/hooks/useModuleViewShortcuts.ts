import { useEffect } from "react";
import {
  isEditableShortcutTarget,
  matchesShortcutForPlatform,
} from "../../../utils/shortcuts";
import { registerKeydownHandler } from "./keyboardDispatcher";

type UseModuleViewShortcutsOptions = {
  toggleGitGraphShortcut: string | null;
  openNotesShortcut: string | null;
  openIntentCanvasShortcut: string | null;
  openRadarShortcut: string | null;
  openProjectMapShortcut: string | null;
  openBrowserDockShortcut: string | null;
  openFileCompareShortcut: string | null;
  onToggleGitGraph: () => void;
  onOpenNotes: () => void;
  onOpenIntentCanvas: () => void;
  onOpenRadar: () => void;
  onOpenProjectMap: () => void;
  onOpenBrowserDock: () => void;
  onOpenFileCompare: () => void;
};

export function useModuleViewShortcuts({
  toggleGitGraphShortcut,
  openNotesShortcut,
  openIntentCanvasShortcut,
  openRadarShortcut,
  openProjectMapShortcut,
  openBrowserDockShortcut,
  openFileCompareShortcut,
  onToggleGitGraph,
  onOpenNotes,
  onOpenIntentCanvas,
  onOpenRadar,
  onOpenProjectMap,
  onOpenBrowserDock,
  onOpenFileCompare,
}: UseModuleViewShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        isEditableShortcutTarget(event.target) ||
        isEditableShortcutTarget(document.activeElement)
      ) {
        return;
      }

      const actions: Array<[string | null, () => void]> = [
        [toggleGitGraphShortcut, onToggleGitGraph],
        [openNotesShortcut, onOpenNotes],
        [openIntentCanvasShortcut, onOpenIntentCanvas],
        [openRadarShortcut, onOpenRadar],
        [openProjectMapShortcut, onOpenProjectMap],
        [openBrowserDockShortcut, onOpenBrowserDock],
        [openFileCompareShortcut, onOpenFileCompare],
      ];
      const matchedAction = actions.find(([shortcut]) =>
        matchesShortcutForPlatform(event, shortcut),
      );
      if (!matchedAction) {
        return;
      }
      event.preventDefault();
      matchedAction[1]();
    };

    return registerKeydownHandler(handleKeyDown);
  }, [
    onOpenBrowserDock,
    onOpenFileCompare,
    onOpenIntentCanvas,
    onOpenNotes,
    onOpenProjectMap,
    onOpenRadar,
    onToggleGitGraph,
    openBrowserDockShortcut,
    openFileCompareShortcut,
    openIntentCanvasShortcut,
    openNotesShortcut,
    openProjectMapShortcut,
    openRadarShortcut,
    toggleGitGraphShortcut,
  ]);
}
