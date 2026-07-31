// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addClaudeProvider,
  addCodexProvider,
  listCcSwitchProviders,
  listCcSwitchProvidersFromPath,
  updateClaudeProvider,
  updateCodexProvider,
} from "../../../services/tauri";
import type { CcSwitchProvider } from "../../../services/tauri";
import {
  buildClaudeProviderFromCcSwitch,
  buildCodexProviderFromCcSwitch,
  extractCodexTomlBaseUrl,
  useCcSwitchImport,
} from "./useCcSwitchImport";

vi.mock("../../../services/tauri", () => ({
  listCcSwitchProviders: vi.fn(),
  listCcSwitchProvidersFromPath: vi.fn(),
  addClaudeProvider: vi.fn(),
  addCodexProvider: vi.fn(),
  updateClaudeProvider: vi.fn(),
  updateCodexProvider: vi.fn(),
}));

function ccSwitchItem(
  id: string,
  overrides: Partial<CcSwitchProvider> = {},
): CcSwitchProvider {
  return {
    id,
    name: `Provider ${id}`,
    category: "aggregator",
    websiteUrl: null,
    baseUrl: `https://api.example.com/${id}`,
    hasApiKey: true,
    settingsConfig: {
      env: {
        ANTHROPIC_BASE_URL: `https://api.example.com/${id}`,
        ANTHROPIC_AUTH_TOKEN: `sk-${id}`,
        ANTHROPIC_MODEL: `model-${id}`,
      },
    },
    ...overrides,
  };
}

describe("extractCodexTomlBaseUrl", () => {
  it("extracts first base_url from toml text", () => {
    const toml = 'model_provider = "mimo"\n[model_providers.mimo]\nbase_url = "https://ai.17nas.com/v1"\n';
    expect(extractCodexTomlBaseUrl(toml)).toBe("https://ai.17nas.com/v1");
  });

  it("returns null when missing", () => {
    expect(extractCodexTomlBaseUrl("model = \"gpt-5\"")).toBeNull();
    expect(extractCodexTomlBaseUrl(undefined)).toBeNull();
  });
});

describe("provider builders", () => {
  it("maps claude provider with cc-switch source and preserved id", () => {
    const built = buildClaudeProviderFromCcSwitch(ccSwitchItem("p1"));
    expect(built.id).toBe("p1");
    expect(built.name).toBe("Provider p1");
    expect(built.source).toBe("cc-switch");
    expect(built.category).toBe("aggregator");
    expect(built.settingsConfig).toEqual(ccSwitchItem("p1").settingsConfig);
  });

  it("drops unknown category", () => {
    const built = buildClaudeProviderFromCcSwitch(
      ccSwitchItem("p1", { category: "something-else" }),
    );
    expect(built.category).toBeUndefined();
  });

  it("maps codex provider to configToml and authJson with preserved id", () => {
    const item = ccSwitchItem("c1", {
      settingsConfig: {
        auth: { OPENAI_API_KEY: "sk-codex" },
        config: 'base_url = "https://x/v1"',
      },
    });
    const built = buildCodexProviderFromCcSwitch(item);
    expect(built.id).toBe("c1");
    expect(built.source).toBe("cc-switch");
    expect(built.configToml).toBe('base_url = "https://x/v1"');
    expect(JSON.parse(built.authJson)).toEqual({ OPENAI_API_KEY: "sk-codex" });
  });
});

describe("useCcSwitchImport", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(addClaudeProvider).mockResolvedValue(undefined);
    vi.mocked(addCodexProvider).mockResolvedValue(undefined);
    vi.mocked(updateClaudeProvider).mockResolvedValue(undefined);
    vi.mocked(updateCodexProvider).mockResolvedValue(undefined);
  });

  it("does not load while closed", () => {
    renderHook(() =>
      useCcSwitchImport({ target: "claude", existingProviderIds: [], isOpen: false }),
    );
    expect(listCcSwitchProviders).not.toHaveBeenCalled();
  });

  it("marks items as update when the id already exists, new otherwise", async () => {
    vi.mocked(listCcSwitchProviders).mockResolvedValue({
      available: true,
      providers: [ccSwitchItem("a"), ccSwitchItem("b")],
    });
    const { result } = renderHook(() =>
      useCcSwitchImport({
        target: "claude",
        existingProviderIds: ["a"],
        isOpen: true,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.find((item) => item.id === "a")?.status).toBe("update");
    expect(result.current.items.find((item) => item.id === "b")?.status).toBe("new");
    expect(listCcSwitchProviders).toHaveBeenCalledWith("claude");
  });

  it("selects all items by default after loading", async () => {
    vi.mocked(listCcSwitchProviders).mockResolvedValue({
      available: true,
      providers: [ccSwitchItem("a"), ccSwitchItem("b")],
    });
    const { result } = renderHook(() =>
      useCcSwitchImport({ target: "claude", existingProviderIds: [], isOpen: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect([...result.current.selectedIds].sort()).toEqual(["a", "b"]);

    act(() => result.current.toggleAll());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("uses codex appType for codex target", async () => {
    vi.mocked(listCcSwitchProviders).mockResolvedValue({
      available: true,
      providers: [],
    });
    renderHook(() =>
      useCcSwitchImport({ target: "codex", existingProviderIds: [], isOpen: true }),
    );
    await waitFor(() =>
      expect(listCcSwitchProviders).toHaveBeenCalledWith("codex"),
    );
  });

  it("loads from a picked file when sourcePath is provided", async () => {
    vi.mocked(listCcSwitchProvidersFromPath).mockResolvedValue({
      available: true,
      providers: [ccSwitchItem("f1")],
    });
    const { result } = renderHook(() =>
      useCcSwitchImport({
        target: "claude",
        existingProviderIds: [],
        isOpen: true,
        sourcePath: "/tmp/cc-switch.db",
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listCcSwitchProvidersFromPath).toHaveBeenCalledWith(
      "/tmp/cc-switch.db",
      "claude",
    );
    expect(listCcSwitchProviders).not.toHaveBeenCalled();
    expect(result.current.items).toHaveLength(1);
  });

  it("adds new claude items and updates existing ones by id", async () => {
    vi.mocked(listCcSwitchProviders).mockResolvedValue({
      available: true,
      providers: [ccSwitchItem("a"), ccSwitchItem("b")],
    });
    const { result } = renderHook(() =>
      useCcSwitchImport({
        target: "claude",
        existingProviderIds: ["a"],
        isOpen: true,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    let summary: Awaited<ReturnType<typeof result.current.importSelected>>;
    await act(async () => {
      summary = await result.current.importSelected();
    });

    expect(summary!.addedCount).toBe(1);
    expect(summary!.updatedCount).toBe(1);
    expect(summary!.failures).toEqual([]);
    expect(updateClaudeProvider).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({ id: "a", name: "Provider a", source: "cc-switch" }),
    );
    expect(addClaudeProvider).toHaveBeenCalledWith(
      expect.objectContaining({ id: "b", name: "Provider b", source: "cc-switch" }),
    );
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("updates codex providers by id with configToml payload", async () => {
    vi.mocked(listCcSwitchProviders).mockResolvedValue({
      available: true,
      providers: [
        ccSwitchItem("c1", {
          settingsConfig: {
            auth: { OPENAI_API_KEY: "sk-codex" },
            config: 'base_url = "https://x/v1"',
          },
        }),
      ],
    });
    const { result } = renderHook(() =>
      useCcSwitchImport({
        target: "codex",
        existingProviderIds: ["c1"],
        isOpen: true,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.importSelected();
    });

    expect(updateCodexProvider).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        id: "c1",
        source: "cc-switch",
        configToml: 'base_url = "https://x/v1"',
      }),
    );
    expect(addCodexProvider).not.toHaveBeenCalled();
  });

  it("collects failures without aborting remaining imports", async () => {
    vi.mocked(listCcSwitchProviders).mockResolvedValue({
      available: true,
      providers: [ccSwitchItem("a"), ccSwitchItem("b")],
    });
    vi.mocked(addClaudeProvider)
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() =>
      useCcSwitchImport({ target: "claude", existingProviderIds: [], isOpen: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    let summary: Awaited<ReturnType<typeof result.current.importSelected>>;
    await act(async () => {
      summary = await result.current.importSelected();
    });

    expect(summary!.addedCount).toBe(1);
    expect(summary!.failures).toEqual([
      { name: "Provider a", message: "disk full" },
    ]);
    expect(addClaudeProvider).toHaveBeenCalledTimes(2);
  });

  it("handles unavailable source without throwing", async () => {
    vi.mocked(listCcSwitchProviders).mockResolvedValue({
      available: false,
      providers: [],
    });
    const { result } = renderHook(() =>
      useCcSwitchImport({ target: "claude", existingProviderIds: [], isOpen: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.available).toBe(false);
    expect(result.current.items).toEqual([]);
  });
});
