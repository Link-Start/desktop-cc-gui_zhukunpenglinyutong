// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AppSettings } from "../../types";
import {
  buildComposerEditorSettings,
  useComposerEditorSettings,
} from "./composerEditorSettings";

const appSettings = {
  composerEditorPreset: "smart",
  composerFenceExpandOnSpace: true,
  composerFenceExpandOnEnter: false,
  composerFenceLanguageTags: true,
  composerFenceWrapSelection: false,
  composerFenceAutoWrapPasteMultiline: true,
  composerFenceAutoWrapPasteCodeLike: false,
  composerListContinuation: true,
} as AppSettings;

describe("buildComposerEditorSettings", () => {
  it("maps all composer editor fields from AppSettings", () => {
    expect(buildComposerEditorSettings(appSettings)).toEqual({
      preset: "smart",
      expandFenceOnSpace: true,
      expandFenceOnEnter: false,
      fenceLanguageTags: true,
      fenceWrapSelection: false,
      autoWrapPasteMultiline: true,
      autoWrapPasteCodeLike: false,
      continueListOnShiftEnter: true,
    });
  });
});

describe("useComposerEditorSettings", () => {
  it("keeps reference stable when appSettings identity changes but fields do not", () => {
    const { result, rerender } = renderHook(
      ({ settings }) => useComposerEditorSettings(settings),
      { initialProps: { settings: appSettings } },
    );
    const before = result.current;

    rerender({ settings: { ...appSettings } });
    expect(result.current).toBe(before);
  });

  it("produces a new reference when a tracked field changes", () => {
    const { result, rerender } = renderHook(
      ({ settings }) => useComposerEditorSettings(settings),
      { initialProps: { settings: appSettings } },
    );
    const before = result.current;

    rerender({
      settings: { ...appSettings, composerEditorPreset: "helpful" },
    });
    expect(result.current).not.toBe(before);
    expect(result.current.preset).toBe("helpful");
  });
});
