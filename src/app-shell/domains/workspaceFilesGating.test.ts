import { describe, expect, it } from "vitest";
import { resolveWorkspaceFilesLoadFlags } from "./workspaceFilesGating";

describe("resolveWorkspaceFilesLoadFlags", () => {
  it("enables initial load only with an active workspace id", () => {
    expect(
      resolveWorkspaceFilesLoadFlags({
        activeWorkspaceId: "ws-1",
        isCompact: false,
        rightPanelCollapsed: false,
        filePanelMode: "files",
      }).initialLoadEnabled,
    ).toBe(true);
    expect(
      resolveWorkspaceFilesLoadFlags({
        activeWorkspaceId: null,
        isCompact: false,
        rightPanelCollapsed: false,
        filePanelMode: "files",
      }).initialLoadEnabled,
    ).toBe(false);
    expect(
      resolveWorkspaceFilesLoadFlags({
        activeWorkspaceId: undefined,
        isCompact: false,
        rightPanelCollapsed: false,
        filePanelMode: "files",
      }).initialLoadEnabled,
    ).toBe(false);
  });

  it("enables polling only when files panel is visible on non-compact layout", () => {
    const base = {
      activeWorkspaceId: "ws-1",
      isCompact: false,
      rightPanelCollapsed: false,
      filePanelMode: "files" as const,
    };
    expect(resolveWorkspaceFilesLoadFlags(base).pollingEnabled).toBe(true);
    expect(
      resolveWorkspaceFilesLoadFlags({ ...base, isCompact: true })
        .pollingEnabled,
    ).toBe(false);
    expect(
      resolveWorkspaceFilesLoadFlags({ ...base, rightPanelCollapsed: true })
        .pollingEnabled,
    ).toBe(false);
    expect(
      resolveWorkspaceFilesLoadFlags({ ...base, filePanelMode: "git" })
        .pollingEnabled,
    ).toBe(false);
  });
});
