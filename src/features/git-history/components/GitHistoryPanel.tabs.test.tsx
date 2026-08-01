// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { getFileHistoryTabId, GIT_GRAPH_TAB_ID, type FileHistoryTarget } from "../types";
import { GitHistoryPanel } from "./GitHistoryPanel";

vi.mock("../../../styles/useFeatureStylesReady", () => ({
  useFeatureStylesReady: () => true,
}));

vi.mock("./git-history-panel/components", () => ({
  GitHistoryPanel: ({
    toolbarTabsNode,
    documentContentNode,
  }: {
    toolbarTabsNode?: ReactNode;
    documentContentNode?: ReactNode;
  }) => (
    <div data-testid="git-graph-workspace">
      <div className="git-history-toolbar">
        <span>existing toolbar controls</span>
        {toolbarTabsNode}
      </div>
      {documentContentNode}
    </div>
  ),
}));

vi.mock("./FileHistoryView", () => ({
  FileHistoryView: ({ target, showHeader }: { target: FileHistoryTarget; showHeader: boolean }) => (
    <div data-testid="file-history-workspace" data-show-header={String(showHeader)}>
      {target.displayPath}
    </div>
  ),
}));

const firstTarget: FileHistoryTarget = {
  workspaceId: "workspace-a",
  workspacePath: "/workspace-a",
  repositoryRoot: "",
  path: "src/App.tsx",
  displayPath: "src/App.tsx",
};

const secondTarget: FileHistoryTarget = {
  workspaceId: "workspace-b",
  workspacePath: "/workspace-b",
  repositoryRoot: "packages/web",
  path: "src/App.tsx",
  displayPath: "packages/web/src/App.tsx",
};

describe("GitHistoryPanel document tabs", () => {
  it("keeps Git Graph pinned and exposes multiple independently addressable file tabs", () => {
    const onActivateTab = vi.fn();
    const onCloseFileHistoryTab = vi.fn();
    render(
      <GitHistoryPanel
        workspace={null}
        fileHistoryTabs={[firstTarget, secondTarget]}
        activeTabId={getFileHistoryTabId(firstTarget)}
        onActivateTab={onActivateTab}
        onCloseFileHistoryTab={onCloseFileHistoryTab}
      />,
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0].textContent).toBe("");
    expect(tabs[0].getAttribute("title")).toBe("git.historyQuickAction");
    expect(document.querySelectorAll(".git-history-document-file-icon")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: secondTarget.displayPath }).textContent).toBe("App.tsx");
    expect(screen.getByRole("tab", { name: secondTarget.displayPath })).toBeTruthy();
    expect(screen.getByTestId("file-history-workspace").getAttribute("data-show-header")).toBe("false");
    expect(document.querySelectorAll(".git-history-toolbar")).toHaveLength(1);
    expect(document.querySelector(".git-history-toolbar .git-history-document-tabs")).toBeTruthy();
    expect(document.querySelector(".git-history-document-titlebar")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: secondTarget.displayPath }));
    expect(onActivateTab).toHaveBeenCalledWith(getFileHistoryTabId(secondTarget));

    fireEvent.click(screen.getByRole("button", {
      name: `git.fileHistoryClose: ${firstTarget.displayPath}`,
    }));
    expect(onCloseFileHistoryTab).toHaveBeenCalledWith(getFileHistoryTabId(firstTarget));
  });

  it("renders the Git Graph workspace for the pinned graph tab", () => {
    render(
      <GitHistoryPanel
        workspace={null}
        fileHistoryTabs={[firstTarget]}
        activeTabId={GIT_GRAPH_TAB_ID}
      />,
    );

    expect(screen.getByTestId("git-graph-workspace")).toBeTruthy();
    expect(screen.queryByTestId("file-history-workspace")).toBeNull();
    expect(screen.getByRole("tab", { name: "git.historyQuickAction" }).getAttribute("aria-selected"))
      .toBe("true");
  });

  it("opens the file tab context menu and dispatches close actions for its target", () => {
    const onCloseFileHistoryTab = vi.fn();
    const onCloseOtherFileHistoryTabs = vi.fn();
    const onCloseAllFileHistoryTabs = vi.fn();
    render(
      <GitHistoryPanel
        workspace={null}
        fileHistoryTabs={[firstTarget, secondTarget]}
        activeTabId={getFileHistoryTabId(firstTarget)}
        onCloseFileHistoryTab={onCloseFileHistoryTab}
        onCloseOtherFileHistoryTabs={onCloseOtherFileHistoryTabs}
        onCloseAllFileHistoryTabs={onCloseAllFileHistoryTabs}
      />,
    );

    const targetTab = screen.getByRole("tab", { name: secondTarget.displayPath });
    fireEvent.contextMenu(targetTab, { clientX: 120, clientY: 80 });
    fireEvent.click(screen.getByRole("menuitem", { name: "files.closeCurrentTab" }));
    expect(onCloseFileHistoryTab).toHaveBeenCalledWith(getFileHistoryTabId(secondTarget));

    fireEvent.contextMenu(targetTab, { clientX: 120, clientY: 80 });
    fireEvent.click(screen.getByRole("menuitem", { name: "files.closeOtherTabs" }));
    expect(onCloseOtherFileHistoryTabs).toHaveBeenCalledWith(getFileHistoryTabId(secondTarget));

    fireEvent.contextMenu(targetTab, { clientX: 120, clientY: 80 });
    fireEvent.click(screen.getByRole("menuitem", { name: "files.closeAllTabs" }));
    expect(onCloseAllFileHistoryTabs).toHaveBeenCalledTimes(1);
  });
});
