// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderConfig } from "../types";
import { DISABLED_PROVIDER_ID, LOCAL_SETTINGS_PROVIDER_ID } from "../types";
import { ClaudeLocalSettingsCard } from "./ClaudeLocalSettingsCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function localProvider(options: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: LOCAL_SETTINGS_PROVIDER_ID,
    name: "Local settings",
    isLocalProvider: true,
    ...options,
  };
}

function renderCard(
  provider: ProviderConfig | null,
  overrides: Partial<Parameters<typeof ClaudeLocalSettingsCard>[0]> = {},
) {
  const props = {
    localProvider: provider,
    onSwitch: vi.fn(),
    onEdit: vi.fn(),
    ...overrides,
  };
  const view = render(<ClaudeLocalSettingsCard {...props} />);
  return { ...view, props };
}

afterEach(() => {
  cleanup();
});

describe("ClaudeLocalSettingsCard", () => {
  it("renders nothing without a local provider", () => {
    const { container } = renderCard(null);

    expect(container.firstChild).toBeNull();
  });

  it("shows the in-use badge and revoke action when authorized", () => {
    renderCard(localProvider({ isActive: true }));

    expect(screen.getByText("settings.vendor.officialConfig")).toBeTruthy();
    // Description lives in the row help popover, not inline.
    expect(
      screen.queryByText("settings.vendor.localProviderDescription"),
    ).toBeNull();
    expect(screen.getByText("settings.vendor.inUse")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: /settings\.vendor\.revokeAuthorization/,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: /settings\.vendor\.authorizeAndEnable/,
      }),
    ).toBeNull();
  });

  it("shows the authorize action without the in-use badge when not authorized", () => {
    renderCard(localProvider({ isActive: false }));

    expect(screen.queryByText("settings.vendor.inUse")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: /settings\.vendor\.authorizeAndEnable/,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: /settings\.vendor\.revokeAuthorization/,
      }),
    ).toBeNull();
  });

  it("authorizes the local provider through the confirm dialog", () => {
    const { props } = renderCard(localProvider({ isActive: false }));

    fireEvent.click(
      screen.getByRole("button", {
        name: /settings\.vendor\.authorizeAndEnable/,
      }),
    );

    const dialog = document.querySelector(".vendor-dialog") as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain(
      "settings.vendor.localProviderAuthorizeTitle",
    );

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /settings\.vendor\.authorizeAndEnable/,
      }),
    );

    expect(props.onSwitch).toHaveBeenCalledWith(LOCAL_SETTINGS_PROVIDER_ID);
    expect(document.querySelector(".vendor-dialog")).toBeNull();
  });

  it("revokes the local provider authorization through the confirm dialog", () => {
    const { props } = renderCard(localProvider({ isActive: true }));

    fireEvent.click(
      screen.getByRole("button", {
        name: /settings\.vendor\.revokeAuthorization/,
      }),
    );

    const dialog = document.querySelector(".vendor-dialog") as HTMLElement;
    expect(dialog.textContent).toContain(
      "settings.vendor.localProviderDisableTitle",
    );

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /settings\.vendor\.revokeAuthorization/,
      }),
    );

    expect(props.onSwitch).toHaveBeenCalledWith(DISABLED_PROVIDER_ID);
  });

  it("surfaces local provider help in the row popover", async () => {
    renderCard(localProvider());

    fireEvent.click(screen.getByTitle("settings.vendor.whatIsThis"));

    expect(
      await screen.findByText("settings.vendor.localProviderDescription"),
    ).toBeTruthy();
    expect(
      screen.getByText("settings.vendor.localProviderHelpBody"),
    ).toBeTruthy();
    // No legacy full-screen help dialog.
    expect(document.querySelector(".vendor-dialog")).toBeNull();
  });

  it("forwards the edit action to onEdit", () => {
    const { props } = renderCard(localProvider());

    fireEvent.click(screen.getByTitle("settings.vendor.edit"));

    expect(props.onEdit).toHaveBeenCalledTimes(1);
  });
});
