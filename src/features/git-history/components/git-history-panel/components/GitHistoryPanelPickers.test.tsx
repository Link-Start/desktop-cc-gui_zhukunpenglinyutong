/** @vitest-environment jsdom */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ActionSurface,
  GitHistoryInlinePicker,
} from "./GitHistoryPanelPickers";

describe("GitHistoryPanelPickers", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens inline picker dropdown without runtime reference errors", () => {
    const onSelect = vi.fn();

    render(
      <GitHistoryInlinePicker
        label="Target branch"
        value="main"
        options={[
          { value: "main", label: "main" },
          { value: "feature/demo", label: "feature/demo", description: "demo branch" },
        ]}
        searchPlaceholder="Search branches"
        emptyText="No branches"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Target branch" }));
    expect(screen.getByPlaceholderText("Search branches")).toBeTruthy();
  });
});

describe("ActionSurface tooltips", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows a floating tooltip for icon actions without a native title", async () => {
    render(
      <ActionSurface title="新建分支" ariaLabel="新建分支">
        <span aria-hidden>+</span>
      </ActionSurface>,
    );

    const button = screen.getByRole("button", { name: "新建分支" });
    expect(button.getAttribute("title")).toBeNull();

    await act(async () => {
      fireEvent.pointerMove(button);
      fireEvent.mouseEnter(button);
      await vi.advanceTimersByTimeAsync(600);
    });

    const popup = document.querySelector('[data-slot="tooltip-popup"]');
    expect(popup).toBeTruthy();
    expect(popup?.textContent ?? "").toContain("新建分支");
  });

  it("still surfaces disabled-reason tooltips when the action is disabled", async () => {
    render(
      <ActionSurface
        title="未选择可重命名的本地分支"
        ariaLabel="重命名分支"
        disabled
      >
        <span aria-hidden>✎</span>
      </ActionSurface>,
    );

    const button = screen.getByRole("button", { name: "重命名分支" });
    expect(button.getAttribute("aria-disabled")).toBe("true");

    await act(async () => {
      fireEvent.pointerMove(button);
      fireEvent.mouseEnter(button);
      await vi.advanceTimersByTimeAsync(600);
    });

    const popup = document.querySelector('[data-slot="tooltip-popup"]');
    expect(popup).toBeTruthy();
    expect(popup?.textContent ?? "").toContain("未选择可重命名的本地分支");
  });
});
