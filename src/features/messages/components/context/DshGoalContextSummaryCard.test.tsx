// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DshGoalContextSummaryCard } from "./DshGoalContextSummaryCard";

const GOAL_BODY = `<goal_round>
Continue the active goal.
</goal_round>`;

describe("DshGoalContextSummaryCard", () => {
  it("renders a process-phase fold row instead of the old bordered card", () => {
    const { container } = render(
      <DshGoalContextSummaryCard
        context={{
          kind: "dsh-goal",
          title: "Context injection",
          sourceLabel: "goal",
          body: GOAL_BODY,
        }}
      />,
    );

    const fold = container.querySelector("[data-testid='dsh-goal-context-fold']");
    expect(fold).toBeTruthy();
    expect(fold?.classList.contains("message-agent-task-fold-drawer")).toBe(true);
    expect(fold?.classList.contains("is-collapsed")).toBe(true);
    expect(container.querySelector(".note-card-context-summary-card")).toBeNull();
    expect(container.querySelector(".note-card-context-summary-toggle")).toBeNull();
    expect(container.querySelector(".note-card-context-summary-preview")).toBeNull();
    expect(container.querySelector(".message-agent-task-fold-status")?.textContent).toBe(
      "completed",
    );
    expect(container.querySelector(".message-agent-task-fold-label")?.textContent).toBe(
      "messages.dshGoalContextInjection · goal",
    );
    expect(container.textContent ?? "").not.toContain("<goal_round>");
  });

  it("reveals the goal body only after expanding", () => {
    render(
      <DshGoalContextSummaryCard
        context={{
          kind: "dsh-goal",
          title: "Context injection",
          sourceLabel: "goal",
          body: GOAL_BODY,
        }}
      />,
    );

    const toggle = screen.getByRole("button");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/<goal_round>/)).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});
