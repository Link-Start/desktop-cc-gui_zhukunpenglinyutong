/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComposerRunStatusStrip } from "./ComposerRunStatusStrip";

describe("ComposerRunStatusStrip", () => {
  it("renders nothing without activity", () => {
    const { container } = render(
      <ComposerRunStatusStrip
        todos={[]}
        subagents={[]}
        plan={null}
        isPlanMode={false}
        isProcessing={false}
        mergePlanIntoTodos={false}
        sessionFileChanges={null}
      />,
    );
    expect(container.querySelector('[data-testid="composer-run-status"]')).toBeNull();
  });

  it("renders pills and expands edited files list on click", () => {
    render(
      <ComposerRunStatusStrip
        todos={[
          { content: "【演示】任务 A", status: "completed" },
          { content: "【演示】任务 B", status: "pending" },
        ]}
        subagents={[]}
        plan={null}
        isPlanMode={false}
        isProcessing={false}
        mergePlanIntoTodos={false}
        sessionFileChanges={{
          files: [
            {
              path: "src/a.ts",
              additions: 10,
              deletions: 2,
              status: "completed",
            },
            {
              path: "src/b.ts",
              additions: 1,
              deletions: 0,
              status: "completed",
            },
          ],
          totalAdditions: 11,
          totalDeletions: 2,
        }}
      />,
    );

    expect(screen.getByTestId("composer-run-status")).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(2);

    const editTab =
      tabs.find((tab) => tab.getAttribute("data-section") === "edit") ??
      tabs[tabs.length - 1]!;
    // pill 显示行级 +add/-del，而不是文件数量
    expect(editTab.textContent ?? "").toContain("+11");
    expect(editTab.textContent ?? "").toContain("-2");

    fireEvent.click(editTab);
    expect(screen.getByText("a.ts")).toBeTruthy();
    expect(screen.getByText("b.ts")).toBeTruthy();
  });

  it("collapses pills via chrome toggle and restores them", () => {
    window.localStorage.setItem("ccgui.composer.runStatusChromeOpen", "1");
    render(
      <ComposerRunStatusStrip
        todos={[{ content: "任务 A", status: "pending" }]}
        subagents={[]}
        plan={null}
        isPlanMode={false}
        isProcessing={false}
        mergePlanIntoTodos={false}
        sessionFileChanges={null}
      />,
    );

    expect(screen.getAllByRole("tab").length).toBeGreaterThan(0);
    const toggle = screen.getByTestId("composer-run-status-chrome-toggle");
    fireEvent.click(toggle);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.getByTestId("composer-run-status").dataset.chromeOpen).toBe(
      "false",
    );

    fireEvent.click(toggle);
    expect(screen.getAllByRole("tab").length).toBeGreaterThan(0);
    expect(screen.getByTestId("composer-run-status").dataset.chromeOpen).toBe(
      "true",
    );
  });
});
