import { describe, expect, it } from "vitest";
import { resolveAppModeSurfaceFlags } from "./appModeSurfaceFlags";

describe("resolveAppModeSurfaceFlags", () => {
  it("treats chat and gitHistory as git surface modes", () => {
    expect(resolveAppModeSurfaceFlags("chat").isGitSurfaceMode).toBe(true);
    expect(resolveAppModeSurfaceFlags("gitHistory").isGitSurfaceMode).toBe(
      true,
    );
    expect(resolveAppModeSurfaceFlags("extensions").isGitSurfaceMode).toBe(
      false,
    );
  });

  it("flags extensions and git history surfaces", () => {
    expect(resolveAppModeSurfaceFlags("extensions").showExtensions).toBe(true);
    expect(resolveAppModeSurfaceFlags("gitHistory").showGitHistory).toBe(true);
  });
});
