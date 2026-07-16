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
  it("reorders non-active providers and inserts active at its home index", () => {
    const providers = [
      provider("a"),
      provider("b", { isActive: true }),
      provider("c"),
    ];

    expect(buildClaudeProviderReorderIds(providers, 1, 0)).toEqual([
      "c",
      "b",
      "a",
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
        onSwitch={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    const cardNames = Array.from(
      container.querySelectorAll(".vendor-card-name"),
    ).map((element) => element.textContent);

    expect(cardNames).toEqual([
      "settings.vendor.officialConfig",
      "ProviderB",
      "ProviderA",
      "ProviderC",
    ]);
    expect(
      Array.from(container.querySelectorAll(".vendor-list-title")).map(
        (element) => element.textContent,
      ),
    ).toEqual(["settings.vendor.officialConfig", "settings.vendor.thirdPartyConfig"]);
    expect(
      container.querySelectorAll("[title='settings.vendor.dragToReorder']"),
    ).toHaveLength(2);
  });

  it("keeps enable, edit, and delete actions in the compact table", () => {
    const onSwitch = vi.fn();
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
        onSwitch={onSwitch}
        onReorder={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: "settings.vendor.enable" })[1],
    );
    fireEvent.click(screen.getAllByTitle("settings.vendor.edit")[0]);
    fireEvent.click(screen.getAllByTitle("settings.vendor.edit")[1]);
    fireEvent.click(screen.getAllByTitle("settings.vendor.delete")[0]);

    expect(onSwitch).toHaveBeenCalledWith("a");
    expect(onEditLocalSettings).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(providerB);
    expect(onDelete).toHaveBeenCalledWith(providerB);
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
        onSwitch={vi.fn()}
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
        onSwitch={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "settings.vendor.pluginModels" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /settings\.vendor\.add/ })).toBeTruthy();
  });
});
