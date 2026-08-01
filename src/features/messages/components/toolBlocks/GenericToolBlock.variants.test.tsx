// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../../types";
import { GenericToolBlock } from "./GenericToolBlock";

type ToolItem = Extract<ConversationItem, { kind: "tool" }>;

const imageViewItem: ToolItem = {
  id: "tool-image-view",
  kind: "tool",
  toolType: "imageView",
  title: "View image",
  detail: "https://example.com/preview.png",
  status: "completed",
};

const exitPlanModeItem: ToolItem = {
  id: "tool-exit-plan",
  kind: "tool",
  toolType: "toolCall",
  title: "Tool: ExitPlanMode",
  detail: "PLAN\n# Plan\n\n- ship it\n\nPLANFILEPATH\n/tmp/plan.md",
  status: "completed",
};

describe("GenericToolBlock variant regressions", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders image preview without duplicating raw output", () => {
    const view = render(
      <GenericToolBlock item={imageViewItem} isExpanded onToggle={vi.fn()} />,
    );

    const image = screen.getByRole("img", { name: "image preview" });
    expect(image.getAttribute("src")).toBe("https://example.com/preview.png");
    expect(view.container.querySelector(".tool-output-raw-pre")).toBeNull();
  });

  it.each([
    ["processing", "animate-spin", "text-destructive"],
    ["failed", "text-destructive", "animate-spin"],
    ["completed", null, "animate-spin"],
  ] as const)(
    "preserves the %s status icon for unknown tools",
    (status, expectedClass, absentClass) => {
      const view = render(
        <GenericToolBlock
          item={{
            id: `tool-unknown-${status}`,
            kind: "tool",
            toolType: "toolCall",
            title: "Tool: UnmappedCapability",
            detail: "{}",
            status,
          }}
          isExpanded={false}
          onToggle={vi.fn()}
        />,
      );

      expect(screen.getByText("Unmappedcapability")).toBeTruthy();
      if (expectedClass) {
        expect(view.container.querySelector(`.${expectedClass}`)).toBeTruthy();
      } else {
        expect(view.container.querySelector(".animate-spin")).toBeNull();
        expect(view.container.querySelector(".text-destructive")).toBeNull();
      }
      expect(view.container.querySelector(`.${absentClass}`)).toBeNull();
    },
  );

  it("invokes the full-access exit plan action when unlocked", () => {
    const onExitPlanModeExecute = vi.fn();
    render(
      <GenericToolBlock
        item={exitPlanModeItem}
        isExpanded
        onToggle={vi.fn()}
        activeEngine="claude"
        selectedExitPlanExecutionMode={null}
        onExitPlanModeExecute={onExitPlanModeExecute}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch to full auto and run" }));

    expect(onExitPlanModeExecute).toHaveBeenCalledTimes(1);
    expect(onExitPlanModeExecute).toHaveBeenCalledWith("tool-exit-plan", "full-access");
  });
});
