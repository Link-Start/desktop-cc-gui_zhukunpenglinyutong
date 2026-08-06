/**
 * Windows main-window close confirmation (isolated pure helpers).
 *
 * Only used by the Windows custom titlebar close (X) control + its dialog.
 * macOS / Linux chrome and native menus MUST NOT import or call this.
 */

export type PerformWindowsMainWindowCloseResult = "closed" | "close-failed";

export type WindowsMainWindowCloseConfirmOpenState = {
  /** Custom confirm dialog already open. */
  isDialogOpen: boolean;
  /** Close API in flight after user confirmed. */
  isClosing: boolean;
};

/**
 * Whether a new close-confirm dialog may open.
 * Blocks stacked dialogs from multi-click on the titlebar X.
 */
export function canOpenWindowsMainWindowCloseConfirm(
  state: WindowsMainWindowCloseConfirmOpenState,
): boolean {
  return !state.isDialogOpen && !state.isClosing;
}

/**
 * Run the actual window close after the user accepted the custom dialog.
 * Failures are logged and returned as `close-failed` (window may still be open).
 */
export async function performWindowsMainWindowClose(
  close: () => void | Promise<void>,
  logError: (message: string, error: unknown) => void = defaultLogError,
): Promise<PerformWindowsMainWindowCloseResult> {
  try {
    await close();
    return "closed";
  } catch (error) {
    logError("Windows main window close failed after user confirmation", error);
    return "close-failed";
  }
}

function defaultLogError(message: string, error: unknown): void {
  // eslint-disable-next-line no-console -- isolated close path; no shared logger here
  console.warn(message, error);
}
