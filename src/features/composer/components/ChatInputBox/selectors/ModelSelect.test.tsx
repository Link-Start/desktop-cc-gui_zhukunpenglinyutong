// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildProviderExecutionTarget,
  isSameProviderExecutionProfile,
  ModelSelect,
  resolveActiveProviderProfileId,
} from "./ModelSelect";
import { STORAGE_KEYS } from "../../../types/provider";
import type { ExecutionTarget } from "../../../../shared-session/target/types";
import type { ProviderTargetGroup } from "../hooks/useProviderTargetCatalogOwners";

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

vi.mock("../../../../vendors/providerBrandIcon", () => ({
  providerBrandIconNeedsDarkTile: () => false,
  resolveProviderBrandIcon: ({ modelId }: { modelId?: string | null }) =>
    modelId === "kimi-k3" ? "/icons/kimi.svg" : null,
}));

describe("ModelSelect", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

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
      screen.getByRole("button", { name: "chat.currentModel:GPT-5.4" }),
    );

    // The first level is provider/CLI only; models stay in the hover submenu.
    const claudeProviderItem = await screen.findByRole("menuitem", { name: /Claude Code/ });
    expect(screen.getByRole("menuitem", { name: /Codex/ })).toBeTruthy();
    // Trigger still shows the selected model text; model rows are not yet in the menu.
    expect(screen.queryByRole("menuitem", { name: /Sonnet 4\.6/ })).toBeNull();

    await user.hover(claudeProviderItem);
    const sonnetItem = await screen.findByRole("menuitem", {
      name: /Sonnet 4\.6|models\.claude\.sonnet46/,
    });
    expect(sonnetItem).toBeTruthy();
    // Grouped items now show the tier description subtitle (jetbrains parity).
    expect(sonnetItem.textContent).toMatch(
      /models\.claude\.sonnet46\.description|hidden/,
    );

    fireEvent.click(sonnetItem);

    expect(onProviderModelChange).toHaveBeenCalledWith("claude", "claude-sonnet-4-6");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses runtime model ids for mapped model brand icons", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    window.localStorage.setItem(
      STORAGE_KEYS.CLAUDE_MODEL_MAPPING,
      JSON.stringify({ opus: "kimi-k3" }),
    );

    render(
      <ModelSelect
        value="claude-opus-4-8"
        currentProvider="claude"
        triggerVariant="readiness"
        onChange={vi.fn()}
        models={[
          {
            id: "claude-opus-4-8",
            model: "kimi-k3",
            label: "Opus 4.8",
          },
        ]}
        modelGroups={[
          {
            providerId: "claude",
            providerLabel: "Claude Code",
            enabled: true,
            models: [
              {
                id: "claude-opus-4-8",
                model: "kimi-k3",
                label: "Opus 4.8",
              },
            ],
          },
        ]}
      />,
    );

    // Mapped label becomes kimi-k3 (not the original Opus 4.8 tier name).
    const trigger = screen.getByRole("button", {
      name: "chat.currentModel:kimi-k3",
    });
    expect(trigger.querySelector("img")?.getAttribute("src")).toBe(
      "/icons/kimi.svg",
    );
    expect(within(trigger).queryByTestId("claude-icon")).toBeNull();

    await user.click(trigger);
    const claudeProviderItem = await screen.findByRole("menuitem", {
      name: /Claude Code/,
    });
    expect(within(claudeProviderItem).getByTestId("claude-icon")).toBeTruthy();

    await user.hover(claudeProviderItem);
    const opusItem = await screen.findByRole("menuitem", { name: /kimi-k3/ });
    expect(opusItem.querySelector("img")?.getAttribute("src")).toBe(
      "/icons/kimi.svg",
    );
    // Subtitle explains the tier while the primary label shows the mapped model.
    expect(opusItem.textContent).toMatch(/Opus 4\.8|models\.claude\.opus48/);
  });

  it("shows mapped labels and tier descriptions for every Claude family slot", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    window.localStorage.setItem(
      STORAGE_KEYS.CLAUDE_MODEL_MAPPING,
      JSON.stringify({
        fable: "kimi-k3",
        opus: "kimi-k3",
        sonnet: "kimi-k3",
        haiku: "kimi-k3",
      }),
    );

    render(
      <ModelSelect
        value="claude-fable-5"
        currentProvider="claude"
        triggerVariant="readiness"
        onChange={vi.fn()}
        models={[
          { id: "claude-fable-5", model: "kimi-k3", label: "Fable 5" },
          { id: "claude-opus-4-8", model: "kimi-k3", label: "Opus 4.8" },
          { id: "claude-sonnet-5", model: "kimi-k3", label: "Sonnet 5" },
          {
            id: "claude-haiku-4-5-20251001",
            model: "kimi-k3",
            label: "Haiku 4.5",
          },
        ]}
        modelGroups={[
          {
            providerId: "claude",
            providerLabel: "Claude Code",
            enabled: true,
            models: [
              { id: "claude-fable-5", model: "kimi-k3", label: "Fable 5" },
              { id: "claude-opus-4-8", model: "kimi-k3", label: "Opus 4.8" },
              { id: "claude-sonnet-5", model: "kimi-k3", label: "Sonnet 5" },
              {
                id: "claude-haiku-4-5-20251001",
                model: "kimi-k3",
                label: "Haiku 4.5",
              },
            ],
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "chat.currentModel:kimi-k3" }),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "chat.currentModel:kimi-k3" }),
    );
    await user.hover(
      await screen.findByRole("menuitem", { name: /Claude Code/ }),
    );

    const fableItem = await screen.findByRole("menuitem", {
      name: /kimi-k3[\s\S]*models\.claude\.fable5\.description|kimi-k3[\s\S]*Fable 5/,
    });
    const opusItem = await screen.findByRole("menuitem", {
      name: /kimi-k3[\s\S]*models\.claude\.opus48\.description|kimi-k3[\s\S]*Opus 4\.8/,
    });
    const sonnetItem = await screen.findByRole("menuitem", {
      name: /kimi-k3[\s\S]*models\.claude\.sonnet5\.description|kimi-k3[\s\S]*Sonnet 5/,
    });
    const haikuItem = await screen.findByRole("menuitem", {
      name: /kimi-k3[\s\S]*models\.claude\.haiku45\.description|kimi-k3[\s\S]*Haiku/,
    });

    for (const item of [fableItem, opusItem, sonnetItem, haikuItem]) {
      expect(item.textContent).toContain("kimi-k3");
      expect(item.querySelector("img")?.getAttribute("src")).toBe(
        "/icons/kimi.svg",
      );
    }
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

  it("renders a root footer action that opens CLI settings", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onOpenCliSettings = vi.fn();

    render(
      <ModelSelect
        value="claude-opus-4-8"
        currentProvider="claude"
        triggerVariant="readiness"
        onChange={vi.fn()}
        onOpenCliSettings={onOpenCliSettings}
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
            providerLabel: "Codex CLI",
            enabled: true,
            models: [{ id: "gpt-5.4", label: "GPT-5.4" }],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "chat.currentModel:Opus 4.8" }));

    const cliSettingsItem = await screen.findByRole("menuitem", {
      name: "models.openCliSettings",
    });
    expect(cliSettingsItem).toBeTruthy();

    fireEvent.click(cliSettingsItem);
    expect(onOpenCliSettings).toHaveBeenCalledTimes(1);
  });

  it("prefers active localStorage mapping over parent-provided tier labels", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.CLAUDE_MODEL_MAPPING,
      JSON.stringify({ sonnet: "kimi-k3" }),
    );

    render(
      <ModelSelect
        value="claude-sonnet-4-6"
        currentProvider="claude"
        onChange={vi.fn()}
        models={[{ id: "claude-sonnet-4-6", label: "Sonnet 4.6" }]}
      />,
    );

    const buttonText = screen.getByRole("button").textContent ?? "";

    expect(buttonText).toContain("kimi-k3");
    expect(buttonText).not.toContain("Sonnet 4.6");
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

const atomicExecutionTarget: ExecutionTarget = {
  engine: "claude",
  providerProfileId: null,
  modelCatalogEntryId: "claude-opus-4-8",
  model: "claude-opus-4-8",
  providerProfileNameSnapshot: "Local settings.json",
  providerProfileSource: "disk",
};

function buildAtomicGroups(): ProviderTargetGroup[] {
  return [
    {
      providerId: "claude" as const,
      providerLabel: "Claude Code",
      enabled: true,
      profiles: [
        {
          id: "__local_settings_json__",
          label: "Local settings.json",
          source: "disk" as const,
          loading: false,
          error: null,
          models: [
            { id: "claude-opus-4-8", label: "Opus 4.8" },
            { id: "claude-sonnet-5", label: "Sonnet 5" },
          ],
        },
        {
          id: "k3",
          label: "k3",
          source: "managed" as const,
          loading: false,
          error: null,
          models: [{ id: "kimi-k3", label: "Kimi K3" }],
        },
      ],
    },
    {
      providerId: "codex" as const,
      providerLabel: "Codex CLI",
      enabled: true,
      profiles: [
        {
          id: "__disk__",
          label: "Local disk",
          source: "disk" as const,
          loading: false,
          error: null,
          models: [{ id: "gpt-5.7", label: "GPT-5.7" }],
        },
      ],
    },
  ];
}

describe("ModelSelect atomic target groups", () => {
  // Radix 子菜单在 jsdom 下的 hover 开启依赖真实定时器,容易抖动;
  // 直接 click SubTrigger 是确定性的打开方式。
  // 注意:jsdom 下 Radix modal layer 会给「后打开」的子菜单留下
  // aria-hidden 残留,第二个子菜单的断言用 byText/DOM 查询而非 byRole。
  function openPickerSubmenu(name: RegExp) {
    const trigger = screen.getByRole("menuitem", { name });
    fireEvent.click(trigger);
    return trigger;
  }

  it("opens the active channel models directly without channel rows", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    render(
      <ModelSelect
        value="claude-opus-4-8"
        currentProvider="claude"
        triggerVariant="readiness"
        onChange={vi.fn()}
        onExecutionTargetChange={vi.fn()}
        executionTarget={atomicExecutionTarget}
        targetGroups={buildAtomicGroups()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "chat.currentModel:Opus 4.8" }),
    );

    await screen.findByRole("menuitem", { name: /Claude Code/ });
    expect(screen.getByRole("menuitem", { name: /Codex CLI/ })).toBeTruthy();
    // No channel/profile rows anywhere in the menu.
    expect(document.querySelector("[data-provider-profile-id]")).toBeNull();
    expect(screen.queryByText("Local settings.json")).toBeNull();
    expect(screen.queryByText("k3")).toBeNull();

    openPickerSubmenu(/Claude Code/);
    expect(await screen.findByRole("menuitem", { name: /Opus 4.8/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Sonnet 5/ })).toBeTruthy();
    // The inactive channel's models stay hidden.
    expect(screen.queryByText("Kimi K3")).toBeNull();

    openPickerSubmenu(/Codex CLI/);
    expect(await screen.findByText("GPT-5.7")).toBeTruthy();
  });

  it("emits a complete execution target when picking a model", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onExecutionTargetChange = vi.fn();

    render(
      <ModelSelect
        value="claude-opus-4-8"
        currentProvider="claude"
        triggerVariant="readiness"
        onChange={vi.fn()}
        onExecutionTargetChange={onExecutionTargetChange}
        executionTarget={atomicExecutionTarget}
        targetGroups={buildAtomicGroups()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "chat.currentModel:Opus 4.8" }),
    );
    await screen.findByRole("menuitem", { name: /Claude Code/ });
    openPickerSubmenu(/Claude Code/);
    fireEvent.click(await screen.findByRole("menuitem", { name: /Sonnet 5/ }));

    expect(onExecutionTargetChange).toHaveBeenCalledWith({
      engine: "claude",
      providerProfileId: null,
      modelCatalogEntryId: "claude-sonnet-5",
      model: "claude-sonnet-5",
      providerProfileNameSnapshot: "Local settings.json",
      providerProfileSource: "disk",
      reasoning: null,
    });
  });

  it("projects the target channel for the current engine and the local default elsewhere", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onOpenProviderProfile = vi.fn();

    render(
      <ModelSelect
        value="kimi-k3"
        currentProvider="claude"
        triggerVariant="readiness"
        onChange={vi.fn()}
        onExecutionTargetChange={vi.fn()}
        onOpenTargetCatalog={vi.fn()}
        onOpenProviderProfile={onOpenProviderProfile}
        executionTarget={{
          ...atomicExecutionTarget,
          providerProfileId: "k3",
          modelCatalogEntryId: "kimi-k3",
          model: "kimi-k3",
        }}
        targetGroups={buildAtomicGroups()}
      />,
    );

    // Trigger resolves the label from the target channel's catalog.
    await user.click(
      screen.getByRole("button", { name: "chat.currentModel:Kimi K3" }),
    );

    await screen.findByRole("menuitem", { name: /Claude Code/ });
    openPickerSubmenu(/Claude Code/);
    expect(await screen.findByRole("menuitem", { name: /Kimi K3/ })).toBeTruthy();
    expect(screen.queryByText("Opus 4.8")).toBeNull();

    // Menu open prefetches the target channel for Claude and the local default for Codex.
    expect(onOpenProviderProfile).toHaveBeenCalledWith("claude", "k3");
    expect(onOpenProviderProfile).toHaveBeenCalledWith("codex", "__disk__");
  });

  it("marks the target engine and model selected", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    render(
      <ModelSelect
        value="claude-opus-4-8"
        currentProvider="claude"
        triggerVariant="readiness"
        onChange={vi.fn()}
        onExecutionTargetChange={vi.fn()}
        executionTarget={atomicExecutionTarget}
        targetGroups={buildAtomicGroups()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "chat.currentModel:Opus 4.8" }),
    );

    const claudeTrigger = await screen.findByRole("menuitem", { name: /Claude Code/ });
    expect(claudeTrigger.getAttribute("data-selected")).toBe("true");
    expect(
      screen.getByRole("menuitem", { name: /Codex CLI/ }).getAttribute("data-selected"),
    ).toBeNull();

    openPickerSubmenu(/Claude Code/);
    const opusItem = await screen.findByRole("menuitem", { name: /Opus 4.8/ });
    expect(opusItem.getAttribute("data-selected")).toBe("true");
    expect(
      screen.getByRole("menuitem", { name: /Sonnet 5/ }).getAttribute("data-selected"),
    ).toBeNull();
  });

  it("shows loading and error rows for the active channel", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const groups = buildAtomicGroups();
    groups[0].profiles[0].loading = true;
    groups[1].profiles[0].error = "disk unreadable";

    render(
      <ModelSelect
        value="claude-opus-4-8"
        currentProvider="claude"
        triggerVariant="readiness"
        onChange={vi.fn()}
        onExecutionTargetChange={vi.fn()}
        executionTarget={atomicExecutionTarget}
        targetGroups={groups}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "chat.currentModel:Opus 4.8" }),
    );

    await screen.findByRole("menuitem", { name: /Claude Code/ });
    openPickerSubmenu(/Claude Code/);
    expect(
      await screen.findByRole("menuitem", { name: /models.refreshingConfig/ }),
    ).toBeTruthy();
    // Last-good models stay interactive while refreshing.
    expect(screen.getByRole("menuitem", { name: /Opus 4.8/ })).toBeTruthy();

    openPickerSubmenu(/Codex CLI/);
    expect((await screen.findByText("disk unreadable")).className).toContain(
      "text-destructive",
    );
  });

  it("reloads only the current engine active channel from the submenu header", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onReloadProviderConfig = vi.fn();

    render(
      <ModelSelect
        value="claude-opus-4-8"
        currentProvider="claude"
        triggerVariant="readiness"
        onChange={vi.fn()}
        onExecutionTargetChange={vi.fn()}
        onReloadProviderConfig={onReloadProviderConfig}
        executionTarget={atomicExecutionTarget}
        targetGroups={buildAtomicGroups()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "chat.currentModel:Opus 4.8" }),
    );

    await screen.findByRole("menuitem", { name: /Claude Code/ });
    openPickerSubmenu(/Claude Code/);
    fireEvent.click(
      await screen.findByRole("button", { name: "models.refreshConfig" }),
    );
    expect(onReloadProviderConfig).toHaveBeenCalledWith(
      "claude",
      "__local_settings_json__",
    );

    openPickerSubmenu(/Codex CLI/);
    const gptItem = await screen.findByText("GPT-5.7");
    const codexSubContent = gptItem.closest(
      "[data-slot='dropdown-menu-sub-content']",
    );
    expect(codexSubContent).toBeTruthy();
    expect(
      codexSubContent!.querySelector(
        "button[aria-label='models.refreshConfig']",
      ),
    ).toBeNull();
  });

  it("disables unavailable engine groups with the disabled reason", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const groups = buildAtomicGroups();
    const kimiGroup = {
      providerId: "kimi" as const,
      providerLabel: "Kimi CLI",
      enabled: false,
      disabledReason: "可作为来源；目标续接尚未验证",
      profiles: [
        {
          id: "__local_config_toml__",
          label: "Local config.toml",
          source: "disk" as const,
          loading: false,
          error: null,
          models: [{ id: "kimi-for-coding", label: "Kimi For Coding" }],
        },
      ],
    };

    render(
      <ModelSelect
        value="claude-opus-4-8"
        currentProvider="claude"
        triggerVariant="readiness"
        onChange={vi.fn()}
        onExecutionTargetChange={vi.fn()}
        executionTarget={atomicExecutionTarget}
        targetGroups={[...groups, kimiGroup]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "chat.currentModel:Opus 4.8" }),
    );

    const kimiTrigger = await screen.findByRole("menuitem", { name: /Kimi CLI/ });
    expect(kimiTrigger.getAttribute("data-disabled")).not.toBeNull();
    expect(kimiTrigger.getAttribute("title")).toBe("可作为来源；目标续接尚未验证");
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
});

describe("buildProviderExecutionTarget", () => {
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
});

describe("resolveActiveProviderProfileId", () => {
  it("uses the target channel for the current engine", () => {
    expect(
      resolveActiveProviderProfileId("claude", {
        engine: "claude",
        providerProfileId: "k3",
      }),
    ).toBe("k3");
  });

  it("falls back to the local default channel for the current engine", () => {
    expect(
      resolveActiveProviderProfileId("claude", {
        engine: "claude",
        providerProfileId: null,
      }),
    ).toBe("__local_settings_json__");
    expect(
      resolveActiveProviderProfileId("claude", {
        engine: "claude",
        providerProfileId: "__local_settings_json__",
      }),
    ).toBe("__local_settings_json__");
  });

  it("always uses the local default channel for other engines", () => {
    expect(
      resolveActiveProviderProfileId("codex", {
        engine: "claude",
        providerProfileId: "k3",
      }),
    ).toBe("__disk__");
    expect(resolveActiveProviderProfileId("grok", null)).toBe(
      "__local_config_toml__",
    );
    expect(
      resolveActiveProviderProfileId("opencode", {
        engine: "claude",
        providerProfileId: null,
      }),
    ).toBe("__local_opencode_json__");
  });

  it("returns null for engines without provider profiles", () => {
    expect(resolveActiveProviderProfileId("gemini", null)).toBeNull();
  });
});
