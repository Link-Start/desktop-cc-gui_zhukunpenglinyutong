// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { getConfigModel, getModelList } from "../../../services/tauri";
import { STORAGE_KEYS } from "../../composer/types/provider";
import { useModels } from "./useModels";

vi.mock("../../../services/tauri", () => ({
  getModelList: vi.fn(),
  getConfigModel: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "ccgui",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const workspaceTwo: WorkspaceInfo = {
  id: "workspace-2",
  name: "ccgui-2",
  path: "/tmp/codex-2",
  connected: true,
  settings: { sidebarCollapsed: false },
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useModels", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("adds the config model when it is missing from model/list", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "remote-1",
            model: "gpt-5.1",
            displayName: "GPT-5.1",
            supportedReasoningEfforts: [],
            defaultReasoningEffort: null,
            isDefault: true,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce("custom-model");

    const { result } = renderHook(() =>
      useModels({ activeWorkspace: workspace }),
    );

    await waitFor(() => expect(result.current.selectedModel?.model).toBe("custom-model"));

    expect(getConfigModel).toHaveBeenCalledWith("workspace-1");
    expect(result.current.models[0]).toMatchObject({
      id: "custom-model",
      model: "custom-model",
    });
    expect(result.current.selectedModel?.model).toBe("custom-model");
    expect(result.current.reasoningSupported).toBe(false);
  });

  it("prefers the provider entry when the config model matches by slug", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "provider-id",
            model: "custom-model",
            displayName: "Provider Custom",
            supportedReasoningEfforts: [
              { reasoningEffort: "medium", description: "Medium" },
              { reasoningEffort: "high", description: "High" },
            ],
            defaultReasoningEffort: "medium",
            isDefault: false,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce("custom-model");

    const { result } = renderHook(() =>
      useModels({ activeWorkspace: workspace }),
    );

    await waitFor(() => expect(result.current.selectedModelId).toBe("provider-id"));

    expect(result.current.models[0]?.id).toBe("provider-id");
    expect(result.current.models.some((model) => model.id === "gpt-5.5")).toBe(true);
    expect(result.current.selectedModel?.id).toBe("provider-id");
    expect(result.current.reasoningSupported).toBe(true);
  });

  it("hydrates built-in Codex reasoning options when runtime metadata is empty", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "gpt-5.4",
            model: "gpt-5.4",
            displayName: "gpt-5.4",
            supportedReasoningEfforts: [],
            defaultReasoningEffort: null,
            isDefault: true,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce("gpt-5.4");

    const { result } = renderHook(() =>
      useModels({ activeWorkspace: workspace }),
    );

    await waitFor(() => expect(result.current.selectedModelId).toBe("gpt-5.4"));

    expect(result.current.reasoningOptions).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(result.current.reasoningOptions).not.toContain("max");
    expect(result.current.selectedEffort).toBe("medium");
  });

  it("replaces the startup fallback after runtime reasoning metadata arrives", async () => {
    const modelListRequest = createDeferred<{
      result: {
        data: Array<Record<string, unknown>>;
      };
    }>();
    vi.mocked(getModelList).mockReturnValueOnce(modelListRequest.promise);
    vi.mocked(getConfigModel).mockResolvedValueOnce("gpt-5.6-sol");

    const { result } = renderHook(() =>
      useModels({ activeWorkspace: workspace }),
    );

    await waitFor(() => expect(result.current.selectedModelId).toBe("gpt-5.6-sol"));
    expect(result.current.reasoningOptions).toEqual(["low", "medium", "high", "xhigh"]);

    modelListRequest.resolve({
      result: {
        data: [
          {
            id: "gpt-5.6-sol",
            model: "gpt-5.6-sol",
            displayName: "GPT-5.6-Sol",
            supportedReasoningEfforts: [
              { reasoningEffort: "low", description: "Low" },
              { reasoningEffort: "medium", description: "Medium" },
              { reasoningEffort: "high", description: "High" },
              { reasoningEffort: "xhigh", description: "Extra High" },
              { reasoningEffort: "max", description: "Max" },
              { reasoningEffort: "ultra", description: "Ultra" },
            ],
            defaultReasoningEffort: "low",
            isDefault: true,
          },
        ],
      },
    });

    await waitFor(() =>
      expect(result.current.reasoningOptions).toEqual([
        "low",
        "medium",
        "high",
        "xhigh",
        "max",
        "ultra",
      ]),
    );
    expect(result.current.selectedEffort).toBe("low");
  });

  it("keeps model-specific runtime reasoning metadata ahead of the common fallback", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "gpt-5.6-sol",
            model: "gpt-5.6-sol",
            displayName: "GPT-5.6-Sol",
            supportedReasoningEfforts: [
              { reasoningEffort: "low", description: "Low" },
              { reasoningEffort: "max", description: "Max" },
              { reasoningEffort: "ultra", description: "Ultra" },
            ],
            defaultReasoningEffort: "low",
            isDefault: true,
          },
          {
            id: "gpt-5.6-terra",
            model: "gpt-5.6-terra",
            displayName: "GPT-5.6-Terra",
            supportedReasoningEfforts: [
              { reasoningEffort: "low", description: "Low" },
              { reasoningEffort: "medium", description: "Medium" },
              { reasoningEffort: "high", description: "High" },
              { reasoningEffort: "ultra", description: "Ultra" },
            ],
            defaultReasoningEffort: "medium",
            isDefault: false,
          },
          {
            id: "gpt-5.6-luna",
            model: "gpt-5.6-luna",
            displayName: "GPT-5.6-Luna",
            supportedReasoningEfforts: [
              { reasoningEffort: "medium", description: "Medium" },
              { reasoningEffort: "high", description: "High" },
            ],
            defaultReasoningEffort: "medium",
            isDefault: false,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce("gpt-5.6-sol");

    const { result } = renderHook(() =>
      useModels({ activeWorkspace: workspace }),
    );

    await waitFor(() =>
      expect(result.current.reasoningOptions).toEqual(["low", "max", "ultra"]),
    );
    expect(result.current.models.slice(0, 3).map((model) => model.id)).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
    ]);
    expect(result.current.selectedModelId).toBe("gpt-5.6-sol");
    expect(result.current.selectedEffort).toBe("low");

    act(() => result.current.setSelectedModelId("gpt-5.6-terra"));

    await waitFor(() => expect(result.current.selectedModelId).toBe("gpt-5.6-terra"));
    expect(result.current.reasoningOptions).toEqual(["low", "medium", "high", "ultra"]);

    act(() => result.current.setSelectedModelId("gpt-5.6-luna"));

    await waitFor(() => expect(result.current.selectedModelId).toBe("gpt-5.6-luna"));
    expect(result.current.reasoningOptions).toEqual(["medium", "high"]);
  });

  it("normalizes runtime reasoning metadata when supported efforts are strings", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "gpt-5.6-sol",
            model: "gpt-5.6-sol",
            displayName: "GPT-5.6-Sol",
            supportedReasoningEfforts: ["low", "medium", "high", "xhigh"],
            defaultReasoningEffort: "high",
            isDefault: true,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce("gpt-5.6-sol");

    const { result } = renderHook(() =>
      useModels({ activeWorkspace: workspace }),
    );

    await waitFor(() => expect(result.current.selectedModelId).toBe("gpt-5.6-sol"));

    expect(result.current.reasoningOptions).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(result.current.selectedEffort).toBe("high");
  });

  it("keeps the selected reasoning effort when switching models", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "remote-1",
            model: "gpt-5.1",
            displayName: "GPT-5.1",
            supportedReasoningEfforts: [
              { reasoningEffort: "low", description: "Low" },
              { reasoningEffort: "medium", description: "Medium" },
            ],
            defaultReasoningEffort: "medium",
            isDefault: true,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce("custom-model");

    const { result } = renderHook(() =>
      useModels({ activeWorkspace: workspace }),
    );

    await waitFor(() => expect(result.current.models.some((model) => model.id === "custom-model")).toBe(true));

    act(() => {
      result.current.setSelectedEffort("high");
      result.current.setSelectedModelId("custom-model");
    });

    await waitFor(() => {
      expect(result.current.selectedModelId).toBe("custom-model");
      expect(result.current.selectedEffort).toBe("high");
    });
  });

  it("keeps a user-selected custom Codex model in the selectable model set", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.CODEX_CUSTOM_MODELS,
      JSON.stringify([{ id: "demo-model", label: "Demo" }]),
    );
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "gpt-5.5",
            model: "gpt-5.5",
            displayName: "gpt-5.5",
            supportedReasoningEfforts: [],
            defaultReasoningEffort: "medium",
            isDefault: true,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce("gpt-5.5");

    const { result } = renderHook(() =>
      useModels({ activeWorkspace: workspace }),
    );

    await waitFor(() =>
      expect(result.current.models.some((model) => model.id === "demo-model")).toBe(true),
    );

    act(() => {
      result.current.setSelectedModelId("demo-model");
    });

    await waitFor(() => {
      expect(result.current.selectedModelId).toBe("demo-model");
      expect(result.current.selectedModel?.displayName).toBe("Demo");
    });
  });

  it("waits for persisted composer settings before choosing the Codex default model", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.CODEX_CUSTOM_MODELS,
      JSON.stringify([{ id: "demo-model", label: "Demo" }]),
    );
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "gpt-5.5",
            model: "gpt-5.5",
            displayName: "gpt-5.5",
            supportedReasoningEfforts: [],
            defaultReasoningEffort: "medium",
            isDefault: true,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce("gpt-5.5");

    type HookProps = {
      preferredModelId: string | null;
      preferredSelectionReady: boolean;
    };
    const initialProps: HookProps = {
      preferredModelId: null,
      preferredSelectionReady: false,
    };

    const { result, rerender } = renderHook(
      ({ preferredModelId, preferredSelectionReady }: HookProps) =>
        useModels({
          activeWorkspace: workspace,
          preferredModelId,
          preferredSelectionReady,
        }),
      {
        initialProps,
      },
    );

    await waitFor(() =>
      expect(result.current.models.some((model) => model.id === "gpt-5.5")).toBe(true),
    );

    expect(result.current.selectedModelId).toBeNull();

    rerender({
      preferredModelId: "demo-model",
      preferredSelectionReady: true,
    });

    await waitFor(() => {
      expect(result.current.selectedModelId).toBe("demo-model");
      expect(result.current.selectedModel?.displayName).toBe("Demo");
    });
  });

  it("ignores stale model responses after switching workspaces", async () => {
    const workspaceOneModels = createDeferred<Awaited<ReturnType<typeof getModelList>>>();
    const workspaceOneConfig = createDeferred<string | null>();

    vi.mocked(getModelList).mockImplementation((workspaceId: string) => {
      if (workspaceId === workspace.id) {
        return workspaceOneModels.promise;
      }
      return Promise.resolve({
        result: {
          data: [
            {
              id: "workspace-2-model",
              model: "workspace-2-model",
              displayName: "Workspace 2 Model",
              supportedReasoningEfforts: [],
              defaultReasoningEffort: null,
              isDefault: true,
            },
          ],
        },
      });
    });
    vi.mocked(getConfigModel).mockImplementation((workspaceId: string) => {
      if (workspaceId === workspace.id) {
        return workspaceOneConfig.promise;
      }
      return Promise.resolve("workspace-2-model");
    });

    const { result, rerender } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo }) =>
        useModels({ activeWorkspace }),
      {
        initialProps: {
          activeWorkspace: workspace,
        },
      },
    );

    await waitFor(() => {
      expect(getModelList).toHaveBeenCalledWith("workspace-1");
    });

    rerender({ activeWorkspace: workspaceTwo });

    await waitFor(() => {
      expect(result.current.selectedModel?.model).toBe("workspace-2-model");
    });

    await act(async () => {
      workspaceOneConfig.resolve("workspace-1-model");
      workspaceOneModels.resolve({
        result: {
          data: [
            {
              id: "workspace-1-model",
              model: "workspace-1-model",
              displayName: "Workspace 1 Model",
              supportedReasoningEfforts: [],
              defaultReasoningEffort: null,
              isDefault: true,
            },
          ],
        },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.selectedModel?.model).toBe("workspace-2-model");
    });
  });

  it("clears the previous workspace selection while the next workspace catalog is still loading", async () => {
    const workspaceOneModels = createDeferred<Awaited<ReturnType<typeof getModelList>>>();
    const workspaceOneConfig = createDeferred<string | null>();
    const workspaceTwoModels = createDeferred<Awaited<ReturnType<typeof getModelList>>>();
    const workspaceTwoConfig = createDeferred<string | null>();

    vi.mocked(getModelList).mockImplementation((workspaceId: string) => {
      if (workspaceId === workspace.id) {
        return workspaceOneModels.promise;
      }
      return workspaceTwoModels.promise;
    });
    vi.mocked(getConfigModel).mockImplementation((workspaceId: string) => {
      if (workspaceId === workspace.id) {
        return workspaceOneConfig.promise;
      }
      return workspaceTwoConfig.promise;
    });

    const { result, rerender } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo }) =>
        useModels({ activeWorkspace }),
      {
        initialProps: {
          activeWorkspace: workspace,
        },
      },
    );

    await act(async () => {
      workspaceOneConfig.resolve("workspace-1-model");
      workspaceOneModels.resolve({
        result: {
          data: [
            {
              id: "workspace-1-model",
              model: "workspace-1-model",
              displayName: "Workspace 1 Model",
              supportedReasoningEfforts: [],
              defaultReasoningEffort: null,
              isDefault: true,
            },
          ],
        },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.selectedModel?.model).toBe("workspace-1-model");
      expect(result.current.modelsReady).toBe(true);
    });

    rerender({ activeWorkspace: workspaceTwo });

    expect(result.current.selectedModelId).not.toBe("workspace-1-model");
    expect(result.current.selectedModel?.model).not.toBe("workspace-1-model");
    expect(result.current.modelsReady).toBe(false);
    expect(result.current.globalSelectionReady).toBe(false);
  });

  it("does not repeat active workspace refresh when model/list returns an empty catalog", async () => {
    vi.mocked(getModelList).mockResolvedValue({
      result: {
        data: [],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValue(null);

    const { result } = renderHook(() =>
      useModels({
        activeWorkspace: workspace,
        preferredSelectionReady: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.modelsReady).toBe(true);
    });

    expect(getModelList).toHaveBeenCalledTimes(1);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getModelList).toHaveBeenCalledTimes(1);
    expect(result.current.models.length).toBeGreaterThan(0);
  });

  it("does not repeat active workspace refresh when model/list fails without config fallback", async () => {
    vi.mocked(getModelList).mockRejectedValue(new Error("model/list failed"));
    vi.mocked(getConfigModel).mockResolvedValue(null);

    const { result } = renderHook(() =>
      useModels({
        activeWorkspace: workspace,
        preferredSelectionReady: true,
      }),
    );

    await waitFor(() => {
      expect(getModelList).toHaveBeenCalledWith("workspace-1");
    });

    await waitFor(() => {
      expect(result.current.modelsReady).toBe(false);
      expect(result.current.globalSelectionReady).toBe(false);
    });

    expect(getModelList).toHaveBeenCalledTimes(1);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getModelList).toHaveBeenCalledTimes(1);
  });

  it("does not mark the global selection as ready when the workspace catalog request fails", async () => {
    vi.mocked(getModelList).mockRejectedValueOnce(new Error("model/list failed"));
    vi.mocked(getConfigModel).mockResolvedValueOnce("gpt-5.5");

    const { result } = renderHook(() =>
      useModels({
        activeWorkspace: workspace,
        preferredSelectionReady: true,
      }),
    );

    await waitFor(() => {
      expect(getModelList).toHaveBeenCalledWith("workspace-1");
    });

    await waitFor(() => {
      expect(result.current.globalSelectionReady).toBe(false);
      expect(result.current.modelsReady).toBe(false);
    });
  });
});
