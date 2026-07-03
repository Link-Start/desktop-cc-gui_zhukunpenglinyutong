// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  __resetComposerEnginePrefsStoreForTests,
  getComposerEnginePrefForEngine,
  getComposerEnginePrefsSnapshot,
  seedComposerEnginePrefs,
  setComposerEnginePref,
  useComposerEnginePrefs,
} from "./composerEnginePrefsStore";

describe("composerEnginePrefsStore", () => {
  afterEach(() => {
    __resetComposerEnginePrefsStoreForTests();
  });

  it("merges a patch and keeps engines isolated", () => {
    setComposerEnginePref("claude", { modelId: "claude-opus-4-8" });
    setComposerEnginePref("claude", { effort: "max" });
    setComposerEnginePref("gemini", { modelId: "gemini-3" });

    const claude = getComposerEnginePrefForEngine("claude");
    expect(claude.modelId).toBe("claude-opus-4-8");
    expect(claude.effort).toBe("max");
    expect(getComposerEnginePrefForEngine("gemini").modelId).toBe("gemini-3");
    // 未写入的引擎返回空偏好。
    expect(getComposerEnginePrefForEngine("codex").modelId).toBeNull();
  });

  it("returns false and keeps the same reference when the value is unchanged", () => {
    expect(setComposerEnginePref("claude", { modelId: "a" })).toBe(true);
    const before = getComposerEnginePrefsSnapshot();
    expect(setComposerEnginePref("claude", { modelId: "a" })).toBe(false);
    expect(getComposerEnginePrefsSnapshot()).toBe(before);
  });

  it("seeds from a persisted record and skips notifying on same reference", () => {
    const record = { claude: { modelId: "seed", effort: null, accessMode: null, collaborationModeId: null } };
    seedComposerEnginePrefs(record);
    expect(getComposerEnginePrefForEngine("claude").modelId).toBe("seed");
    expect(getComposerEnginePrefsSnapshot()).toBe(record);
  });

  it("re-renders subscribers only when a value actually changes", () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useComposerEnginePrefs();
    });
    const mountRenderCount = renderCount;

    // 同值写入不通知。
    act(() => {
      setComposerEnginePref("claude", { modelId: null });
    });
    expect(renderCount).toBe(mountRenderCount);

    act(() => {
      setComposerEnginePref("claude", { modelId: "changed" });
    });
    expect(renderCount).toBeGreaterThan(mountRenderCount);
    expect(result.current.claude?.modelId).toBe("changed");
  });
});
