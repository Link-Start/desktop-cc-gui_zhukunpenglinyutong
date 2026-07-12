// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Tooltip, TooltipTrigger } from "./tooltip";
import { TooltipIconButton } from "./tooltip-icon-button";

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

  it("preserves the caller-owned trigger element through Radix composition", () => {
    render(
      <Tooltip>
        <TooltipTrigger render={<button data-trigger-owner="caller" />}>
          Toggle sidebar
        </TooltipTrigger>
      </Tooltip>,
    );

    expect(
      screen.getByRole("button", { name: "Toggle sidebar" }).getAttribute("data-trigger-owner"),
    ).toBe("caller");
  });

  it("preserves children for a direct Radix trigger", () => {
    render(
      <Tooltip>
        <TooltipTrigger>Workspace session</TooltipTrigger>
      </Tooltip>,
    );

    expect(screen.getByRole("button", { name: "Workspace session" })).toBeTruthy();
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
