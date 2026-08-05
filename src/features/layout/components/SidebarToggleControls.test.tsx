// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";

const mocks = vi.hoisted(() => ({
  isWindowsPlatform: vi.fn(),
  closeWindow: vi.fn(),
  getCurrentWindow: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { appName?: string; defaultValue?: string }) => {
      const translations: Record<string, string> = {
        "app.title": "ccgui",
        "menu.closeWindow": "Close window",
        "menu.closeWindowConfirmTitle": "Close window?",
        "menu.closeWindowConfirmMessage": `Are you sure you want to close ${options?.appName ?? "ccgui"}?`,
        "menu.closeWindowConfirmOk": "Close",
        "menu.closeWindowConfirmCancel": "Cancel",
        "menu.closeWindowConfirmBusy": "Closing…",
        "menu.maximize": "Maximize",
        "menu.minimize": "Minimize",
        "common.restore": "Restore",
        "sidebar.showThreadsSidebar": "Show threads sidebar",
        "sidebar.hideThreadsSidebar": "Hide threads sidebar",
        "sidebar.quickSearch": "Search",
        "quickSwitcher.open": "Recent activity",
      };
      return translations[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: mocks.getCurrentWindow,
}));

vi.mock("../../../utils/platform", () => ({
  isWindowsPlatform: mocks.isWindowsPlatform,
}));

import {
  GlobalSearchTitlebarButton,
  QuickSwitcherTitlebarButton,
  SidebarCollapseButton,
  TitlebarExpandControls,
  type SidebarToggleProps,
} from "./SidebarToggleControls";

const baseProps: SidebarToggleProps = {
  isCompact: false,
  sidebarCollapsed: true,
  rightPanelCollapsed: false,
  onCollapseSidebar: vi.fn(),
  onExpandSidebar: vi.fn(),
  onCollapseRightPanel: vi.fn(),
  onExpandRightPanel: vi.fn(),
};

describe("TitlebarExpandControls", () => {
  beforeEach(() => {
    mocks.isWindowsPlatform.mockReset();
    mocks.isWindowsPlatform.mockReturnValue(false);
    mocks.closeWindow.mockReset();
    mocks.getCurrentWindow.mockReset();
    mocks.getCurrentWindow.mockReturnValue({
      close: mocks.closeWindow,
      isMaximized: vi.fn().mockResolvedValue(false),
      onResized: vi.fn().mockResolvedValue(() => undefined),
      minimize: vi.fn(),
      toggleMaximize: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a floating sidebar restore button when requested on non-Windows desktops", () => {
    render(
      createElement(TitlebarExpandControls as never, {
        ...baseProps,
        showSidebarTitlebarToggle: true,
      }),
    );

    expect(
      screen.getByRole("button", { name: "Show threads sidebar" }),
    ).toBeTruthy();
  });

  it("renders distinct Windows window controls and swapped floating sidebar restore groups", () => {
    mocks.isWindowsPlatform.mockReturnValue(true);

    const { container } = render(
      createElement(TitlebarExpandControls as never, {
        ...baseProps,
        isLayoutSwapped: true,
        showSidebarTitlebarToggle: true,
      }),
    );

    const windowControls = container.querySelector(".titlebar-window-controls");
    const sidebarToggle = container.querySelector(".titlebar-sidebar-toggle");

    expect(windowControls).toBeTruthy();
    expect(windowControls?.classList.contains("titlebar-toggle-right")).toBe(true);
    expect(sidebarToggle).toBeTruthy();
    expect(sidebarToggle?.classList.contains("titlebar-toggle-right")).toBe(true);
    expect(screen.getByRole("button", { name: "Show threads sidebar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Minimize" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Maximize" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close window" })).toBeTruthy();
  });

  it("opens a custom confirm dialog before closing the Windows main window", async () => {
    mocks.isWindowsPlatform.mockReturnValue(true);

    render(
      createElement(TitlebarExpandControls as never, {
        ...baseProps,
        showSidebarTitlebarToggle: false,
      }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close window" }));
    });

    expect(screen.getByTestId("windows-main-window-close-confirm")).toBeTruthy();
    expect(
      screen.getByText("Are you sure you want to close ccgui?"),
    ).toBeTruthy();
    expect(mocks.closeWindow).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId("windows-main-window-close-confirm-ok"));
    });

    expect(mocks.closeWindow).toHaveBeenCalledTimes(1);
  });

  it("does not close when the custom confirm dialog is cancelled", async () => {
    mocks.isWindowsPlatform.mockReturnValue(true);

    render(
      createElement(TitlebarExpandControls as never, {
        ...baseProps,
        showSidebarTitlebarToggle: false,
      }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close window" }));
    });

    await act(async () => {
      fireEvent.click(
        screen.getByTestId("windows-main-window-close-confirm-cancel"),
      );
    });

    expect(mocks.closeWindow).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId("windows-main-window-close-confirm"),
    ).toBeNull();
  });

  it("ignores repeated close clicks while the confirm dialog is open", async () => {
    mocks.isWindowsPlatform.mockReturnValue(true);

    render(
      createElement(TitlebarExpandControls as never, {
        ...baseProps,
        showSidebarTitlebarToggle: false,
      }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close window" }));
      fireEvent.click(screen.getByRole("button", { name: "Close window" }));
      fireEvent.click(screen.getByRole("button", { name: "Close window" }));
    });

    expect(
      screen.getAllByTestId("windows-main-window-close-confirm"),
    ).toHaveLength(1);
  });

  it("shows a tooltip for the sidebar collapse button on hover", async () => {
    vi.useFakeTimers();
    try {
      render(
        <SidebarCollapseButton
          {...baseProps}
          sidebarCollapsed={false}
        />,
      );

      await act(async () => {
        fireEvent.mouseEnter(screen.getByRole("button", { name: "Hide threads sidebar" }));
        await vi.advanceTimersByTimeAsync(250);
      });

      const tooltips = screen.getAllByRole("tooltip");
      expect(tooltips[tooltips.length - 1]?.textContent).toContain("Hide threads sidebar");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("GlobalSearchTitlebarButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders an icon-only search button and invokes onOpen", () => {
    const onOpen = vi.fn();
    const { container } = render(
      <GlobalSearchTitlebarButton onOpen={onOpen} shortcutLabel="⌘O" />,
    );

    const button = screen.getByRole("button", { name: "Search (⌘O)" });
    expect(button.textContent).toBe("");
    expect(container.querySelector("svg")).toBeTruthy();

    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe("QuickSwitcherTitlebarButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders an icon-only recent activity button and invokes onOpen", () => {
    const onOpen = vi.fn();
    const { container } = render(
      <QuickSwitcherTitlebarButton onOpen={onOpen} shortcutLabel="⌘E" />,
    );

    const button = screen.getByRole("button", {
      name: "Recent activity (⌘E)",
    });
    expect(button.textContent).toBe("");
    expect(container.querySelector("svg")).toBeTruthy();

    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
