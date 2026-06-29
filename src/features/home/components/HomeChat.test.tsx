// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeChat } from "./HomeChat";

const translations: Record<string, string> = {
  "home.newConversation": "New Conversation",
  "homeChat.minimalTitle": "Create anything",
  "homeChat.workspaceSelectLabel": "Workspace",
  "workspace.homeBranchLabelMain": "Primary branch",
  "workspace.homeBranchLabelWorktree": "Worktree",
  "homeChat.recentConversations": "Recent conversations",
  "homeChat.loadingRecentAgents": "Loading recent work",
  "workspace.unknownBranch": "unknown",
};

function translate(key: string, params?: string | Record<string, string | number>) {
  const template = translations[key] ?? key;
  if (!params || typeof params === "string") {
    return template;
  }

  return Object.entries(params).reduce(
    (acc, [paramKey, value]) => acc.replace(new RegExp(`{{${paramKey}}}`, "g"), String(value)),
    template,
  );
}

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: translate,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

const baseProps = {
  latestAgentRuns: [],
  isLoadingLatestAgents: false,
  onSelectThread: vi.fn(),
  onSelectWorkspace: vi.fn(),
  onAddWorkspace: vi.fn(),
  composerNode: <div>Composer node</div>,
  selectedEngine: "claude" as const,
  selectedWorkspaceId: "ws-1",
  branchControl: {
    branchName: "feature/ref-layout",
    branches: [{ name: "feature/ref-layout", lastCommit: 1 }],
    onCheckout: vi.fn(),
    onCreate: vi.fn(),
  },
  workspaces: [
    { id: "ws-1", name: "desktop-cc-gui", path: "/Users/demo/Desktop/desktop-cc-gui", kind: "main" as const },
    { id: "ws-2", name: "workfree", path: "/Users/demo/Desktop/workfree", kind: "worktree" as const, worktree: { branch: "feature/workfree" } },
  ],
};

describe("HomeChat", () => {
  it("renders the compact hero, workspace selector, and composer host", () => {
    const markup = renderToStaticMarkup(<HomeChat {...baseProps} />);

    expect(markup).toContain("Create anything");
    expect(markup).toContain("desktop-cc-gui");
    expect(markup).toContain("home-chat-workspace-select");
    expect(markup).toContain("composer-branch-badge-trigger");
    expect(markup).toContain('aria-label="Workspace"');
    expect(markup).toContain("composer-branch-badge");
    expect(markup).toContain("feature/ref-layout");
    expect(markup).toContain("Composer node");
    expect(markup).toContain("home-chat-engine-mark");
    expect(markup).toContain("home-chat-composer-meta");
  });

  it("keeps the composer mounted inside the dedicated host container", () => {
    const markup = renderToStaticMarkup(<HomeChat {...baseProps} />);

    expect(markup).toContain("home-chat-composer-host");
    expect(markup).toContain("Composer node");
  });

  it("shows the workspace name in the trigger instead of the full path", () => {
    const markup = renderToStaticMarkup(
      <HomeChat
        {...baseProps}
        selectedWorkspaceId="80ad34fc-f38d-4023-8bb5-3073b0f3e001"
        workspaces={[
          {
            id: "80ad34fc-f38d-4023-8bb5-3073b0f3e001",
            name: "desktop-cc-gui",
            path: "/Users/demo/Desktop/desktop-cc-gui",
            kind: "main",
          },
        ]}
      />,
    );

    expect(markup).toMatch(
      /composer-branch-badge-name">desktop-cc-gui<\/span>/,
    );
    expect(markup).not.toContain("/Users/demo/Desktop/desktop-cc-gui");
  });

  it("hides the workspace summary when no workspace options are available", () => {
    const markup = renderToStaticMarkup(
      <HomeChat
        {...baseProps}
        selectedWorkspaceId={null}
        workspaces={[]}
      />,
    );

    expect(markup).not.toContain("home-chat-composer-meta");
  });

  it("does not render a branch badge when branch data is unavailable", () => {
    const markup = renderToStaticMarkup(
      <HomeChat
        {...baseProps}
        branchControl={null}
        workspaces={[
          {
            id: "ws-1",
            name: "desktop-cc-gui",
            path: "/Users/demo/Desktop/desktop-cc-gui",
            kind: "main",
          },
        ]}
      />,
    );

    // 工作区选择器现已复用 composer-branch-badge 视觉，分支胶囊的独有标识是 git-branch 图标
    expect(markup).not.toContain("lucide-git-branch");
  });

  it("keeps New Home creation-first without a runtime dashboard", () => {
    const markup = renderToStaticMarkup(<HomeChat {...baseProps} />);

    expect(markup).toContain("Composer node");
    expect(markup).not.toContain("Run cockpit");
    expect(markup).not.toContain("What the agents are doing");
    expect(markup).not.toContain("home-chat-run-card");
    expect(markup).not.toContain("home-chat-run-detail");
  });

  it("does not render recent conversations on the home page", () => {
    const handleSelectThread = vi.fn();

    render(
      <HomeChat
        {...baseProps}
        onSelectThread={handleSelectThread}
        latestAgentRuns={[{
          workspaceId: "ws-1",
          threadId: "thread-1",
          projectName: "desktop-cc-gui",
          message: "Follow up",
          timestamp: 1,
          isProcessing: false,
        }]}
      />,
    );

    expect(screen.queryByText("Follow up")).toBeNull();
    expect(screen.queryByText("Recent conversations")).toBeNull();
    expect(handleSelectThread).not.toHaveBeenCalled();
  });
});


describe("HomeChat workspace picker virtualization", () => {
  it("renders a bounded DOM row count when 200 workspaces are present", () => {
    const longWorkspaces = Array.from({ length: 200 }, (_, index) => ({
      id: `ws-virt-${index}`,
      name: `workspace-${index}`,
      path: `/tmp/workspace-${index}`,
      kind: "main" as const,
    }));
    render(
      <HomeChat
        {...baseProps}
        workspaces={longWorkspaces}
        selectedWorkspaceId={longWorkspaces[0]?.id ?? null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    const list = screen
      .getByRole("list", { name: "Workspace" })
      ?.parentElement?.querySelector(".home-chat-workspace-picker-list");
    expect(list).toBeTruthy();
    expect(list?.getAttribute("data-virtualized")).toBe("true");
    const spacer = document.querySelector(".home-chat-workspace-picker-virtual-spacer");
    expect(spacer).toBeTruthy();
    // The whole point of virtualization: with 200 workspaces, the DOM
    // MUST NOT mount all 200 .home-chat-workspace-picker-item elements.
    const mountedItems = document.querySelectorAll(
      ".home-chat-workspace-picker-item",
    ).length;
    expect(mountedItems).toBeLessThan(200);
  });

  it("exposes a 100-row virtualization threshold and bounded item-key derivation", async () => {
    const helpers = await import("./HomeChatVirtualization");
    expect(helpers.HOME_CHAT_WORKSPACE_VIRTUALIZATION_MIN_ROWS).toBe(100);
    expect(helpers.shouldVirtualizeWorkspaceList(99)).toBe(false);
    expect(helpers.shouldVirtualizeWorkspaceList(100)).toBe(true);
    expect(helpers.shouldVirtualizeWorkspaceList(200)).toBe(true);
    // Item key derivation MUST be stable per workspace id, never index.
    expect(
      helpers.resolveWorkspaceVirtualItemKey(
        [{ id: "ws-1", name: "alpha" }, { id: "ws-2", name: "beta" }],
        0,
      ),
    ).toBe("ws-1");
    expect(
      helpers.resolveWorkspaceVirtualItemKey(
        [{ id: "ws-1", name: "alpha" }, { id: "ws-2", name: "beta" }],
        1,
      ),
    ).toBe("ws-2");
    expect(
      helpers.resolveWorkspaceVirtualItemKey([], 0),
    ).toMatch(/^workspace-fallback-/);
  });
});
