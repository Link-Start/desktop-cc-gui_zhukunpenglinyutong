// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Tooltip, TooltipTrigger } from "./tooltip";
import { TooltipIconButton } from "./tooltip-icon-button";
import { SidebarCollapseButton } from "../../features/layout/components/SidebarToggleControls";

function renderTooltipButton(props: Partial<Parameters<typeof TooltipIconButton>[0]> = {}) {
  render(
    <TooltipIconButton label="Hide right sidebar" {...props}>
      <span aria-hidden>icon</span>
    </TooltipIconButton>,
  );

  return screen.getByRole("button", { name: props["aria-label"] ?? "Hide right sidebar" });
}

function SidebarToggleLayout({ inTopbar }: { inTopbar: boolean }) {
  const toggle = (
    <TooltipIconButton label="Hide right sidebar" className="sidebar-toggle">
      <span aria-hidden>icon</span>
    </TooltipIconButton>
  );

  return inTopbar ? (
    <header data-testid="topbar-host">{toggle}</header>
  ) : (
    <aside data-testid="sidebar-host">{toggle}</aside>
  );
}

async function openTooltip(button: HTMLElement) {
  await act(async () => {
    fireEvent.mouseEnter(button);
    await vi.advanceTimersByTimeAsync(250);
  });
}

describe("TooltipIconButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not create a native title tooltip by default", () => {
    const button = renderTooltipButton();

    expect(button.getAttribute("aria-label")).toBe("Hide right sidebar");
    expect(button.getAttribute("title")).toBeNull();
  });

  it("preserves an explicit title when a caller provides one", () => {
    const button = renderTooltipButton({ title: "Native fallback" });

    expect(button.getAttribute("title")).toBe("Native fallback");
  });

  it("keeps one stable native trigger across equivalent rerenders", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const view = render(
      <TooltipIconButton label="Hide right sidebar" className="sidebar-toggle">
        <span aria-hidden>icon</span>
      </TooltipIconButton>,
    );
    const initialButton = screen.getByRole("button", { name: "Hide right sidebar" });

    try {
      for (let index = 0; index < 64; index += 1) {
        view.rerender(
          <TooltipIconButton label="Hide right sidebar" className="sidebar-toggle">
            <span aria-hidden>icon</span>
          </TooltipIconButton>,
        );
      }

      const currentButton = screen.getByRole("button", { name: "Hide right sidebar" });
      expect(currentButton).toBe(initialButton);
      expect(currentButton.className).toContain("sidebar-toggle");
      expect(currentButton.querySelectorAll("button")).toHaveLength(0);
      expect(
        consoleErrorSpy.mock.calls.some((call) =>
          call.some((entry) => String(entry).includes("Maximum update depth exceeded")),
        ),
      ).toBe(false);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("renders a direct Radix button trigger without Slot composition", () => {
    render(
      <Tooltip>
        <TooltipTrigger data-trigger-owner="radix">Workspace session</TooltipTrigger>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Workspace session" });
    expect(trigger.getAttribute("data-trigger-owner")).toBe("radix");
    expect(trigger.querySelector("button")).toBeNull();
  });

  it("does not enter an update loop when the sidebar trigger changes layout hosts", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const view = render(<SidebarToggleLayout inTopbar={false} />);

    try {
      for (let index = 0; index < 16; index += 1) {
        const button = screen.getByRole("button", { name: "Hide right sidebar" });
        await act(async () => {
          fireEvent.mouseEnter(button);
          await vi.advanceTimersByTimeAsync(250);
        });
        expect(document.querySelector('[data-slot="tooltip-popup"]')).toBeTruthy();

        view.rerender(<SidebarToggleLayout inTopbar={index % 2 === 0} />);
      }

      expect(
        consoleErrorSpy.mock.calls.some((call) =>
          call.some((entry) => String(entry).includes("Maximum update depth exceeded")),
        ),
      ).toBe(false);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("keeps the real sidebar collapse trigger stable through StrictMode host remounts", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sidebarProps = {
      isCompact: false,
      sidebarCollapsed: false,
      rightPanelCollapsed: false,
      onCollapseSidebar: vi.fn(),
      onExpandSidebar: vi.fn(),
      onCollapseRightPanel: vi.fn(),
      onExpandRightPanel: vi.fn(),
    };
    const renderSidebarToggle = (inTopbar: boolean) => (
      <StrictMode>
        {inTopbar ? (
          <header data-testid="real-topbar-host">
            <SidebarCollapseButton {...sidebarProps} />
          </header>
        ) : (
          <aside data-testid="real-sidebar-host">
            <SidebarCollapseButton {...sidebarProps} />
          </aside>
        )}
      </StrictMode>
    );
    const view = render(renderSidebarToggle(false));

    try {
      for (let index = 0; index < 16; index += 1) {
        const button = screen.getByRole("button", { name: "sidebar.hideThreadsSidebar" });
        await openTooltip(button);
        expect(button.querySelectorAll("button")).toHaveLength(0);
        view.rerender(renderSidebarToggle(index % 2 === 0));
      }

      expect(
        consoleErrorSpy.mock.calls.some((call) =>
          call.some((entry) => String(entry).includes("Maximum update depth exceeded")),
        ),
      ).toBe(false);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("closes the custom tooltip when the trigger is clicked", async () => {
    const onClick = vi.fn();
    const button = renderTooltipButton({ onClick });

    await openTooltip(button);
    // Query the component's own visible tooltip by its stable data-slot:
    // Radix renders extra role="tooltip" a11y nodes (visible Content + hidden
    // copy), so getByRole("tooltip") is ambiguous after the base-ui→radix swap.
    expect(
      document.querySelector('[data-slot="tooltip-popup"]')?.textContent,
    ).toContain("Hide right sidebar");

    await act(async () => {
      fireEvent.click(button);
    });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-slot="tooltip-popup"]')).toBeNull();
  });

  it("keeps the styled portal surface and requested placement without Radix Tooltip", async () => {
    const button = renderTooltipButton({
      tooltipSide: "right",
      tooltipAlign: "start",
      tooltipClassName: "custom-tooltip-surface",
    });

    await openTooltip(button);

    const popup = document.querySelector<HTMLElement>('[data-slot="tooltip-popup"]');
    expect(popup?.parentElement).toBe(document.body);
    expect(popup?.getAttribute("role")).toBe("tooltip");
    expect(popup?.getAttribute("data-side")).toBe("right");
    expect(popup?.classList.contains("custom-tooltip-surface")).toBe(true);
    expect(popup?.classList.contains("bg-popover")).toBe(true);
    expect(popup?.style.position).toBe("fixed");
    expect(button.getAttribute("aria-describedby")).toBe(popup?.id);
  });

  it("closes the custom tooltip when the window loses focus", async () => {
    const button = renderTooltipButton();

    await openTooltip(button);
    // Query the component's own visible tooltip by its stable data-slot:
    // Radix renders extra role="tooltip" a11y nodes (visible Content + hidden
    // copy), so getByRole("tooltip") is ambiguous after the base-ui→radix swap.
    expect(
      document.querySelector('[data-slot="tooltip-popup"]')?.textContent,
    ).toContain("Hide right sidebar");

    await act(async () => {
      window.dispatchEvent(new Event("blur"));
    });

    expect(document.querySelector('[data-slot="tooltip-popup"]')).toBeNull();
  });

  it("closes the custom tooltip when the pointer interaction is cancelled", async () => {
    const button = renderTooltipButton();

    await openTooltip(button);
    // Query the component's own visible tooltip by its stable data-slot:
    // Radix renders extra role="tooltip" a11y nodes (visible Content + hidden
    // copy), so getByRole("tooltip") is ambiguous after the base-ui→radix swap.
    expect(
      document.querySelector('[data-slot="tooltip-popup"]')?.textContent,
    ).toContain("Hide right sidebar");

    await act(async () => {
      fireEvent.pointerCancel(button);
    });

    expect(document.querySelector('[data-slot="tooltip-popup"]')).toBeNull();
  });
});
