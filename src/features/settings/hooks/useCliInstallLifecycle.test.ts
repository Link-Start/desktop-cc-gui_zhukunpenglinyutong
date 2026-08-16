import { describe, expect, it } from "vitest";
import { resolveCliInstallStrategy } from "./useCliInstallLifecycle";

describe("resolveCliInstallStrategy", () => {
  it("uses official native installer for Claude install and uninstall", () => {
    expect(resolveCliInstallStrategy("claude", "installLatest")).toBe(
      "officialNative",
    );
    expect(resolveCliInstallStrategy("claude", "uninstall")).toBe(
      "officialNative",
    );
  });

  it("uses official native installer for Claude upgrade", () => {
    expect(resolveCliInstallStrategy("claude", "updateLatest")).toBe(
      "officialNative",
    );
  });

  it("keeps npm global for Codex and Kimi", () => {
    expect(resolveCliInstallStrategy("codex", "installLatest")).toBe(
      "npmGlobal",
    );
    expect(resolveCliInstallStrategy("kimi", "updateLatest")).toBe("npmGlobal");
  });

  it("keeps npm global for Grok", () => {
    expect(resolveCliInstallStrategy("grok", "installLatest")).toBe(
      "npmGlobal",
    );
    expect(resolveCliInstallStrategy("grok", "updateLatest")).toBe("npmGlobal");
  });

  it("keeps npm global for OpenCode", () => {
    expect(resolveCliInstallStrategy("opencode", "installLatest")).toBe(
      "npmGlobal",
    );
    expect(resolveCliInstallStrategy("opencode", "updateLatest")).toBe(
      "npmGlobal",
    );
  });

  it("keeps npm global for DSH", () => {
    expect(resolveCliInstallStrategy("dsh", "installLatest")).toBe("npmGlobal");
    expect(resolveCliInstallStrategy("dsh", "updateLatest")).toBe("npmGlobal");
  });
});
