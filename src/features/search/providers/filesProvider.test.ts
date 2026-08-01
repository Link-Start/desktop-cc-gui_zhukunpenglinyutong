import { describe, expect, it } from "vitest";
import { searchFiles } from "./filesProvider";

describe("searchFiles", () => {
  it.each([
    ["src/common/config.ts", "config.ts"],
    ["src\\common\\windows.config.ts", "windows.config.ts"],
  ])("uses the basename as the title for %s", (path, expectedTitle) => {
    const [result] = searchFiles("config", [path], "workspace-without-shared-index");

    expect(result).toMatchObject({
      title: expectedTitle,
      filePath: path,
      locationLabel: path,
    });
  });

  it("matches a filename abbreviation while preserving the original path", () => {
    const path = "src/features/files/components/FileViewPanel.tsx";
    const [result] = searchFiles("fvp", [path], "workspace-without-shared-index");

    expect(result).toMatchObject({
      title: "FileViewPanel.tsx",
      filePath: path,
      locationLabel: path,
    });
  });
});
