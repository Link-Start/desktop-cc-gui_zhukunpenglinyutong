import { describe, expect, it } from "vitest";
import {
  getVisibleCommitMessageEngines,
  readInitialCommitMessageMenuEngine,
} from "./commitMessageMenuConfig";

describe("commitMessageMenuConfig", () => {
  it("derives commit engines from the global registry and product policy", () => {
    expect(getVisibleCommitMessageEngines()).toEqual([
      "claude",
      "codex",
      "grok",
      "kimi",
      "opencode",
    ]);
  });

  it("removes user-disabled engines without changing registry order", () => {
    expect(
      getVisibleCommitMessageEngines(new Set(["grok", "opencode"])),
    ).toEqual(["claude", "codex", "kimi"]);
  });

  it("defaults the generator button icon to the first visible engine", () => {
    expect(readInitialCommitMessageMenuEngine(new Set(["claude"]))).toBe(
      "codex",
    );
  });
});
