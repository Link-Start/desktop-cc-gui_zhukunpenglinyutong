// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProviderConfig } from "../types";
import { buildClaudeProviderReorderIds, ProviderList } from "./ProviderList";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function provider(
  id: string,
  options: Partial<ProviderConfig> = {},
): ProviderConfig {
  return {
    id,
    name: `Provider ${id.toUpperCase()}`,
    ...options,
  };
}

describe("buildClaudeProviderReorderIds", () => {
  it("reorders every managed provider without active-provider pinning", () => {
    const providers = [
      provider("a"),
      provider("b", { isActive: true }),
      provider("c"),
    ];

    expect(buildClaudeProviderReorderIds(providers, 1, 0)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("reorders all regular providers when no active provider exists", () => {
    const providers = [provider("a"), provider("b"), provider("c")];

    expect(buildClaudeProviderReorderIds(providers, 0, 2)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});

describe("ProviderList", () => {
  it("renders the official config first and third-party providers separately", () => {
    const { container } = render(
      <ProviderList
        providers={[
          provider("__local_settings__", {
            isActive: false,
            isLocalProvider: true,
          }),
          provider("a"),
          provider("b", { isActive: true }),
          provider("c"),
        ]}
        loading={false}
        onAdd={vi.fn()}
        onEditLocalSettings={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    const cardNames = Array.from(
      container.querySelectorAll(".vendor-card-name"),
    ).map((element) => element.textContent);

    expect(cardNames).toEqual([
      "settings.vendor.officialConfig",
      "ProviderA",
      "ProviderB",
      "ProviderC",
    ]);
    expect(
      Array.from(container.querySelectorAll(".vendor-list-title")).map(
        (element) => element.textContent,
      ),
    ).toEqual([
      "settings.vendor.officialConfig",
      "settings.vendor.thirdPartyConfig",
    ]);
    expect(
      container.querySelectorAll("[title='settings.vendor.dragToReorder']"),
    ).toHaveLength(3);
  });

  it("marks managed providers as new-session options without a global switch", () => {
    const onEditLocalSettings = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const localProvider = provider("__local_settings_json__", {
      isLocalProvider: true,
    });
    const providerA = provider("a");
    const providerB = provider("b", { isActive: true });

    render(
      <ProviderList
        providers={[localProvider, providerA, providerB]}
        loading={false}
        onAdd={vi.fn()}
        onEditLocalSettings={onEditLocalSettings}
        onEdit={onEdit}
        onDelete={onDelete}
        onReorder={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByTitle("settings.vendor.edit")[0]);
    fireEvent.click(screen.getAllByTitle("settings.vendor.edit")[1]);
    fireEvent.click(screen.getAllByTitle("settings.vendor.delete")[0]);

    expect(
      screen.getAllByText("settings.vendor.availableForNewCodexSessions"),
    ).toHaveLength(3);
    expect(
      screen.queryByRole("button", { name: "settings.vendor.enable" }),
    ).toBeNull();
    expect(onEditLocalSettings).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(providerA);
    expect(onDelete).toHaveBeenCalledWith(providerA);
  });

  it("renders provider name suffix as secondary text", () => {
    const { container } = render(
      <ProviderList
        providers={[provider("a", { name: "midsummer 自用1" })]}
        loading={false}
        onAdd={vi.fn()}
        onEditLocalSettings={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(container.querySelector(".vendor-card-name")?.textContent).toBe(
      "midsummer自用1",
    );
    expect(
      container.querySelector(".vendor-card-name-extension")?.textContent,
    ).toBe("自用1");
  });

  it("renders header actions next to the add button", () => {
    render(
      <ProviderList
        providers={[]}
        loading={false}
        headerActions={
          <button type="button">settings.vendor.pluginModels</button>
        }
        onAdd={vi.fn()}
        onEditLocalSettings={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "settings.vendor.pluginModels" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /settings\.vendor\.add/ }),
    ).toBeTruthy();
  });
});
