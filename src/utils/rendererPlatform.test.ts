import { describe, expect, it } from "vitest";
import {
  detectRendererPlatform,
  getRevealInOsFileManagerLabelKey,
} from "./rendererPlatform";

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

describe("getRevealInOsFileManagerLabelKey", () => {
  it("uses Finder / Explorer / file manager copy by platform", () => {
    expect(getRevealInOsFileManagerLabelKey("macos")).toBe("files.revealInFinder");
    expect(getRevealInOsFileManagerLabelKey("windows")).toBe("files.revealInExplorer");
    expect(getRevealInOsFileManagerLabelKey("linux")).toBe("files.revealInFileManager");
    expect(getRevealInOsFileManagerLabelKey("unknown")).toBe("files.revealInFinder");
  });
});
