import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getOpenCodeAgentsList, getOpenCodeCommandsList } from "./skills";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("OpenCode catalog soft-empty when CLI is unavailable", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("returns empty commands when OpenCode CLI is not installed", async () => {
    vi.mocked(invoke).mockRejectedValue("OpenCode CLI not found");

    await expect(getOpenCodeCommandsList()).resolves.toEqual([]);
    expect(invoke).toHaveBeenCalledWith("opencode_commands_list", {
      refresh: false,
    });
  });

  it("returns empty agents when OpenCode CLI is not installed", async () => {
    vi.mocked(invoke).mockRejectedValue("OpenCode CLI not found");

    await expect(getOpenCodeAgentsList()).resolves.toEqual([]);
    expect(invoke).toHaveBeenCalledWith("opencode_agents_list", {
      refresh: false,
    });
  });

  it("still surfaces unexpected OpenCode catalog failures", async () => {
    vi.mocked(invoke).mockRejectedValue("opencode --help failed: boom");

    await expect(getOpenCodeCommandsList()).rejects.toMatch(/boom/);
  });
});
