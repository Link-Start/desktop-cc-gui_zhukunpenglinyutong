import { describe, expect, it } from "vitest";
import {
  extractUnifiedDiffForPath,
  normalizeEditScenePath,
} from "./fileEditSceneUtils";

describe("fileEditSceneUtils", () => {
  it("strips accidental git status prefixes from paths", () => {
    expect(normalizeEditScenePath("A src/App.tsx")).toBe("src/App.tsx");
    expect(normalizeEditScenePath("Asrc/App.tsx")).toBe("src/App.tsx");
    expect(normalizeEditScenePath("./src/App.tsx")).toBe("src/App.tsx");
  });

  it("extracts a single-file slice from multi-file unified output", () => {
    const output = [
      "diff --git a/src/A.java b/src/A.java",
      "@@ -1 +1 @@",
      "-oldA",
      "+newA",
      "diff --git a/src/B.java b/src/B.java",
      "@@ -1 +1 @@",
      "-oldB",
      "+newB",
    ].join("\n");
    const slice = extractUnifiedDiffForPath(output, "src/B.java");
    expect(slice).toContain("src/B.java");
    expect(slice).toContain("+newB");
    expect(slice).not.toContain("+newA");
  });
});
