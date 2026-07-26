// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCliVersionStatus } from "../hooks/useCliVersionStatus";
import {
  CliLifecycleHeaderActions,
  CliLifecycleProvider,
} from "./CliLifecycleHeaderActions";

vi.mock("../hooks/useCliVersionStatus", () => ({
  useCliVersionStatus: vi.fn(),
}));

vi.mock("@/features/settings/hooks/useCliInstallLifecycle", () => ({
  useCliInstallLifecycle: vi.fn(() => ({
    installerState: null,
    installerNowMs: 0,
    isBusy: false,
    requestInstallPlan: vi.fn(),
    confirmInstallRun: vi.fn(),
    cancelInstaller: vi.fn(),
  })),
}));

const useCliVersionStatusMock = vi.mocked(useCliVersionStatus);

function renderHeader(
  status: {
    localVersion: string | null;
    latestVersion: string | null;
    updateAvailable: boolean;
  },
) {
  useCliVersionStatusMock.mockReturnValue({
    status: {
      engine: "claude",
      installed: true,
      nodeOk: true,
      details: null,
      ...status,
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  });

  render(
    <CliLifecycleProvider engine="claude" active>
      <CliLifecycleHeaderActions />
    </CliLifecycleProvider>,
  );
}

describe("CliLifecycleHeaderActions", () => {
  beforeEach(() => {
    useCliVersionStatusMock.mockReset();
  });

  it("does not claim the CLI is current when the latest version is unknown", () => {
    renderHeader({
      localVersion: "2.0.52 (Claude Code)",
      latestVersion: null,
      updateAvailable: false,
    });

    expect(document.querySelectorAll('[data-slot="badge"]')).toHaveLength(1);
    expect(screen.queryByText("Up to date")).toBeNull();
  });

  it("shows the available version and update action when an update exists", () => {
    renderHeader({
      localVersion: "2.0.52 (Claude Code)",
      latestVersion: "2.0.53",
      updateAvailable: true,
    });

    expect(screen.getByText("→ 2.0.53")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "settings.cliUpdateLatest" }),
    ).toBeTruthy();
  });

  it("shows current status only after the latest version is known", () => {
    renderHeader({
      localVersion: "2.0.53 (Claude Code)",
      latestVersion: "2.0.53",
      updateAvailable: false,
    });

    expect(screen.getByText("Up to date")).toBeTruthy();
  });
});
