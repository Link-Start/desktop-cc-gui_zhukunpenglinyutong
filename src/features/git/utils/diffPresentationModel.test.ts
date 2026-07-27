import { describe, expect, it } from "vitest";
import { normalizeDiffPresentationEntry } from "./diffPresentationModel";

describe("normalizeDiffPresentationEntry", () => {
  it("normalizes path and derives the shared display name", () => {
    expect(
      normalizeDiffPresentationEntry(
        { filePath: "src\\App.tsx", status: "M", diff: "@@" },
        (path) => path.replace(/\\/g, "/"),
      ),
    ).toMatchObject({
      presentationPath: "src/App.tsx",
      presentationFileName: "App.tsx",
      status: "M",
      diff: "@@",
    });
  });

  it("preserves explicit names and image metadata", () => {
    expect(
      normalizeDiffPresentationEntry(
        {
          filePath: "assets/a.png",
          fileName: "Preview",
          status: "M",
          diff: "",
          isImage: true,
          newImageMime: "image/png",
        },
        (path) => path,
      ),
    ).toMatchObject({
      presentationFileName: "Preview",
      isImage: true,
      newImageMime: "image/png",
    });
  });
});
