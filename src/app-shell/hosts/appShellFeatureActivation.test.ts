import { describe, expect, it } from "vitest";
import { resolveAppShellFeatureActivation } from "./appShellFeatureActivation";

describe("resolveAppShellFeatureActivation", () => {
  it("enables git IO only on chat/gitHistory surfaces", () => {
    expect(
      resolveAppShellFeatureActivation({
        appMode: "chat",
        isSearchPaletteOpen: false,
      }).isGitRemoteEnabled,
    ).toBe(true);
    expect(
      resolveAppShellFeatureActivation({
        appMode: "gitHistory",
        isSearchPaletteOpen: false,
      }).isMultiRepositoryStatusEnabled,
    ).toBe(true);
    expect(
      resolveAppShellFeatureActivation({
        appMode: "extensions",
        isSearchPaletteOpen: false,
      }).isGitRemoteEnabled,
    ).toBe(false);
  });

  it("marks search query work only when the palette is open", () => {
    expect(
      resolveAppShellFeatureActivation({
        appMode: "chat",
        isSearchPaletteOpen: true,
      }).isSearchQueryEnabled,
    ).toBe(true);
    expect(
      resolveAppShellFeatureActivation({
        appMode: "chat",
        isSearchPaletteOpen: false,
      }).isSearchQueryEnabled,
    ).toBe(false);
  });
});
