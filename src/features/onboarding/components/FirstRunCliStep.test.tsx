/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EngineStatus, EngineType } from "../../../types";
import { FirstRunCliStep } from "./FirstRunCliStep";

function engineStatus(
  engineType: EngineType,
  overrides: Partial<Omit<EngineStatus, "engineType">> = {},
): EngineStatus {
  return {
    engineType,
    installed: false,
    version: null,
    binPath: null,
    features: {
      streaming: false,
      imageInput: false,
    },
    models: [],
    error: null,
    ...overrides,
  };
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.version ? `${key}:${params.version}` : key,
  }),
}));

describe("FirstRunCliStep", () => {
  it("keeps short version inside the selected engine card without a test action", () => {
    render(
      <FirstRunCliStep
        selectedEngine="claude"
        onSelectEngine={vi.fn()}
        engineStatuses={[
          engineStatus("claude", {
            installed: true,
            version: "2.1.228 (Claude Code)",
            binPath: "/usr/local/bin/claude",
          }),
        ]}
        cardStateByEngine={{
          claude: {
            installed: true,
            validated: false,
            version: "2.1.228 (Claude Code)",
            busy: false,
            error: null,
          },
        }}
        onInstall={vi.fn()}
        detecting={false}
      />,
    );

    const selected = document.querySelector(".first-run-engine-block.is-selected");
    expect(selected).not.toBeNull();
    expect(selected?.textContent).toContain("onboarding.cli.version:2.1.228");
    expect(selected?.textContent).not.toContain("Claude Code)");
    expect(selected?.querySelector(".first-run-choice-title-row .first-run-status-dot")).not.toBeNull();
    expect(selected?.querySelector(".first-run-secondary")).toBeNull();
    expect(screen.queryByRole("button", { name: "onboarding.cli.validate" })).toBeNull();
  });

  it("shows short versions for every installed engine", () => {
    render(
      <FirstRunCliStep
        selectedEngine="claude"
        onSelectEngine={vi.fn()}
        engineStatuses={[
          engineStatus("claude", {
            installed: true,
            version: "2.1.228 (Claude Code)",
            binPath: "/usr/local/bin/claude",
          }),
          engineStatus("codex", {
            installed: true,
            version: "codex-cli 0.98.0",
            binPath: "/usr/local/bin/codex",
          }),
        ]}
        cardStateByEngine={{
          claude: {
            installed: true,
            validated: false,
            version: "2.1.228 (Claude Code)",
            busy: false,
            error: null,
          },
        }}
        onInstall={vi.fn()}
        detecting={false}
      />,
    );

    expect(screen.getByText("onboarding.cli.version:2.1.228")).not.toBeNull();
    expect(screen.getByText("onboarding.cli.version:0.98.0")).not.toBeNull();
    expect(document.querySelectorAll(".first-run-choice-title-row .first-run-status-dot")).toHaveLength(2);
    expect(screen.queryByText("onboarding.cli.statusInstalled", { selector: ":not(.sr-only)" })).toBeNull();
  });

  it("shows a spinning status icon instead of checking copy", () => {
    render(
      <FirstRunCliStep
        selectedEngine="claude"
        onSelectEngine={vi.fn()}
        engineStatuses={[]}
        cardStateByEngine={{}}
        onInstall={vi.fn()}
        detecting
      />,
    );

    expect(screen.getAllByLabelText("onboarding.cli.statusChecking")).toHaveLength(5);
    expect(
      screen.queryByText("onboarding.cli.statusChecking", { selector: ":not(.sr-only)" }),
    ).toBeNull();
    expect(document.querySelectorAll(".first-run-status-spinner.animate-spin")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /onboarding.cli.install$/ })).toBeNull();
  });

  it("shows the five primary engines by default", () => {
    render(
      <FirstRunCliStep
        selectedEngine="claude"
        onSelectEngine={vi.fn()}
        engineStatuses={[]}
        cardStateByEngine={{}}
        onInstall={vi.fn()}
        detecting={false}
      />,
    );

    expect(screen.getByText("onboarding.engine.claude.title")).not.toBeNull();
    expect(screen.getByText("onboarding.engine.codex.title")).not.toBeNull();
    expect(screen.getByText("onboarding.engine.dsh.title")).not.toBeNull();
    expect(screen.getByText("onboarding.engine.kimi.title")).not.toBeNull();
    expect(screen.getByText("onboarding.engine.opencode.title")).not.toBeNull();
    expect(screen.queryByText("onboarding.engine.grok.title")).toBeNull();
    expect(screen.queryByText("onboarding.engine.pi.title")).toBeNull();
    expect(screen.queryByText("onboarding.engine.claude.hint")).toBeNull();
  });

  it("turns missing status into an in-card install action without probe noise", () => {
    const onSelectEngine = vi.fn();
    const onInstall = vi.fn();
    render(
      <FirstRunCliStep
        selectedEngine="opencode"
        onSelectEngine={onSelectEngine}
        engineStatuses={[
          engineStatus("opencode", {
            error:
              "Failed to execute opencode: No such file or directory (os error 2)",
          }),
        ]}
        cardStateByEngine={{
          opencode: {
            installed: false,
            validated: false,
            version: null,
            busy: false,
            error:
              "Failed to execute opencode: No such file or directory (os error 2)",
          },
        }}
        onInstall={onInstall}
        detecting={false}
      />,
    );

    const selected = document.querySelector(".first-run-engine-block.is-selected");
    expect(selected?.classList.contains("is-missing")).toBe(true);
    expect(selected?.querySelector(".first-run-install-chip")).not.toBeNull();
    expect(screen.queryByText("onboarding.cli.statusMissing")).toBeNull();
    expect(screen.queryByText(/Failed to execute opencode/)).toBeNull();
    expect(document.querySelector(".first-run-engine-error")).toBeNull();
    expect(document.querySelector(".first-run-secondary")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "onboarding.engine.opencode.title" }),
    );
    expect(onSelectEngine).toHaveBeenCalledWith("opencode");
    expect(onInstall).not.toHaveBeenCalled();

    fireEvent.click(selected as HTMLElement);
    expect(onInstall).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "onboarding.engine.opencode.title onboarding.cli.install",
      }),
    );
    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(onInstall).toHaveBeenCalledWith("opencode");
  });

  it("still shows a real install failure under the selected missing engine", () => {
    render(
      <FirstRunCliStep
        selectedEngine="opencode"
        onSelectEngine={vi.fn()}
        engineStatuses={[engineStatus("opencode")]}
        cardStateByEngine={{
          opencode: {
            installed: false,
            validated: false,
            version: null,
            busy: false,
            error: "onboarding.cli.installFailed",
          },
        }}
        onInstall={vi.fn()}
        detecting={false}
      />,
    );

    expect(screen.getByText("onboarding.cli.installFailed")).not.toBeNull();
    expect(document.querySelector(".first-run-engine-error")).not.toBeNull();
  });
});
