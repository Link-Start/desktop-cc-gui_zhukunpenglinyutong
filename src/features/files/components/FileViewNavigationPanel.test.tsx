/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileViewNavigationPanel } from "./FileViewNavigationPanel";

vi.mock("../../../utils/platform", () => ({
  isMacPlatform: () => true,
  isWindowsPlatform: () => false,
}));

describe("FileViewNavigationPanel installation recovery", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the macOS Java install command and retries after installation", () => {
    const onRetryNavigation = vi.fn();
    render(
      <FileViewNavigationPanel
        workspacePath="/repo"
        navigationError={null}
        navigationStatus={{
          action: "definition",
          phase: "fallback",
          locations: [],
          mode: "fast-search",
          provider: "heuristic",
          lifecycle: "degraded",
          language: "Java",
          fallbackReasonCode: "provider-unavailable",
        }}
        onRetryNavigation={onRetryNavigation}
        definitionCandidates={[]}
        onCloseDefinitionCandidates={vi.fn()}
        implementationCandidates={[]}
        onCloseImplementationCandidates={vi.fn()}
        referenceResults={[]}
        onCloseReferenceResults={vi.fn()}
        onNavigateToLocation={vi.fn()}
        t={(key) => key}
      />,
    );

    expect(screen.getByText("brew install jdtls")).toBeTruthy();
    expect(screen.getByText(/files\.navigationLanguageServerMissing · Java/)).toBeTruthy();
    expect(screen.getByText(/files\.navigationInstallCommand · macOS/)).toBeTruthy();
    expect(screen.queryByText("files.navigationFallbackNotice")).toBeNull();
    fireEvent.click(screen.getByRole("button", {
      name: "files.navigationRetryAfterInstall",
    }));
    expect(onRetryNavigation).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["Python", "npm install -g pyright"],
    ["Go", "go install golang.org/x/tools/gopls@latest"],
  ])("shows the external %s provider install command", (language, command) => {
    render(
      <FileViewNavigationPanel
        workspacePath="/repo"
        navigationError={null}
        navigationStatus={{
          action: "references",
          phase: "fallback",
          locations: [],
          mode: "fast-search",
          provider: "heuristic",
          lifecycle: "degraded",
          language,
          fallbackReasonCode: "provider-unavailable",
        }}
        onRetryNavigation={vi.fn()}
        definitionCandidates={[]}
        onCloseDefinitionCandidates={vi.fn()}
        implementationCandidates={[]}
        onCloseImplementationCandidates={vi.fn()}
        referenceResults={[]}
        onCloseReferenceResults={vi.fn()}
        onNavigateToLocation={vi.fn()}
        t={(key) => key}
      />,
    );

    expect(screen.getByText(command)).toBeTruthy();
    expect(
      screen.getByText(new RegExp(`files\\.navigationLanguageServerMissing · ${language}`)),
    ).toBeTruthy();
  });
});
