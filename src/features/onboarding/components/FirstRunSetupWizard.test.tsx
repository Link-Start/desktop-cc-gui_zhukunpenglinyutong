/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EngineStatus, EngineType } from "../../../types";
import { EMPTY_FIRST_RUN_SETUP_PROFILE } from "../types";
import { FirstRunSetupWizard } from "./FirstRunSetupWizard";

function installedStatus(
  engineType: EngineType,
  version: string,
): EngineStatus {
  return {
    engineType,
    installed: true,
    version,
    binPath: `/usr/local/bin/${engineType}`,
    features: {
      streaming: false,
      imageInput: false,
    },
    models: [],
    error: null,
  };
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../assets/icon.png", () => ({
  default: "icon.png",
}));

vi.mock("./FirstRunFluidBackdrop", () => ({
  FirstRunFluidBackdrop: () => (
    <div data-testid="first-run-fluid" aria-hidden />
  ),
}));

const translationsClick = (
  key: string,
  onClick: () => void,
) => {
  fireEvent.click(screen.getByRole("button", { name: key }));
  expect(onClick).toHaveBeenCalled();
};

describe("FirstRunSetupWizard", () => {
  it("starts from welcome and continues into the editor step", () => {
    const onContinueFromWelcome = vi.fn();
    render(
      <FirstRunSetupWizard
        profile={EMPTY_FIRST_RUN_SETUP_PROFILE}
        step="welcome"
        onStepChange={vi.fn()}
        onIdeChange={vi.fn()}
        selectedEngine="claude"
        onSelectEngine={vi.fn()}
        engineStatuses={[]}
        cardStateByEngine={{}}
        onInstall={vi.fn()}
        detecting={false}
        onContinueFromWelcome={onContinueFromWelcome}
        onSkipCli={vi.fn()}
        onEnterApp={vi.fn()}
      />,
    );

    expect(screen.getByTestId("first-run-setup")).not.toBeNull();
    expect(screen.getByTestId("first-run-fluid")).not.toBeNull();
    expect(screen.getByTestId("first-run-progress").querySelectorAll("span")).toHaveLength(4);
    expect(screen.getByText("onboarding.welcome.title")).not.toBeNull();
    expect(screen.getByRole("button", { name: "onboarding.common.skipAll" })).not.toBeNull();
    translationsClick("onboarding.welcome.start", onContinueFromWelcome);
  });

  it("offers VS Code, Cursor, IntelliJ, and unused on the IDE step", () => {
    render(
      <FirstRunSetupWizard
        profile={EMPTY_FIRST_RUN_SETUP_PROFILE}
        step="ide"
        onStepChange={vi.fn()}
        onIdeChange={vi.fn()}
        selectedEngine="claude"
        onSelectEngine={vi.fn()}
        engineStatuses={[]}
        cardStateByEngine={{}}
        onInstall={vi.fn()}
        detecting={false}
        onContinueFromWelcome={vi.fn()}
        onSkipCli={vi.fn()}
        onEnterApp={vi.fn()}
      />,
    );

    expect(screen.getByText("onboarding.ide.vscode.title")).not.toBeNull();
    expect(screen.getByText("onboarding.ide.cursor.title")).not.toBeNull();
    expect(screen.getByText("onboarding.ide.idea.title")).not.toBeNull();
    expect(screen.getByText("onboarding.ide.none.title")).not.toBeNull();
    expect(screen.queryByText("onboarding.ide.zed.title")).toBeNull();
    expect(screen.queryByText("onboarding.ide.sublime.title")).toBeNull();
  });

  it("requires an editor before continue", () => {
    const onStepChange = vi.fn();
    render(
      <FirstRunSetupWizard
        profile={EMPTY_FIRST_RUN_SETUP_PROFILE}
        step="ide"
        onStepChange={onStepChange}
        onIdeChange={vi.fn()}
        selectedEngine="claude"
        onSelectEngine={vi.fn()}
        engineStatuses={[]}
        cardStateByEngine={{}}
        onInstall={vi.fn()}
        detecting={false}
        onContinueFromWelcome={vi.fn()}
        onSkipCli={vi.fn()}
        onEnterApp={vi.fn()}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "onboarding.common.continue" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("skips CLI setup when nothing is validated", () => {
    const onSkipCli = vi.fn();
    render(
      <FirstRunSetupWizard
        profile={EMPTY_FIRST_RUN_SETUP_PROFILE}
        step="cli"
        onStepChange={vi.fn()}
        onIdeChange={vi.fn()}
        selectedEngine="claude"
        onSelectEngine={vi.fn()}
        engineStatuses={[]}
        cardStateByEngine={{}}
        onInstall={vi.fn()}
        detecting={false}
        onContinueFromWelcome={vi.fn()}
        onSkipCli={onSkipCli}
        onEnterApp={vi.fn()}
      />,
    );

    translationsClick("onboarding.cli.skip", onSkipCli);
  });

  it("lets an installed CLI continue without a test action", () => {
    const onSkipCli = vi.fn();
    const onEnterApp = vi.fn();
    const onStepChange = vi.fn();
    render(
      <FirstRunSetupWizard
        profile={{
          ...EMPTY_FIRST_RUN_SETUP_PROFILE,
          preferredIde: "vscode",
          step: "cli",
        }}
        step="cli"
        onStepChange={onStepChange}
        onIdeChange={vi.fn()}
        selectedEngine="claude"
        onSelectEngine={vi.fn()}
        engineStatuses={[installedStatus("claude", "2.1.228")]}
        cardStateByEngine={{
          claude: {
            installed: true,
            validated: false,
            version: "2.1.228",
            busy: false,
            error: null,
          },
        }}
        onInstall={vi.fn()}
        detecting={false}
        onContinueFromWelcome={vi.fn()}
        onSkipCli={onSkipCli}
        onEnterApp={onEnterApp}
      />,
    );

    expect(screen.getByRole("button", { name: "onboarding.cli.continueReady" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "onboarding.common.back" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "onboarding.cli.enterLater" })).toBeNull();
    translationsClick("onboarding.common.skipAll", onEnterApp);
    expect(onSkipCli).not.toHaveBeenCalled();
    expect(onStepChange).not.toHaveBeenCalled();
  });

  it("lets every step skip the rest of setup and enter the app", () => {
    const onEnterApp = vi.fn();
    const { rerender } = render(
      <FirstRunSetupWizard
        profile={EMPTY_FIRST_RUN_SETUP_PROFILE}
        step="welcome"
        onStepChange={vi.fn()}
        onIdeChange={vi.fn()}
        selectedEngine="claude"
        onSelectEngine={vi.fn()}
        engineStatuses={[]}
        cardStateByEngine={{}}
        onInstall={vi.fn()}
        detecting={false}
        onContinueFromWelcome={vi.fn()}
        onSkipCli={vi.fn()}
        onEnterApp={onEnterApp}
      />,
    );

    for (const step of ["welcome", "ide", "cli", "done"] as const) {
      rerender(
        <FirstRunSetupWizard
          profile={EMPTY_FIRST_RUN_SETUP_PROFILE}
          step={step}
          onStepChange={vi.fn()}
          onIdeChange={vi.fn()}
          selectedEngine="claude"
          onSelectEngine={vi.fn()}
          engineStatuses={[]}
          cardStateByEngine={{}}
          onInstall={vi.fn()}
          detecting={false}
          onContinueFromWelcome={vi.fn()}
          onSkipCli={vi.fn()}
          onEnterApp={onEnterApp}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "onboarding.common.skipAll" }));
    }

    expect(onEnterApp).toHaveBeenCalledTimes(4);
  });

  it("summarizes the selected installed engine instead of the first detected CLI", () => {
    render(
      <FirstRunSetupWizard
        profile={{
          ...EMPTY_FIRST_RUN_SETUP_PROFILE,
          preferredIde: "vscode",
          step: "done",
          primaryEngine: "claude",
          validatedEngines: ["claude", "dsh"],
        }}
        step="done"
        onStepChange={vi.fn()}
        onIdeChange={vi.fn()}
        selectedEngine="dsh"
        onSelectEngine={vi.fn()}
        engineStatuses={[
          installedStatus("claude", "2.1.228"),
          installedStatus("dsh", "0.1.0-rc.6"),
        ]}
        cardStateByEngine={{
          claude: {
            installed: true,
            validated: true,
            version: "2.1.228",
            busy: false,
            error: null,
          },
          dsh: {
            installed: true,
            validated: true,
            version: "0.1.0-rc.6",
            busy: false,
            error: null,
          },
        }}
        onInstall={vi.fn()}
        detecting={false}
        onContinueFromWelcome={vi.fn()}
        onSkipCli={vi.fn()}
        onEnterApp={vi.fn()}
      />,
    );

    expect(screen.getByText("onboarding.engine.dsh.title")).not.toBeNull();
    expect(screen.queryByText("onboarding.engine.claude.title")).toBeNull();
  });
});
