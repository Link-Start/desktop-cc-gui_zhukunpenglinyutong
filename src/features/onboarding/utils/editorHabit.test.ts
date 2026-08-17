import { describe, expect, it } from "vitest";
import type { AppSettings, OpenAppTarget } from "../../../types";
import { applyEditorHabitToAppSettings } from "./editorHabit";

const cursorTarget: OpenAppTarget = {
  id: "cursor",
  label: "Cursor",
  kind: "app",
  appName: "Cursor",
  args: [],
};

function baseSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    openAppTargets: [],
    selectedOpenAppId: "",
    ...overrides,
  } as AppSettings;
}

describe("applyEditorHabitToAppSettings", () => {
  it("adds the VS Code preset and selects it", () => {
    const next = applyEditorHabitToAppSettings(baseSettings(), "vscode");
    expect(next.selectedOpenAppId).toBe("vscode");
    expect(next.openAppTargets.some((target) => target.id === "vscode")).toBe(true);
  });

  it("leaves open-app settings alone for unused editors", () => {
    const current = baseSettings({
      selectedOpenAppId: "cursor",
      openAppTargets: [cursorTarget],
    });
    const next = applyEditorHabitToAppSettings(current, "none");
    expect(next).toBe(current);
  });
});
