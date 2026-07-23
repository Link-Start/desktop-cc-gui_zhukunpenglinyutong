// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ThreadSummary } from "../../../types";
import { PinnedThreadList } from "./PinnedThreadList";
import { ScrollArea } from "../../../components/ui/scroll-area";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "threads.autoNaming": "Auto naming...",
        "threads.pin": "Pin",
        "threads.unpin": "Unpin",
        "threads.subagentTag": "Subagent",
        "threads.subagentTreeExpand": "Expand subagent tree",
        "threads.subagentTreeCollapse": "Collapse subagent tree",
        "threads.runtimeProcessing": "Processing",
        "threads.runtimeReviewing": "Reviewing",
      };
      return translations[key] ?? key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

const thread: ThreadSummary = {
  id: "thread-1",
  name: "Pinned Alpha",
  updatedAt: 1000,
};

const otherThread: ThreadSummary = {
  id: "thread-2",
  name: "Pinned Beta",
  updatedAt: 800,
};

const statusMap = {
  "thread-1": { isProcessing: false, hasUnread: false, isReviewing: true },
  "thread-2": { isProcessing: true, hasUnread: false, isReviewing: false },
};

const baseProps = {
  rows: [{ thread, depth: 0, workspaceId: "ws-1", workspacePath: "/tmp/ws-1" }],
  activeWorkspaceId: "ws-1",
  activeThreadId: "thread-1",
  threadStatusById: statusMap,
  getThreadTime: () => "1h",
  isThreadPinned: () => true,
  isThreadAutoNaming: () => false,
  onToggleThreadPin: vi.fn(),
  onSelectThread: vi.fn(),
  onShowThreadMenu: vi.fn(),
};

describe("PinnedThreadList", () => {
  it("hydrates pinned rows in StrictMode without mounting Radix row anchors", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const rows = Array.from({ length: 6 }, (_, index) => ({
      thread: { ...thread, id: `pinned-${index}`, name: `Pinned ${index + 1}` },
      depth: 0,
      workspaceId: "ws-1",
      workspacePath: "/tmp/ws-1",
    }));

    try {
      const { container } = render(
        <StrictMode>
          <ScrollArea style={{ width: 320, height: 480 }}>
            <PinnedThreadList {...baseProps} rows={rows} />
          </ScrollArea>
        </StrictMode>,
      );

      expect(container.querySelectorAll(".thread-row")).toHaveLength(
        rows.length,
      );
      expect(
        container.querySelector('[data-slot="tooltip-trigger"]'),
      ).toBeNull();
      expect(
        container.querySelector('[data-slot="popover-anchor"]'),
      ).toBeNull();
      expect(
        consoleErrorSpy.mock.calls.some((call) =>
          call.some((entry) =>
            /Maximum update depth exceeded|Minified React error #185/.test(
              String(entry),
            ),
          ),
        ),
      ).toBe(false);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("renders pinned rows and handles click/context menu", () => {
    const onSelectThread = vi.fn();
    const onShowThreadMenu = vi.fn();

    render(
      <PinnedThreadList
        {...baseProps}
        onSelectThread={onSelectThread}
        onShowThreadMenu={onShowThreadMenu}
      />,
    );

    const row = screen.getByText("Pinned Alpha").closest(".thread-row");
    expect(row).toBeTruthy();
    if (!row) {
      throw new Error("Missing pinned row");
    }
    expect(row.classList.contains("active")).toBe(true);
    expect(row.querySelector(".thread-status")?.className).toContain(
      "reviewing",
    );
    expect(row.querySelector(".thread-pin-toggle")).toBeTruthy();

    fireEvent.click(row);
    expect(onSelectThread).toHaveBeenCalledWith("ws-1", "thread-1");

    fireEvent.contextMenu(row);
    expect(onShowThreadMenu).toHaveBeenCalledWith(
      expect.anything(),
      "ws-1",
      "thread-1",
      true,
      undefined,
      undefined,
      null,
      true,
      "/tmp/ws-1",
    );
  });

  it("marks shared pinned rows as not archivable for the context menu", () => {
    const onShowThreadMenu = vi.fn();

    render(
      <PinnedThreadList
        {...baseProps}
        rows={[
          {
            thread: {
              ...thread,
              id: "shared:thread-1",
              threadKind: "shared",
            },
            depth: 0,
            workspaceId: "ws-1",
            workspacePath: "/tmp/ws-1",
          },
        ]}
        onShowThreadMenu={onShowThreadMenu}
      />,
    );

    const row = screen.getByText("Pinned Alpha").closest(".thread-row");
    expect(row).toBeTruthy();
    if (!row) {
      throw new Error("Missing shared pinned row");
    }

    fireEvent.contextMenu(row);
    expect(onShowThreadMenu).toHaveBeenCalledWith(
      expect.anything(),
      "ws-1",
      "shared:thread-1",
      true,
      undefined,
      undefined,
      null,
      false,
      "/tmp/ws-1",
    );
  });

  it("routes callbacks for rows across workspaces", () => {
    const onSelectThread = vi.fn();
    const onShowThreadMenu = vi.fn();

    render(
      <PinnedThreadList
        {...baseProps}
        rows={[
          { thread, depth: 0, workspaceId: "ws-1", workspacePath: "/tmp/ws-1" },
          {
            thread: otherThread,
            depth: 0,
            workspaceId: "ws-2",
            workspacePath: "/tmp/ws-2",
          },
        ]}
        onSelectThread={onSelectThread}
        onShowThreadMenu={onShowThreadMenu}
      />,
    );

    const secondRow = screen.getByText("Pinned Beta").closest(".thread-row");
    expect(secondRow).toBeTruthy();
    if (!secondRow) {
      throw new Error("Missing second pinned row");
    }

    fireEvent.click(secondRow);
    expect(onSelectThread).toHaveBeenCalledWith("ws-2", "thread-2");

    fireEvent.contextMenu(secondRow);
    expect(onShowThreadMenu).toHaveBeenCalledWith(
      expect.anything(),
      "ws-2",
      "thread-2",
      true,
      undefined,
      undefined,
      null,
      true,
      "/tmp/ws-2",
    );

    const engineBadge = secondRow.querySelector(".thread-engine-badge");
    expect(engineBadge?.classList.contains("is-processing")).toBe(true);
  });

  it("allows unpinning from pinned list without selecting the thread", () => {
    const onToggleThreadPin = vi.fn();
    const onSelectThread = vi.fn();

    const { container } = render(
      <PinnedThreadList
        {...baseProps}
        onToggleThreadPin={onToggleThreadPin}
        onSelectThread={onSelectThread}
      />,
    );

    const row = container.querySelector(".thread-row");
    expect(row).toBeTruthy();
    if (!row) {
      throw new Error("Missing pinned row");
    }
    const pinToggle = row.querySelector(".thread-pin-toggle");
    expect(pinToggle).toBeTruthy();
    if (!pinToggle) {
      throw new Error("Missing pin toggle");
    }

    fireEvent.click(pinToggle);
    expect(onToggleThreadPin).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(onSelectThread).not.toHaveBeenCalled();
  });

  it("shows auto naming loading badge for pinned thread", () => {
    render(
      <PinnedThreadList
        {...baseProps}
        isThreadAutoNaming={(workspaceId, threadId) =>
          workspaceId === "ws-1" && threadId === "thread-1"
        }
      />,
    );

    expect(screen.getByText("Auto naming...")).toBeTruthy();
  });

  it("shows a compact proxy badge on a processing pinned row even when workspace is inactive", () => {
    const { container } = render(
      <PinnedThreadList
        {...baseProps}
        rows={[
          {
            thread: otherThread,
            depth: 0,
            workspaceId: "ws-2",
            workspacePath: "/tmp/ws-2",
          },
        ]}
        activeWorkspaceId="ws-1"
        activeThreadId={null}
        systemProxyEnabled
        systemProxyUrl="http://127.0.0.1:7890"
      />,
    );

    const row = container.querySelector(".thread-row");
    const badge = row?.querySelector(".thread-proxy-badge");
    expect(badge).toBeTruthy();
    expect(badge?.textContent ?? "").toBe("");
    expect(badge?.classList.contains("proxy-status-badge--animated")).toBe(
      false,
    );
  });

  it("reuses workspace subagent row rendering for pinned children", () => {
    const onSelectThread = vi.fn();
    const parentThread: ThreadSummary = {
      ...thread,
      id: "claude:parent",
      name: "Pinned parent",
      engineSource: "claude",
    };
    const pendingChildThread: ThreadSummary = {
      id: "claude-pending-subagent:claude:parent:toolu_agent_1",
      name: "Pasteur",
      updatedAt: 900,
      parentThreadId: "claude:parent",
      engineSource: "claude",
    };

    render(
      <PinnedThreadList
        {...baseProps}
        activeThreadId="claude:parent"
        rows={[
          {
            thread: parentThread,
            depth: 0,
            hasChildren: true,
            workspaceId: "ws-1",
            workspacePath: "/tmp/ws-1",
          },
          {
            thread: pendingChildThread,
            depth: 1,
            workspaceId: "ws-1",
            workspacePath: "/tmp/ws-1",
          },
        ]}
        onSelectThread={onSelectThread}
      />,
    );

    const parentRow = screen.getByText("Pinned parent").closest(".thread-row");
    expect(parentRow?.classList.contains("is-subagent-parent")).toBe(true);
    fireEvent.click(
      parentRow?.querySelector(".thread-tree-expander") as HTMLElement,
    );

    const childRow = screen.getByText("Pasteur").closest(".thread-row");
    expect(childRow?.classList.contains("is-subagent")).toBe(true);
    expect(childRow?.classList.contains("is-pending-subagent")).toBe(true);
    expect(childRow?.querySelector(".thread-engine-badge")).toBeNull();
    expect(childRow?.querySelector(".thread-subagent-tag")?.textContent).toBe(
      "Subagent",
    );
    if (!childRow) {
      throw new Error("Missing pinned subagent row");
    }

    fireEvent.click(childRow);
    expect(onSelectThread).toHaveBeenCalledWith("ws-1", "claude:parent");
  });

  it("keeps an unchanged pinned row stable across unrelated status updates", () => {
    const renderCountByThreadId = new Map<string, number>();
    const rows = [
      { thread, depth: 0, workspaceId: "ws-1", workspacePath: "/tmp/ws-1" },
      {
        thread: otherThread,
        depth: 0,
        workspaceId: "ws-2",
        workspacePath: "/tmp/ws-2",
      },
    ];
    const onPinnedThreadRowRender = vi.fn((threadId: string) => {
      renderCountByThreadId.set(
        threadId,
        (renderCountByThreadId.get(threadId) ?? 0) + 1,
      );
    });

    const { rerender } = render(
      <PinnedThreadList
        {...baseProps}
        rows={rows}
        threadStatusById={{
          "thread-1": {
            isProcessing: false,
            hasUnread: true,
            isReviewing: false,
          },
          "thread-2": {
            isProcessing: false,
            hasUnread: false,
            isReviewing: false,
          },
        }}
        onPinnedThreadRowRender={onPinnedThreadRowRender}
      />,
    );

    expect(renderCountByThreadId.get("thread-1")).toBe(1);

    for (let index = 0; index < 1000; index += 1) {
      rerender(
        <PinnedThreadList
          {...baseProps}
          rows={rows}
          threadStatusById={{
            "thread-1": {
              isProcessing: false,
              hasUnread: true,
              isReviewing: false,
            },
            "thread-2": {
              isProcessing: index % 2 === 0,
              hasUnread: false,
              isReviewing: false,
            },
          }}
          onPinnedThreadRowRender={onPinnedThreadRowRender}
        />,
      );
    }

    expect(renderCountByThreadId.get("thread-1")).toBe(1);
    expect(onPinnedThreadRowRender).toHaveBeenCalledWith("thread-2");
  });

  it("hides codex provider metadata by default and keeps explicit pinned badges opt-in", () => {
    const { container, rerender } = render(
      <PinnedThreadList
        {...baseProps}
        rows={[
          {
            thread: {
              ...thread,
              sourceLabel: "project/openai",
            },
            depth: 0,
            workspaceId: "ws-1",
            workspacePath: "/tmp/ws-1",
          },
        ]}
      />,
    );

    expect(container.querySelector(".thread-provider-label")).toBeNull();

    rerender(
      <PinnedThreadList
        {...baseProps}
        showProviderLabels
        rows={[
          {
            thread: {
              ...thread,
              sourceLabel: "project/openai",
            },
            depth: 0,
            workspaceId: "ws-1",
            workspacePath: "/tmp/ws-1",
          },
        ]}
      />,
    );

    expect(screen.getByText("project/openai")).toBeTruthy();

    rerender(
      <PinnedThreadList
        {...baseProps}
        showProviderLabels
        rows={[
          {
            thread: {
              ...thread,
              engineSource: "codex",
              providerProfileId: "provider-a",
              providerProfileName: " ",
              sourceLabel: " ",
            },
            depth: 0,
            workspaceId: "ws-1",
            workspacePath: "/tmp/ws-1",
          },
        ]}
      />,
    );

    expect(screen.getByText("provider-a")).toBeTruthy();

    rerender(
      <PinnedThreadList
        {...baseProps}
        showProviderLabels
        rows={[
          {
            thread: {
              ...thread,
              engineSource: "codex",
              providerProfileId: "   ",
              providerProfileName: " ",
              sourceLabel: " ",
            },
            depth: 0,
            workspaceId: "ws-1",
            workspacePath: "/tmp/ws-1",
          },
        ]}
      />,
    );

    expect(container.querySelector(".thread-provider-label")).toBeNull();
  });
});
