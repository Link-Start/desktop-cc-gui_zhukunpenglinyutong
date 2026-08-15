import { useEffect } from "react";
import {
  isEditableShortcutTarget,
  matchesShortcutForPlatform,
} from "../../../utils/shortcuts";
import { registerKeydownHandler } from "./keyboardDispatcher";

type UsePrimaryModeShortcutsOptions = {
  isEnabled: boolean;
  openChatShortcut: string | null;
  onOpenChat: () => void;
};

export function usePrimaryModeShortcuts({
  isEnabled,
  openChatShortcut,
  onOpenChat,
}: UsePrimaryModeShortcutsOptions) {
  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }
      if (
        isEditableShortcutTarget(event.target) ||
        isEditableShortcutTarget(document.activeElement)
      ) {
        return;
      }
      if (!matchesShortcutForPlatform(event, openChatShortcut)) {
        return;
      }
      event.preventDefault();
      onOpenChat();
    };

    return registerKeydownHandler(handleKeyDown);
  }, [isEnabled, onOpenChat, openChatShortcut]);
}
