import { describe, expect, it } from "vitest";
import { resolveShouldLoadGitHubPanelData } from "./gitHubPanelGating";

describe("resolveShouldLoadGitHubPanelData", () => {
  it("loads when git panel shows issues or prs", () => {
    expect(
      resolveShouldLoadGitHubPanelData({
        gitPanelMode: "issues",
        shouldLoadDiffs: false,
        diffSource: "local",
      }),
    ).toBe(true);
    expect(
      resolveShouldLoadGitHubPanelData({
        gitPanelMode: "prs",
        shouldLoadDiffs: false,
        diffSource: "local",
      }),
    ).toBe(true);
  });

  it("loads for PR diffs only when diffs should load", () => {
    expect(
      resolveShouldLoadGitHubPanelData({
        gitPanelMode: "diff",
        shouldLoadDiffs: true,
        diffSource: "pr",
      }),
    ).toBe(true);
    expect(
      resolveShouldLoadGitHubPanelData({
        gitPanelMode: "diff",
        shouldLoadDiffs: false,
        diffSource: "pr",
      }),
    ).toBe(false);
  });

  it("does not load for local/commit diffs or log panel", () => {
    expect(
      resolveShouldLoadGitHubPanelData({
        gitPanelMode: "diff",
        shouldLoadDiffs: true,
        diffSource: "local",
      }),
    ).toBe(false);
    expect(
      resolveShouldLoadGitHubPanelData({
        gitPanelMode: "diff",
        shouldLoadDiffs: true,
        diffSource: "commit",
      }),
    ).toBe(false);
    expect(
      resolveShouldLoadGitHubPanelData({
        gitPanelMode: "log",
        shouldLoadDiffs: true,
        diffSource: "pr",
      }),
    ).toBe(true); // shouldLoadDiffs && diffSource === "pr" 与面板模式无关
  });
});
