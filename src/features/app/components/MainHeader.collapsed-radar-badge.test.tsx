// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MainHeader } from "./MainHeader";
import type { OpenAppMenuExtraAction } from "./OpenAppMenu";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params && params.count !== undefined ? `${key}:${String(params.count)}` : key,
  }),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: vi.fn(),
}));

const workspace = {
  id: "w1",
  name: "Workspace 1",
  path: "/tmp/w1",
  connected: true,
  settings: {
    sidebarCollapsed: false,
  },
};

function buildRightPanelAction(
  overrides: Partial<OpenAppMenuExtraAction> = {},
): OpenAppMenuExtraAction {
  return {
    id: "right-panel",
    label: "sidebar.showGitSidebar",
    icon: <span data-testid="right-panel-icon" />,
    onSelect: vi.fn(),
    rightPanelExpandAffordance: true,
    ...overrides,
  };
}

function renderHeader(extraActions: OpenAppMenuExtraAction[]) {
  return render(
    <MainHeader
      workspace={workspace}
      openTargets={[]}
      openAppIconById={{}}
      selectedOpenAppId=""
      onSelectOpenAppId={() => {}}
      openAppExtraActions={extraActions}
    />,
  );
}

describe("MainHeader collapsed radar running badge", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("folds the running count into the toggle accessible name", () => {
    renderHeader([buildRightPanelAction({ badgeCount: 2 })]);

    const toggle = screen.getByRole("button", {
      name: "sidebar.showGitSidebar · activityPanel.collapsedLiveBadge:2",
    });
    const badge = toggle.querySelector(".main-header-action-badge");
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute("aria-hidden")).toBe("true");
    expect(badge?.textContent).toBe("2");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps the toggle clickable and does not auto-expand by itself", () => {
    const action = buildRightPanelAction({ badgeCount: 3 });
    renderHeader([action]);

    const toggle = screen.getByRole("button", {
      name: "sidebar.showGitSidebar · activityPanel.collapsedLiveBadge:3",
    });
    expect(action.onSelect).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    expect(action.onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders no badge when there are no running sessions", () => {
    renderHeader([buildRightPanelAction({ badgeCount: 0 })]);

    const toggle = screen.getByRole("button", { name: "sidebar.showGitSidebar" });
    expect(toggle.querySelector(".main-header-action-badge")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders no badge when the action carries no badge data", () => {
    renderHeader([buildRightPanelAction()]);

    const toggle = screen.getByRole("button", { name: "sidebar.showGitSidebar" });
    expect(toggle.querySelector(".main-header-action-badge")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("caps the displayed count at 99+ while the label keeps the real count", () => {
    renderHeader([buildRightPanelAction({ badgeCount: 128 })]);

    const toggle = screen.getByRole("button", {
      name: "sidebar.showGitSidebar · activityPanel.collapsedLiveBadge:128",
    });
    const badge = toggle.querySelector(".main-header-action-badge");
    expect(badge?.textContent).toBe("99+");
  });
});
