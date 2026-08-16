export const FIRST_RUN_SETUP_REOPEN_EVENT = "ccgui:first-run-setup-reopen";
export const FIRST_RUN_SETUP_CHANGE_EVENT = "ccgui:first-run-setup-change";

export type FirstRunSetupReopenDetail = {
  step?: "welcome" | "cli";
};

export function requestFirstRunSetupReopen(
  detail: FirstRunSetupReopenDetail = {},
): void {
  window.dispatchEvent(
    new CustomEvent<FirstRunSetupReopenDetail>(FIRST_RUN_SETUP_REOPEN_EVENT, {
      detail,
    }),
  );
}

export function notifyFirstRunSetupChanged(): void {
  window.dispatchEvent(new Event(FIRST_RUN_SETUP_CHANGE_EVENT));
}
