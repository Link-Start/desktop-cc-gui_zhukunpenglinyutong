/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UsageDashboardSection } from "./UsageDashboardSection";

const mocks = vi.hoisted(() => ({
  ttDetectCli: vi.fn(),
  ttEnsureServer: vi.fn(),
  ttInstallCli: vi.fn(),
  language: "en" as string,
}));

vi.mock("@/services/tauri", () => ({
  ttDetectCli: mocks.ttDetectCli,
  ttEnsureServer: mocks.ttEnsureServer,
  ttInstallCli: mocks.ttInstallCli,
}));

// 懒加载边界：用 stub 替换整个 dashboard chunk，避免在单测里拉起 vendored 树
// （motion / @base-ui / copy 字典等整条依赖链）。
vi.mock("./TokenTrackerDashboardView", () => ({
  default: () => <div data-testid="tt-dashboard-stub" />,
}));

const translations = vi.hoisted(
  (): Record<string, string> => ({
    "extensions.usage.checkingLabel": "Checking for tokentracker-cli…",
    "extensions.usage.installingLabel": "Installing tokentracker-cli…",
    "extensions.usage.installingDesc": "This may take a minute.",
    "extensions.usage.startingLabel": "Starting the tokentracker server…",
    "extensions.usage.guideTitle": "Install tokentracker-cli to see usage stats",
    "extensions.usage.guideDesc": "Usage stats are provided by tokentracker-cli.",
    "extensions.usage.guideInstallLabel": "Install command",
    "extensions.usage.guideInstallNow": "Install now",
    "extensions.usage.guideCopy": "Copy",
    "extensions.usage.guideCopied": "Copied",
    "extensions.usage.guideOpenNpm": "Open npm page",
    "extensions.usage.guideRecheck": "Re-check",
    "extensions.usage.guideNoteHooks": "Hooks note",
    "extensions.usage.guideNoteTelemetry": "Telemetry note",
    "extensions.usage.errorTitle": "Failed to start the tokentracker server",
    "extensions.usage.errorRetry": "Retry",
  }),
);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
    i18n: { language: mocks.language },
  }),
}));

const INSTALLED_CLI = { installed: true, version: "1.2.3", binPath: "/usr/local/bin/tokentracker" };
const MISSING_CLI = { installed: false, version: null, binPath: null };
const RUNNING_SERVER = { running: true, port: 7680 };

describe("UsageDashboardSection", () => {
  beforeEach(() => {
    mocks.ttDetectCli.mockReset();
    mocks.ttEnsureServer.mockReset();
    mocks.ttInstallCli.mockReset();
    mocks.language = "en";
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    // 默认模拟 Tauri 运行时（走 detect/ensure 链路）
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {},
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it("skips detection and mounts the dashboard directly outside Tauri (vite dev preview)", async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;

    render(<UsageDashboardSection />);

    expect(await screen.findByTestId("tt-dashboard-stub")).toBeTruthy();
    expect(mocks.ttDetectCli).not.toHaveBeenCalled();
    expect(mocks.ttEnsureServer).not.toHaveBeenCalled();
    expect(mocks.ttInstallCli).not.toHaveBeenCalled();
  });

  it("shows the checking state while CLI detection is pending", () => {
    mocks.ttDetectCli.mockReturnValue(new Promise(() => {}));

    render(<UsageDashboardSection />);

    expect(screen.getByRole("status").textContent).toContain(
      "Checking for tokentracker-cli…",
    );
  });

  it("renders the install guide when the CLI is not installed", async () => {
    mocks.ttDetectCli.mockResolvedValue(MISSING_CLI);

    render(<UsageDashboardSection />);

    expect(
      await screen.findByText("Install tokentracker-cli to see usage stats"),
    ).toBeTruthy();
    expect(screen.getByText("npm i -g tokentracker-cli")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Install now" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open npm page" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Re-check" })).toBeNull();
    expect(screen.getByText("Hooks note")).toBeTruthy();
    expect(screen.getByText("Telemetry note")).toBeTruthy();
    expect(mocks.ttEnsureServer).not.toHaveBeenCalled();
  });

  it("installs from the guide and mounts the dashboard after install succeeds", async () => {
    let resolveInstall: (value: typeof INSTALLED_CLI) => void = () => {};
    mocks.ttDetectCli
      .mockResolvedValueOnce(MISSING_CLI)
      .mockResolvedValueOnce(INSTALLED_CLI);
    mocks.ttInstallCli.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveInstall = resolve;
      }),
    );
    mocks.ttEnsureServer.mockResolvedValueOnce(RUNNING_SERVER);
    render(<UsageDashboardSection />);
    await screen.findByText("Install tokentracker-cli to see usage stats");

    fireEvent.click(screen.getByRole("button", { name: "Install now" }));

    expect(await screen.findByText("Installing tokentracker-cli…")).toBeTruthy();
    await act(async () => {
      resolveInstall(INSTALLED_CLI);
    });
    expect(await screen.findByTestId("tt-dashboard-stub")).toBeTruthy();
    expect(mocks.ttInstallCli).toHaveBeenCalledTimes(1);
    expect(mocks.ttDetectCli).toHaveBeenCalledTimes(2);
    expect(mocks.ttEnsureServer).toHaveBeenCalledTimes(1);
  });

  it("shows an error when the one-click install fails", async () => {
    mocks.ttDetectCli.mockResolvedValueOnce(MISSING_CLI);
    mocks.ttInstallCli.mockRejectedValueOnce(new Error("npm permission denied"));
    render(<UsageDashboardSection />);
    await screen.findByText("Install tokentracker-cli to see usage stats");

    fireEvent.click(screen.getByRole("button", { name: "Install now" }));

    expect(
      await screen.findByText("Failed to start the tokentracker server"),
    ).toBeTruthy();
    expect(screen.getByText("npm permission denied")).toBeTruthy();
  });

  it("copies the install command from the guide", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    mocks.ttDetectCli.mockResolvedValue(MISSING_CLI);
    render(<UsageDashboardSection />);
    await screen.findByText("Install tokentracker-cli to see usage stats");

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith("npm i -g tokentracker-cli");
  });

  it("shows the guide when ensure reports the CLI went missing", async () => {
    mocks.ttDetectCli.mockResolvedValue(INSTALLED_CLI);
    mocks.ttEnsureServer.mockRejectedValue("tokentracker_cli_not_installed");

    render(<UsageDashboardSection />);

    expect(
      await screen.findByText("Install tokentracker-cli to see usage stats"),
    ).toBeTruthy();
  });

  it("shows the error card when ensure fails and recovers via retry", async () => {
    mocks.ttDetectCli.mockResolvedValue(INSTALLED_CLI);
    mocks.ttEnsureServer.mockRejectedValueOnce(new Error("port 7680 busy"));

    render(<UsageDashboardSection />);

    expect(
      await screen.findByText("Failed to start the tokentracker server"),
    ).toBeTruthy();
    expect(screen.getByText("port 7680 busy")).toBeTruthy();

    mocks.ttEnsureServer.mockResolvedValueOnce(RUNNING_SERVER);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByTestId("tt-dashboard-stub")).toBeTruthy();
    expect(mocks.ttEnsureServer).toHaveBeenCalledTimes(2);
  });

  it("lazily renders the dashboard and syncs locale/theme bridge storage", async () => {
    mocks.language = "zh";
    document.documentElement.dataset.theme = "dim";
    mocks.ttDetectCli.mockResolvedValue(INSTALLED_CLI);
    mocks.ttEnsureServer.mockResolvedValue(RUNNING_SERVER);

    render(<UsageDashboardSection />);

    expect(await screen.findByTestId("tt-dashboard-stub")).toBeTruthy();
    expect(localStorage.getItem("tokentracker-locale")).toBe("zh-CN");
    // dim 归并到 dark
    expect(localStorage.getItem("tokentracker-theme")).toBe("dark");
  });

  it("maps unsupported app languages to the en dashboard locale", async () => {
    mocks.language = "fr";
    mocks.ttDetectCli.mockResolvedValue(INSTALLED_CLI);
    mocks.ttEnsureServer.mockResolvedValue(RUNNING_SERVER);

    render(<UsageDashboardSection />);

    expect(await screen.findByTestId("tt-dashboard-stub")).toBeTruthy();
    expect(localStorage.getItem("tokentracker-locale")).toBe("en");
    expect(localStorage.getItem("tokentracker-theme")).toBe("system");
  });
});
