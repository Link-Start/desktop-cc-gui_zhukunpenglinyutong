import { describe, expect, it } from "vitest";
import { detectRendererPlatform } from "./rendererPlatform";

describe("detectRendererPlatform", () => {
  it("detects Windows without enabling macOS font smoothing", () => {
    expect(
      detectRendererPlatform({
        platform: "Win32",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      }),
    ).toBe("windows");
  });

  it("detects macOS for platform-specific font smoothing", () => {
    expect(
      detectRendererPlatform({
        platform: "MacIntel",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      }),
    ).toBe("macos");
  });
});
