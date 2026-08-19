import { isWindowsPlatform } from "./platform";

export function isWindowsBrowserReloadKey(
  event: Pick<KeyboardEvent, "key" | "code">,
): boolean {
  return event.key === "F5" || event.code === "F5";
}

/**
 * Swallow Windows F5 (and Ctrl/Shift/Alt+F5) before WebView2 reloads the
 * desktop shell. Native AcceleratorKeyPressed is the reliable gate; this
 * capture listener is a same-process fallback if the key still reaches JS.
 */
export function installWindowsReloadShortcutGuard(
  target: Pick<Window, "addEventListener" | "removeEventListener"> | undefined =
    typeof window === "undefined" ? undefined : window,
  isWindows: boolean = isWindowsPlatform(),
): () => void {
  if (!target || !isWindows) {
    return () => {};
  }

  const handleKeyDown = (event: Event) => {
    const keyboardEvent = event as KeyboardEvent;
    if (!isWindowsBrowserReloadKey(keyboardEvent)) {
      return;
    }
    keyboardEvent.preventDefault();
  };

  target.addEventListener("keydown", handleKeyDown, true);
  return () => {
    target.removeEventListener("keydown", handleKeyDown, true);
  };
}
