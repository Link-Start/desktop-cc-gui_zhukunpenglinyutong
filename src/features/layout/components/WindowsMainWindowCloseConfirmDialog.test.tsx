// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WindowsMainWindowCloseConfirmDialog } from "./WindowsMainWindowCloseConfirmDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { appName?: string; defaultValue?: string }) => {
      const map: Record<string, string> = {
        "app.title": "ccgui",
        "menu.closeWindowConfirmTitle": "Close window?",
        "menu.closeWindowConfirmMessage": `Are you sure you want to close ${options?.appName ?? "ccgui"}?`,
        "menu.closeWindowConfirmOk": "Close",
        "menu.closeWindowConfirmCancel": "Cancel",
        "menu.closeWindowConfirmBusy": "Closing…",
      };
      return map[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

describe("WindowsMainWindowCloseConfirmDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders title and app-name message when open", () => {
    render(
      <WindowsMainWindowCloseConfirmDialog
        open
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("Close window?")).toBeTruthy();
    expect(
      screen.getByText("Are you sure you want to close ccgui?"),
    ).toBeTruthy();
  });

  it("invokes cancel and confirm handlers", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <WindowsMainWindowCloseConfirmDialog
        open
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(
      screen.getByTestId("windows-main-window-close-confirm-cancel"),
    );
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("windows-main-window-close-confirm-ok"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables actions and shows busy label while closing", () => {
    render(
      <WindowsMainWindowCloseConfirmDialog
        open
        isClosing
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      (
        screen.getByTestId(
          "windows-main-window-close-confirm-cancel",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByTestId(
          "windows-main-window-close-confirm-ok",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText("Closing…")).toBeTruthy();
  });
});
