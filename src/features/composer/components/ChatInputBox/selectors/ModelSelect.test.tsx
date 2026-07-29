// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  buildProviderExecutionTarget,
  isSameProviderExecutionProfile,
  ModelSelect,
} from "./ModelSelect";
import { STORAGE_KEYS } from "../../../types/provider";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.model
        ? `${key}:${params.model}`
        : params?.message
          ? `${key}:${params.message}`
          : key,
  }),
}));

vi.mock("../../../../engine/components/EngineIcon", () => ({
  EngineIcon: ({ engine }: { engine: string }) => (
    <span data-testid={`${engine}-icon`} />
  ),
}));

describe("ModelSelect", () => {
  it("renders the readiness trigger with provider and selected model chrome", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onChange = vi.fn();

    render(
      <ModelSelect
        value="demo"
        currentProvider="codex"
        providerLabel="Codex"
        triggerVariant="readiness"
        onChange={onChange}
        models={[{ id: "demo", label: "demo" }]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "chat.currentModel:demo" });

    expect(trigger.className).toContain("composer-readiness-target-button");
    // Provider is shown as an engine icon, the selected model as text.
    expect(within(trigger).getByTestId("codex-icon")).toBeTruthy();
    expect(trigger.textContent).toContain("demo");

    await user.click(trigger);
    const option = await screen.findByRole("menuitem", { name: /demo/ });
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith("demo");
  });

  it("renders grouped providers first and opens provider models on hover", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onChange = vi.fn();
    const onProviderModelChange = vi.fn();

    render(
      <ModelSelect
        value="gpt-5.4"
        currentProvider="codex"
        providerLabel="Codex"
        triggerVariant="readiness"
        onChange={onChange}
        onProviderModelChange={onProviderModelChange}
        models={[{ id: "gpt-5.4", label: "GPT-5.4" }]}
        modelGroups={[
          {
            providerId: "claude",
            providerLabel: "Claude Code",
            enabled: true,
            models: [{ id: "claude-sonnet-4-6", label: "Sonnet 4.6", description: "hidden" }],
          },
          {
            providerId: "codex",
            providerLabel: "Codex",
            enabled: true,
            models: [{ id: "gpt-5.4", label: "GPT-5.4", description: "hidden" }],
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "chat.currentModel:models.codex.gpt54.label" }),
    );

    // The first level is provider/CLI only; models stay in the hover submenu.
    const claudeProviderItem = await screen.findByRole("menuitem", { name: /Claude Code/ });
    expect(screen.getByRole("menuitem", { name: /Codex/ })).toBeTruthy();
    expect(screen.queryByText("Sonnet 4.6")).toBeNull();
    expect(screen.queryByText("GPT-5.4")).toBeNull();
    expect(screen.queryByText("hidden")).toBeNull();

    await user.hover(claudeProviderItem);
    const sonnetItem = await screen.findByRole("menuitem", { name: /Sonnet 4.6/ });
    expect(sonnetItem).toBeTruthy();
    // Grouped items stay compact (no description).
    expect(screen.queryByText("hidden")).toBeNull();

    fireEvent.click(sonnetItem);

    expect(onProviderModelChange).toHaveBeenCalledWith("claude", "claude-sonnet-4-6");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows Shared CLI availability and unavailable reason", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onExecutionTargetChange = vi.fn();
    const onOpenProviderProfile = vi.fn();

    render(
      <ModelSelect
        value="same-model"
        currentProvider="claude"
        triggerVariant="readiness"
        onChange={vi.fn()}
        executionTarget={{
          engine: "claude",
          providerProfileId: "provider-a",
          model: "same-model",
          reasoning: { effort: "high" },
        }}
        onExecutionTargetChange={onExecutionTargetChange}
        onOpenProviderProfile={onOpenProviderProfile}
        targetGroups={[
          {
            providerId: "claude",
            providerLabel: "Claude Code",
            enabled: true,
            profiles: [
              {
                id: "provider-a",
                label: "Provider A",
                source: "managed",
                loading: false,
                error: null,
                models: [{
                  id: "same-model",
                  model: "same-model",
                  label: "A Model",
                }],
              },
            ],
          },
          {
            providerId: "codex",
            providerLabel: "Codex CLI",
            enabled: true,
            profiles: [
              {
                id: "provider-b",
                label: "Provider B",
                source: "managed",
                loading: false,
                error: null,
                models: [{
                  id: "same-model",
                  model: "same-model",
                  label: "B Model",
                }],
              },
            ],
          },
          {
            providerId: "kimi",
            providerLabel: "Kimi CLI",
            enabled: false,
            disabledReason: "可作为来源；目标续接尚未验证",
            profiles: [],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button"));
    const codexItem = await screen.findByRole("menuitem", {
      name: /Codex CLI/,
    });
    expect(
      screen.getByRole("menuitem", { name: /Kimi CLI/ }).getAttribute(
        "data-disabled",
      ),
    ).not.toBeNull();
    await user.hover(codexItem);
    expect(onExecutionTargetChange).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("menuitem", { name: /B Model/ }));

    expect(onOpenProviderProfile).toHaveBeenCalledWith("codex", "provider-b");
    expect(onExecutionTargetChange).toHaveBeenCalledTimes(1);
    expect(onExecutionTargetChange).toHaveBeenCalledWith({
      engine: "codex",
      providerProfileId: "provider-b",
      modelCatalogEntryId: "same-model",
      model: "same-model",
      providerProfileNameSnapshot: "Provider B",
      providerProfileSource: "managed",
      reasoning: null,
    });
  });

  it("switches from Codex to the first Claude local model with explicit runtime identity", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onExecutionTargetChange = vi.fn();
    const onOpenProviderProfile = vi.fn();

    render(
      <ModelSelect
        value="gpt-5.6-sol"
        currentProvider="codex"
        triggerVariant="readiness"
        onChange={vi.fn()}
        executionTarget={{
          engine: "codex",
          providerProfileId: "codex-provider",
          modelCatalogEntryId: "gpt-5.6-sol",
          model: "gpt-5.6-sol",
          providerProfileNameSnapshot: "Codex Provider",
          providerProfileSource: "managed",
          reasoning: { effort: "high" },
        }}
        onExecutionTargetChange={onExecutionTargetChange}
        onOpenProviderProfile={onOpenProviderProfile}
        targetGroups={[
          {
            providerId: "claude",
            providerLabel: "Claude Code",
            enabled: true,
            profiles: [
              {
                id: "__local_settings_json__",
                label: "Local Settings.json",
                source: "disk",
                loading: false,
                error: null,
                models: [
                  {
                    id: "settings-main",
                    model: "kimi-for-coding",
                    label: "kimi-for-coding",
                  },
                ],
              },
            ],
          },
          {
            providerId: "codex",
            providerLabel: "Codex CLI",
            enabled: true,
            profiles: [
              {
                id: "codex-provider",
                label: "Codex Provider",
                source: "managed",
                loading: false,
                error: null,
                models: [
                  {
                    id: "gpt-5.6-sol",
                    model: "gpt-5.6-sol",
                    label: "GPT-5.6 Sol",
                  },
                ],
              },
            ],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.hover(
      await screen.findByRole("menuitem", { name: /Claude Code/ }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /kimi-for-coding/ }),
    );

    expect(onOpenProviderProfile).toHaveBeenCalledWith(
      "claude",
      "__local_settings_json__",
    );
    expect(onExecutionTargetChange).toHaveBeenCalledOnce();
    expect(onExecutionTargetChange).toHaveBeenCalledWith({
      engine: "claude",
      providerProfileId: null,
      modelCatalogEntryId: "settings-main",
      model: "kimi-for-coding",
      providerProfileNameSnapshot: "Local Settings.json",
      providerProfileSource: "disk",
      reasoning: null,
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("uses the catalog id as the runtime fallback for a legacy model row", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onExecutionTargetChange = vi.fn();

    render(
      <ModelSelect
        value="current-model"
        currentProvider="claude"
        triggerVariant="readiness"
        targetGroupDisplayMode="profiles"
        onChange={vi.fn()}
        executionTarget={{
          engine: "claude",
          providerProfileId: "provider-a",
          modelCatalogEntryId: "current-model",
          model: "current-model",
          providerProfileNameSnapshot: "Provider A",
          providerProfileSource: "managed",
        }}
        onExecutionTargetChange={onExecutionTargetChange}
        targetGroups={[
          {
            providerId: "codex",
            providerLabel: "Codex CLI",
            enabled: true,
            profiles: [
              {
                id: "provider-b",
                label: "Provider B",
                source: "managed",
                loading: false,
                error: null,
                models: [{ id: "catalog-only", label: "Catalog Only" }],
              },
            ],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button"));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: /Provider B/ }),
    );
    const catalogOnlyItem = await screen.findByRole("menuitem", {
      name: /Catalog Only/,
    });

    expect(catalogOnlyItem.getAttribute("data-disabled")).toBeNull();
    await user.click(catalogOnlyItem);
    expect(onExecutionTargetChange).toHaveBeenCalledWith({
      engine: "codex",
      providerProfileId: "provider-b",
      modelCatalogEntryId: "catalog-only",
      model: "catalog-only",
      providerProfileNameSnapshot: "Provider B",
      providerProfileSource: "managed",
      reasoning: null,
    });
  });

  it("keeps Native last-good model rows interactive while refreshing", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onExecutionTargetChange = vi.fn();

    render(
      <ModelSelect
        value="current-model"
        currentProvider="claude"
        triggerVariant="readiness"
        targetGroupDisplayMode="profiles"
        onChange={vi.fn()}
        executionTarget={{
          engine: "claude",
          providerProfileId: null,
          model: "current-model",
          providerProfileSource: "disk",
        }}
        onExecutionTargetChange={onExecutionTargetChange}
        targetGroups={[
          {
            providerId: "claude",
            providerLabel: "Claude Code",
            enabled: true,
            profiles: [
              {
                id: "__local_settings_json__",
                label: "Local Settings.json",
                source: "disk",
                loading: true,
                error: null,
                models: [
                  {
                    id: "settings-main",
                    model: "stale-runtime-model",
                    label: "Stale Local Model",
                  },
                ],
              },
            ],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("models.refreshingConfig")).toBeTruthy();
    await user.click(
      screen.getByRole("menuitem", { name: /Stale Local Model/ }),
    );
    expect(onExecutionTargetChange).toHaveBeenCalledWith(
      expect.objectContaining({
        engine: "claude",
        providerProfileId: "__local_settings_json__",
        modelCatalogEntryId: "settings-main",
        model: "stale-runtime-model",
      }),
    );
  });

  it("marks a Native Provider and model selected without source metadata", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    render(
      <ModelSelect
        value="MiniMax-M3"
        currentProvider="claude"
        triggerVariant="readiness"
        targetGroupDisplayMode="profiles"
        onChange={vi.fn()}
        executionTarget={{
          engine: "claude",
          providerProfileId: "provider-minimax",
          model: "MiniMax-M3",
          reasoning: null,
        }}
        targetGroups={[
          {
            providerId: "claude",
            providerLabel: "Claude Code",
            enabled: true,
            profiles: [
              {
                id: "provider-minimax",
                label: "Minimax-m3",
                source: "managed",
                loading: false,
                error: null,
                models: [
                  {
                    id: "settings-main",
                    model: "MiniMax-M3",
                    label: "MiniMax-M3",
                  },
                ],
              },
            ],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button"));

    expect(
      screen
        .getByRole("menuitem", { name: /Minimax-m3/ })
        .getAttribute("data-selected"),
    ).toBe("true");
    expect(
      screen
        .getByRole("menuitem", { name: /MiniMax-M3/ })
        .getAttribute("data-selected"),
    ).toBe("true");
  });

  it("keeps Shared CLI and provider accordion in one stable menu root", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onExecutionTargetChange = vi.fn();
    const onReloadProviderConfig = vi.fn();

    render(
      <ModelSelect
        value="model-a"
        currentProvider="claude"
        triggerVariant="readiness"
        onChange={vi.fn()}
        onReloadProviderConfig={onReloadProviderConfig}
        executionTarget={{
          engine: "claude",
          providerProfileId: "provider-a",
          modelCatalogEntryId: "model-a",
          model: "model-a",
          providerProfileNameSnapshot: "Provider A",
          providerProfileSource: "managed",
        }}
        onExecutionTargetChange={onExecutionTargetChange}
        targetGroups={[
          {
            providerId: "claude",
            providerLabel: "Claude Code",
            enabled: true,
            profiles: [
              {
                id: "provider-a",
                label: "Provider A",
                source: "managed",
                loading: false,
                error: null,
                models: [{ id: "model-a", label: "Model A" }],
              },
              {
                id: "provider-b",
                label: "Provider B",
                source: "managed",
                loading: false,
                error: null,
                models: [
                  {
                    id: "model-b",
                    model: "runtime-model-b",
                    label: "Model B",
                  },
                ],
              },
            ],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button"));
    const cliItem = await screen.findByRole("menuitem", {
      name: /Claude Code/,
    });

    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(document.querySelector("[data-shared-target-picker]")).toBeTruthy();
    expect(document.querySelector("[data-shared-target-cli-list]")).toBeTruthy();
    expect(
      document.querySelector("[data-shared-target-provider-panel]"),
    ).toBeTruthy();
    expect(
      document.querySelector('[data-slot="dropdown-menu-sub-content"]'),
    ).toBeNull();

    const providerA = await screen.findByRole("menuitem", {
      name: /Provider A/,
    });
    const providerB = screen.getByRole("menuitem", { name: /Provider B/ });
    expect(providerA.getAttribute("aria-expanded")).toBe("true");

    await user.click(providerB);

    expect(cliItem.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(screen.getByRole("menu").textContent).toContain("Provider B");
    expect(providerA.getAttribute("aria-expanded")).toBe("false");
    expect(providerB.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menuitem", { name: /Model B/ })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "models.reloadConfig" }));
    expect(onReloadProviderConfig).toHaveBeenCalledWith(
      "claude",
      "provider-b",
    );

    await user.click(providerA);
    expect(providerA.getAttribute("aria-expanded")).toBe("true");
    expect(providerB.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("menuitem", { name: /Model A/ })).toBeTruthy();

    await user.click(providerB);
    expect(providerA.getAttribute("aria-expanded")).toBe("false");
    expect(providerB.getAttribute("aria-expanded")).toBe("true");

    await user.click(providerB);

    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(screen.getByRole("menu").textContent).toContain("Provider B");
    expect(providerB.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menuitem", { name: /Model B/ })).toBeNull();

    await user.click(providerB);
    await user.click(screen.getByRole("menuitem", { name: /Model B/ }));

    expect(onExecutionTargetChange).toHaveBeenCalledWith(
      expect.objectContaining({
        engine: "claude",
        providerProfileId: "provider-b",
        modelCatalogEntryId: "model-b",
        model: "runtime-model-b",
      }),
    );
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("renders native providers inline and expands only one model list", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onExecutionTargetChange = vi.fn();

    render(
      <ModelSelect
        value="model-a"
        currentProvider="claude"
        triggerVariant="readiness"
        targetGroupDisplayMode="profiles"
        onChange={vi.fn()}
        executionTarget={{
          engine: "claude",
          providerProfileId: "provider-a",
          modelCatalogEntryId: "model-a",
          model: "model-a",
          providerProfileNameSnapshot: "Provider A",
          providerProfileSource: "managed",
        }}
        onExecutionTargetChange={onExecutionTargetChange}
        targetGroups={[
          {
            providerId: "claude",
            providerLabel: "Claude Code",
            enabled: true,
            profiles: [
              {
                id: "provider-a",
                label: "Provider A",
                source: "managed",
                loading: false,
                error: null,
                models: [{ id: "model-a", label: "Model A" }],
              },
              {
                id: "provider-b",
                label: "Provider B",
                source: "managed",
                loading: false,
                error: null,
                models: [
                  {
                    id: "model-b",
                    model: "runtime-model-b",
                    label: "Model B",
                  },
                ],
              },
            ],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button"));
    expect(screen.queryByRole("menuitem", { name: /Codex/ })).toBeNull();
    const providerA = screen.getByRole("menuitem", { name: /Provider A/ });
    const providerB = screen.getByRole("menuitem", { name: /Provider B/ });
    expect(providerA.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menuitem", { name: /Model A/ })).toBeTruthy();

    await user.click(providerB);
    expect(providerA.getAttribute("aria-expanded")).toBe("false");
    expect(providerB.getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("menuitem", { name: /Model A/ })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: /Model B/ }));

    expect(onExecutionTargetChange).toHaveBeenCalledWith(
      expect.objectContaining({
        engine: "claude",
        providerProfileId: "provider-b",
        modelCatalogEntryId: "model-b",
        model: "runtime-model-b",
      }),
    );
  });

  it.each(["cli", "profiles"] as const)(
    "moves reload config into the Provider header in %s mode",
    async (targetGroupDisplayMode) => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const onReloadProviderConfig = vi.fn();

      render(
        <ModelSelect
          value="model-a"
          currentProvider="claude"
          triggerVariant="readiness"
          targetGroupDisplayMode={targetGroupDisplayMode}
          onChange={vi.fn()}
          onAddModel={vi.fn()}
          onReloadProviderConfig={onReloadProviderConfig}
          executionTarget={{
            engine: "claude",
            providerProfileId: "provider-a",
            model: "model-a",
          }}
          targetGroups={[
            {
              providerId: "claude",
              providerLabel: "Claude Code",
              enabled: true,
              profiles: [
                {
                  id: "provider-a",
                  label: "Provider A",
                  source: "managed",
                  loading: false,
                  error: null,
                  models: [{ id: "model-a", label: "Model A" }],
                },
              ],
            },
          ]}
        />,
      );

      await user.click(screen.getByRole("button"));

      const refreshButton = await screen.findByRole("button", {
        name: "models.reloadConfig",
      });
      expect(
        refreshButton.closest("[data-slot='dropdown-menu-label']"),
      ).toBeTruthy();
      expect(
        screen.queryByRole("menuitem", { name: "models.reloadConfig" }),
      ).toBeNull();
      expect(
        screen.getByRole("menuitem", { name: "models.addModel" }),
      ).toBeTruthy();

      fireEvent.click(refreshButton);
      expect(onReloadProviderConfig).toHaveBeenCalledWith(
        "claude",
        "provider-a",
      );
    },
  );

  it("shows CLI discovery only for a supported Provider profile", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onDiscoverProviderModels = vi.fn();

    render(
      <ModelSelect
        value="model-a"
        currentProvider="codex"
        triggerVariant="readiness"
        onChange={vi.fn()}
        onDiscoverProviderModels={onDiscoverProviderModels}
        executionTarget={{
          engine: "codex",
          providerProfileId: "provider-a",
          model: "model-a",
        }}
        targetGroups={[
          {
            providerId: "codex",
            providerLabel: "Codex CLI",
            enabled: true,
            profiles: [
              {
                id: "provider-a",
                label: "Provider A",
                source: "managed",
                loading: false,
                discoverySupported: true,
                error: null,
                models: [{ id: "model-a", label: "Model A" }],
              },
            ],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button"));
    const discoverButton = await screen.findByRole("button", {
      name: "models.discoverModels",
    });
    fireEvent.click(discoverButton);

    expect(onDiscoverProviderModels).toHaveBeenCalledWith(
      "codex",
      "provider-a",
    );
  });

  it("builds an atomic Shared target without inferring from model id", () => {
    expect(
      buildProviderExecutionTarget(
        {
          engine: "claude",
          providerProfileId: "provider-a",
          model: "same-model",
          reasoning: { effort: "high" },
        },
        "codex",
        "provider-b",
        "same-model",
        "Provider B",
        "managed",
        true,
        "same-model",
      ),
    ).toEqual({
      engine: "codex",
      providerProfileId: "provider-b",
      modelCatalogEntryId: "same-model",
      model: "same-model",
      providerProfileNameSnapshot: "Provider B",
      providerProfileSource: "managed",
      reasoning: null,
    });
  });

  it("normalizes local profile sentinels to the canonical default binding", () => {
    expect(
      buildProviderExecutionTarget(
        {
          engine: "claude",
          providerProfileId: null,
          model: "claude-sonnet",
          reasoning: { effort: "high" },
        },
        "claude",
        "__local_settings_json__",
        "claude-opus",
        "本地配置",
        "disk",
        true,
        "claude-opus",
      ),
    ).toEqual({
      engine: "claude",
      providerProfileId: null,
      modelCatalogEntryId: "claude-opus",
      model: "claude-opus",
      providerProfileNameSnapshot: "本地配置",
      providerProfileSource: "disk",
      reasoning: { effort: "high" },
    });
  });

  it("keeps catalog identity but freezes the runtime model for execution", () => {
    expect(
      buildProviderExecutionTarget(
        null,
        "claude",
        "provider-b",
        "settings-reasoning",
        "Provider B",
        "managed",
        false,
        "deepseek-v4-pro",
      ),
    ).toMatchObject({
      engine: "claude",
      providerProfileId: "provider-b",
      modelCatalogEntryId: "settings-reasoning",
      model: "deepseek-v4-pro",
    });
  });

  it("does not synthesize a missing runtime model from catalog identity", () => {
    expect(
      buildProviderExecutionTarget(
        null,
        "claude",
        "provider-b",
        "settings-reasoning",
        "Provider B",
        "managed",
      ),
    ).toMatchObject({
      modelCatalogEntryId: "settings-reasoning",
      model: null,
    });
  });

  it("treats local sentinel and null as the same native provider binding", () => {
    expect(
      isSameProviderExecutionProfile("claude", null, {
        engine: "claude",
        providerProfileId: "__local_settings_json__",
      }),
    ).toBe(true);
    expect(
      isSameProviderExecutionProfile("claude", "provider-a", {
        engine: "claude",
        providerProfileId: "provider-b",
      }),
    ).toBe(false);
  });

  it("shows the selected target model instead of the previous engine catalog", () => {
    render(
      <ModelSelect
        value="codex-target-model"
        currentProvider="codex"
        triggerVariant="readiness"
        onChange={vi.fn()}
        models={[{ id: "claude-old-model", label: "Old Claude Model" }]}
        executionTarget={{
          engine: "codex",
          providerProfileId: "provider-b",
          modelCatalogEntryId: "codex-target-model",
          model: "codex-target-model",
          providerProfileNameSnapshot: "Provider B",
          providerProfileSource: "managed",
        }}
        targetGroups={[
          {
            providerId: "codex",
            providerLabel: "Codex CLI",
            enabled: true,
            profiles: [
              {
                id: "provider-b",
                label: "Provider B",
                source: "managed",
                loading: false,
                error: null,
                models: [
                  {
                    id: "codex-target-model",
                    label: "Provider B Model",
                  },
                ],
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByRole("button").textContent).toContain(
      "Provider B Model",
    );
    expect(screen.getByRole("button").textContent).not.toContain(
      "models.selectModel",
    );
  });

  it("does not display the first model when no model value is selected", () => {
    render(
      <ModelSelect
        value=""
        currentProvider="codex"
        onChange={vi.fn()}
        models={[
          {
            id: "gpt-5.5",
            label: "gpt-5.5",
          },
        ]}
      />,
    );

    const buttonText = screen.getByRole("button").textContent ?? "";

    expect(buttonText).toContain("models.selectModel");
    expect(buttonText).not.toContain("gpt-5.5");
  });

  it("renders independent add model and refresh config footer actions", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onAddModel = vi.fn();
    const onRefreshConfig = vi.fn();

    render(
      <ModelSelect
        value="gpt-5.5"
        currentProvider="codex"
        onChange={vi.fn()}
        onAddModel={onAddModel}
        onRefreshConfig={onRefreshConfig}
        models={[{ id: "gpt-5.5", label: "gpt-5.5" }]}
      />,
    );

    await user.click(screen.getAllByRole("button")[0]);
    await user.click(await screen.findByRole("menuitem", { name: "models.refreshConfig" }));

    expect(onRefreshConfig).toHaveBeenCalledTimes(1);
    expect(onAddModel).not.toHaveBeenCalled();

    // Refresh keeps the menu open; the add action is still reachable.
    await user.click(screen.getByRole("menuitem", { name: "models.addModel" }));

    expect(onAddModel).toHaveBeenCalledTimes(1);
    expect(onRefreshConfig).toHaveBeenCalledTimes(1);
  });

  it("moves config actions into the current provider submenu when providers are grouped", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onAddModel = vi.fn();
    const onRefreshConfig = vi.fn();

    render(
      <ModelSelect
        value="claude-opus-4-8"
        currentProvider="claude"
        triggerVariant="readiness"
        onChange={vi.fn()}
        onAddModel={onAddModel}
        onRefreshConfig={onRefreshConfig}
        models={[
          { id: "claude-opus-4-8", label: "Opus 4.8" },
          { id: "claude-sonnet-5", label: "Sonnet 5" },
        ]}
        modelGroups={[
          {
            providerId: "claude",
            providerLabel: "Claude Code",
            enabled: true,
            models: [
              { id: "claude-opus-4-8", label: "Opus 4.8" },
              { id: "claude-sonnet-5", label: "Sonnet 5" },
            ],
          },
          {
            providerId: "codex",
            providerLabel: "Codex",
            enabled: true,
            models: [{ id: "gpt-5.4", label: "GPT-5.4" }],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "chat.currentModel:Opus 4.8" }));
    await user.hover(await screen.findByRole("menuitem", { name: /Claude Code/ }));

    expect(screen.queryByRole("menuitem", { name: "models.refreshConfig" })).toBeNull();

    const refreshButton = await screen.findByRole("button", { name: "models.refreshConfig" });
    expect(refreshButton.textContent).toBe("");

    const opusItem = await screen.findByRole("menuitem", { name: /Opus 4.8/ });
    const sonnetItem = screen.getByRole("menuitem", { name: /Sonnet 5/ });
    const addItem = screen.getByRole("menuitem", { name: "models.addModel" });
    const submenuContent = opusItem.closest("[data-slot='dropdown-menu-sub-content']");

    expect(submenuContent).toBeTruthy();
    const items = Array.from(
      submenuContent!.querySelectorAll("[role='menuitem']"),
    );
    expect(items.indexOf(addItem)).toBeGreaterThan(items.indexOf(opusItem));
    expect(items.indexOf(addItem)).toBeGreaterThan(items.indexOf(sonnetItem));

    fireEvent.click(addItem);
    expect(onAddModel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "chat.currentModel:Opus 4.8" }));
    await user.hover(await screen.findByRole("menuitem", { name: /Claude Code/ }));
    fireEvent.click(await screen.findByRole("button", { name: "models.refreshConfig" }));

    expect(onRefreshConfig).toHaveBeenCalledTimes(1);
    expect(onAddModel).toHaveBeenCalledTimes(1);
  });

  it("uses refreshed model labels passed by the parent instead of stale localStorage mapping", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.CLAUDE_MODEL_MAPPING,
      JSON.stringify({ sonnet: "old-settings-model" }),
    );

    render(
      <ModelSelect
        value="claude-sonnet-4-6"
        currentProvider="claude"
        onChange={vi.fn()}
        models={[{ id: "claude-sonnet-4-6", label: "new-settings-model" }]}
      />,
    );

    const buttonText = screen.getByRole("button").textContent ?? "";

    expect(buttonText).toContain("new-settings-model");
    expect(buttonText).not.toContain("old-settings-model");
  });

  it("does not synthesize a missing Claude selected value as a fallback option", () => {
    render(
      <ModelSelect
        value="sonnet"
        currentProvider="claude"
        onChange={vi.fn()}
        models={[]}
      />,
    );

    expect(screen.queryByText("sonnet")).toBeNull();
    expect(screen.getByRole("button").textContent ?? "").toContain("models.selectModel");
  });

  it("renders settings-sourced Claude runtime models without legacy family relabeling", () => {
    render(
      <ModelSelect
        value="settings-opus"
        currentProvider="claude"
        onChange={vi.fn()}
        models={[
          {
            id: "settings-opus",
            label: "MiniMax-M4[1m]",
            description: "Custom Opus model configured by ANTHROPIC_DEFAULT_OPUS_MODEL",
          },
        ]}
      />,
    );

    const buttonText = screen.getByRole("button").textContent ?? "";

    expect(buttonText).toContain("MiniMax-M4[1m]");
    expect(buttonText).not.toContain("Opus 4.6");
  });

  it("disables refresh config action while refreshing", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <ModelSelect
        value="claude-sonnet-4-6"
        currentProvider="claude"
        onChange={vi.fn()}
        onAddModel={vi.fn()}
        onRefreshConfig={vi.fn()}
        isRefreshingConfig
        models={[{ id: "claude-sonnet-4-6", label: "Sonnet" }]}
      />,
    );

    await user.click(screen.getAllByRole("button")[0]);

    const refreshItem = await screen.findByRole("menuitem", {
      name: "models.refreshingConfig",
    });
    expect(refreshItem.getAttribute("data-disabled")).not.toBeNull();
  });

  it("keeps the dropdown usable when refresh config fails", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <ModelSelect
        value="gemini-2.5-flash"
        currentProvider="gemini"
        onChange={vi.fn()}
        onAddModel={vi.fn()}
        onRefreshConfig={vi.fn().mockRejectedValue(new Error("settings.json invalid"))}
        models={[{ id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }]}
      />,
    );

    await user.click(screen.getAllByRole("button")[0]);
    await user.click(await screen.findByRole("menuitem", { name: "models.refreshConfig" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain("settings.json invalid");
    });

    expect(screen.getAllByText("Gemini 2.5 Flash").length).toBeGreaterThan(0);
  });
});
