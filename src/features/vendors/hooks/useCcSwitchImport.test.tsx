// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addClaudeProvider,
  addCodexProvider,
  addKimiProvider,
  listCcSwitchProviders,
} from "../../../services/tauri";
import type { CcSwitchProvider } from "../../../services/tauri";
import {
  buildClaudeProviderFromCcSwitch,
  buildCodexProviderFromCcSwitch,
  buildKimiProviderFromCcSwitch,
  extractCodexTomlBaseUrl,
  normalizeDedupKey,
  useCcSwitchImport,
} from "./useCcSwitchImport";

vi.mock("../../../services/tauri", () => ({
  listCcSwitchProviders: vi.fn(),
  addClaudeProvider: vi.fn(),
  addCodexProvider: vi.fn(),
  addKimiProvider: vi.fn(),
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

describe("normalizeDedupKey", () => {
  it("normalizes case, whitespace and trailing slashes", () => {
    expect(normalizeDedupKey(" DeepSeek ", "https://a.com/")).toBe(
      normalizeDedupKey("deepseek", "https://A.com"),
    );
  });

  it("treats missing baseUrl as empty", () => {
    expect(normalizeDedupKey("a", null)).toBe(normalizeDedupKey("a", ""));
  });
});

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
  it("maps claude provider with cc-switch source", () => {
    const built = buildClaudeProviderFromCcSwitch(ccSwitchItem("p1"));
    expect(built.name).toBe("Provider p1");
    expect(built.source).toBe("cc-switch");
    expect(built.category).toBe("aggregator");
    expect(built.settingsConfig).toEqual(ccSwitchItem("p1").settingsConfig);
    expect(built.id).toBeTruthy();
  });

  it("drops unknown category", () => {
    const built = buildClaudeProviderFromCcSwitch(
      ccSwitchItem("p1", { category: "something-else" }),
    );
    expect(built.category).toBeUndefined();
  });

  it("maps codex provider to configToml and authJson", () => {
    const item = ccSwitchItem("c1", {
      settingsConfig: {
        auth: { OPENAI_API_KEY: "sk-codex" },
        config: 'base_url = "https://x/v1"',
      },
    });
    const built = buildCodexProviderFromCcSwitch(item);
    expect(built.configToml).toBe('base_url = "https://x/v1"');
    expect(JSON.parse(built.authJson)).toEqual({ OPENAI_API_KEY: "sk-codex" });
  });

  it("maps kimi provider from anthropic env", () => {
    const built = buildKimiProviderFromCcSwitch(ccSwitchItem("k1"));
    expect(built.baseUrl).toBe("https://api.example.com/k1");
    expect(built.apiKey).toBe("sk-k1");
    expect(built.model).toBe("model-k1");
  });
});

describe("useCcSwitchImport", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(addClaudeProvider).mockResolvedValue(undefined);
    vi.mocked(addCodexProvider).mockResolvedValue(undefined);
    vi.mocked(addKimiProvider).mockResolvedValue(undefined);
  });

  it("does not load while closed", () => {
    renderHook(() =>
      useCcSwitchImport({ target: "claude", existingProviders: [], isOpen: false }),
    );
    expect(listCcSwitchProviders).not.toHaveBeenCalled();
  });

  it("marks existing providers as imported via name + baseUrl", async () => {
    vi.mocked(listCcSwitchProviders).mockResolvedValue({
      available: true,
      providers: [ccSwitchItem("a"), ccSwitchItem("b")],
    });
    const { result } = renderHook(() =>
      useCcSwitchImport({
        target: "claude",
        existingProviders: [
          { name: "Provider a", baseUrl: "https://api.example.com/a/" },
        ],
        isOpen: true,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.find((item) => item.id === "a")?.imported).toBe(true);
    expect(result.current.items.find((item) => item.id === "b")?.imported).toBe(false);
    expect(listCcSwitchProviders).toHaveBeenCalledWith("claude");
  });

  it("uses codex appType for codex target", async () => {
    vi.mocked(listCcSwitchProviders).mockResolvedValue({
      available: true,
      providers: [],
    });
    renderHook(() =>
      useCcSwitchImport({ target: "codex", existingProviders: [], isOpen: true }),
    );
    await waitFor(() =>
      expect(listCcSwitchProviders).toHaveBeenCalledWith("codex"),
    );
  });

  it("toggleAll only selects non-imported items", async () => {
    vi.mocked(listCcSwitchProviders).mockResolvedValue({
      available: true,
      providers: [ccSwitchItem("a"), ccSwitchItem("b")],
    });
    const { result } = renderHook(() =>
      useCcSwitchImport({
        target: "claude",
        existingProviders: [{ name: "Provider a", baseUrl: "https://api.example.com/a" }],
        isOpen: true,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleAll());
    expect([...result.current.selectedIds]).toEqual(["b"]);

    act(() => result.current.toggleAll());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("imports selected claude items and marks them imported", async () => {
    vi.mocked(listCcSwitchProviders).mockResolvedValue({
      available: true,
      providers: [ccSwitchItem("a"), ccSwitchItem("b")],
    });
    const { result } = renderHook(() =>
      useCcSwitchImport({ target: "claude", existingProviders: [], isOpen: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleItem("a"));
    let summary: Awaited<ReturnType<typeof result.current.importSelected>>;
    await act(async () => {
      summary = await result.current.importSelected();
    });

    expect(summary!.importedCount).toBe(1);
    expect(summary!.failures).toEqual([]);
    expect(addClaudeProvider).toHaveBeenCalledTimes(1);
    expect(addClaudeProvider).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Provider a", source: "cc-switch" }),
    );
    expect(result.current.items.find((item) => item.id === "a")?.imported).toBe(true);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("collects failures without aborting remaining imports", async () => {
    vi.mocked(listCcSwitchProviders).mockResolvedValue({
      available: true,
      providers: [ccSwitchItem("a"), ccSwitchItem("b")],
    });
    vi.mocked(addKimiProvider)
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() =>
      useCcSwitchImport({ target: "kimi", existingProviders: [], isOpen: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleAll());
    let summary: Awaited<ReturnType<typeof result.current.importSelected>>;
    await act(async () => {
      summary = await result.current.importSelected();
    });

    expect(summary!.importedCount).toBe(1);
    expect(summary!.failures).toEqual([
      { name: "Provider a", message: "disk full" },
    ]);
    expect(addKimiProvider).toHaveBeenCalledTimes(2);
    expect(result.current.items.find((item) => item.id === "b")?.imported).toBe(true);
    expect(result.current.items.find((item) => item.id === "a")?.imported).toBe(false);
  });

  it("handles unavailable source without throwing", async () => {
    vi.mocked(listCcSwitchProviders).mockResolvedValue({
      available: false,
      providers: [],
    });
    const { result } = renderHook(() =>
      useCcSwitchImport({ target: "claude", existingProviders: [], isOpen: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.available).toBe(false);
    expect(result.current.items).toEqual([]);
  });
});
