import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLIENT_UI_VISIBILITY_PREFERENCE,
  isClientUiControlPreferenceVisible,
  isClientUiControlVisible,
  isClientUiPanelVisible,
  normalizeClientUiVisibilityPreference,
  setClientUiControlVisibility,
  setClientUiPanelVisibility,
} from "./clientUiVisibility";

describe("clientUiVisibility", () => {
  it("treats missing and malformed preferences as default visibility", () => {
    expect(normalizeClientUiVisibilityPreference(null)).toEqual(
      DEFAULT_CLIENT_UI_VISIBILITY_PREFERENCE,
    );
    expect(
      normalizeClientUiVisibilityPreference({
        panels: { topSessionTabs: "nope", unknown: false },
        controls: { "topTool.terminal": 0, "future.control": false },
      }),
    ).toEqual(DEFAULT_CLIENT_UI_VISIBILITY_PREFERENCE);
  });

  it("keeps the client documentation entry hidden by default", () => {
    expect(
      isClientUiControlVisible(
        DEFAULT_CLIENT_UI_VISIBILITY_PREFERENCE,
        "topTool.clientDocumentation",
      ),
    ).toBe(false);

    const visiblePreference = setClientUiControlVisibility(
      DEFAULT_CLIENT_UI_VISIBILITY_PREFERENCE,
      "topTool.clientDocumentation",
      true,
    );
    expect(isClientUiControlVisible(visiblePreference, "topTool.clientDocumentation")).toBe(true);
  });

  it("keeps governance evidence opt-in and round-trips visibility", () => {
    expect(
      isClientUiControlVisible(
        DEFAULT_CLIENT_UI_VISIBILITY_PREFERENCE,
        "bottomActivity.governanceEvidence",
      ),
    ).toBe(false);

    const enabled = setClientUiControlVisibility(
      DEFAULT_CLIENT_UI_VISIBILITY_PREFERENCE,
      "bottomActivity.governanceEvidence",
      true,
    );
    expect(
      isClientUiControlVisible(enabled, "bottomActivity.governanceEvidence"),
    ).toBe(true);

    const disabled = setClientUiControlVisibility(
      enabled,
      "bottomActivity.governanceEvidence",
      false,
    );
    expect(
      isClientUiControlVisible(disabled, "bottomActivity.governanceEvidence"),
    ).toBe(false);
  });

  it("keeps checkpoint details hidden by default and round-trips visibility", () => {
    expect(
      isClientUiControlVisible(
        DEFAULT_CLIENT_UI_VISIBILITY_PREFERENCE,
        "bottomActivity.checkpointDetails",
      ),
    ).toBe(false);

    const enabled = setClientUiControlVisibility(
      DEFAULT_CLIENT_UI_VISIBILITY_PREFERENCE,
      "bottomActivity.checkpointDetails",
      true,
    );
    expect(
      isClientUiControlVisible(enabled, "bottomActivity.checkpointDetails"),
    ).toBe(true);

    const disabled = setClientUiControlVisibility(
      enabled,
      "bottomActivity.checkpointDetails",
      false,
    );
    expect(
      isClientUiControlVisible(disabled, "bottomActivity.checkpointDetails"),
    ).toBe(false);
  });

  it("ignores unknown keys while applying known booleans", () => {
    const preference = normalizeClientUiVisibilityPreference({
      panels: {
        topSessionTabs: false,
        globalRuntimeNoticeDock: false,
        futurePanel: false,
      },
      controls: {
        "topTool.terminal": false,
        "topTool.clientDocumentation": true,
        "rightToolbar.projectMap": false,
        "future.control": false,
      },
    });

    expect(preference).toEqual({
      panels: {
        topToolControls: true,
        rightActivityToolbar: true,
        topSessionTabs: false,
        globalRuntimeNoticeDock: false,
      },
      controls: {
        "topTool.terminal": false,
        "topTool.clientDocumentation": true,
        "rightToolbar.projectMap": false,
        "bottomActivity.checkpointDetails": false,
        "bottomActivity.governanceEvidence": false,
      },
    });
    expect(isClientUiPanelVisible(preference, "topSessionTabs")).toBe(false);
    expect(isClientUiPanelVisible(preference, "globalRuntimeNoticeDock")).toBe(false);
    expect(isClientUiPanelVisible(preference, "topToolControls")).toBe(true);
    expect(isClientUiControlVisible(preference, "topTool.terminal")).toBe(false);
    expect(isClientUiControlVisible(preference, "rightToolbar.projectMap")).toBe(false);
  });

  it("registers Project Map as a default-visible right toolbar control", () => {
    expect(isClientUiControlVisible(DEFAULT_CLIENT_UI_VISIBILITY_PREFERENCE, "rightToolbar.projectMap")).toBe(true);

    const hiddenPreference = setClientUiControlVisibility(
      DEFAULT_CLIENT_UI_VISIBILITY_PREFERENCE,
      "rightToolbar.projectMap",
      false,
    );

    expect(hiddenPreference.controls["rightToolbar.projectMap"]).toBe(false);
    expect(isClientUiControlVisible(hiddenPreference, "rightToolbar.projectMap")).toBe(false);
  });

  it("applies default hidden controls to legacy preferences that do not mention them", () => {
    const preference = normalizeClientUiVisibilityPreference({
      panels: {},
      controls: { "topTool.terminal": false },
    });

    expect(preference.controls).toEqual({
      "topTool.clientDocumentation": false,
      "topTool.terminal": false,
      "bottomActivity.checkpointDetails": false,
      "bottomActivity.governanceEvidence": false,
    });
    expect(isClientUiControlVisible(preference, "topTool.clientDocumentation")).toBe(false);
    expect(
      isClientUiControlVisible(preference, "bottomActivity.governanceEvidence"),
    ).toBe(false);
    expect(
      isClientUiControlVisible(preference, "bottomActivity.checkpointDetails"),
    ).toBe(false);
  });

  it("migrates legacy edits preferences into checkpoint visibility", () => {
    const preference = normalizeClientUiVisibilityPreference({
      panels: {},
      controls: {
        "bottomActivity.edits": false,
      },
    });

    expect(preference.controls).toEqual({
      "topTool.clientDocumentation": false,
      "bottomActivity.checkpoint": false,
      "bottomActivity.checkpointDetails": false,
      "bottomActivity.governanceEvidence": false,
    });
    expect(isClientUiControlVisible(preference, "bottomActivity.checkpoint")).toBe(false);
  });

  it("keeps essential chrome panels visible even when preference stores false", () => {
    const preference = normalizeClientUiVisibilityPreference({
      panels: {
        topToolControls: false,
        rightActivityToolbar: false,
        topSessionTabs: false,
      },
      controls: {},
    });

    expect(preference.panels.topToolControls).toBe(true);
    expect(preference.panels.rightActivityToolbar).toBe(true);
    expect(isClientUiPanelVisible(preference, "topToolControls")).toBe(true);
    expect(isClientUiPanelVisible(preference, "rightActivityToolbar")).toBe(true);
    // Session tabs stay a user preference, not essential chrome.
    expect(isClientUiPanelVisible(preference, "topSessionTabs")).toBe(false);
    expect(preference.panels.topSessionTabs).toBe(false);
  });

  it("lets non-essential parent panel hiding override child visibility", () => {
    const preference = setClientUiControlVisibility(
      setClientUiPanelVisibility(
        DEFAULT_CLIENT_UI_VISIBILITY_PREFERENCE,
        "topRunControls",
        false,
      ),
      "topRun.start",
      true,
    );

    expect(isClientUiPanelVisible(preference, "topRunControls")).toBe(false);
    expect(
      isClientUiControlPreferenceVisible(preference, "topRun.start"),
    ).toBe(true);
    expect(isClientUiControlVisible(preference, "topRun.start")).toBe(false);
  });
});
