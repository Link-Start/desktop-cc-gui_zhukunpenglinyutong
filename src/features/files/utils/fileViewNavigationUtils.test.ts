import { describe, expect, it } from "vitest";
import {
  areFileUrisEquivalent,
  relativePathFromFileUri,
  resolveCodeNavigationErrorMessage,
  toFileUri,
} from "./fileViewNavigationUtils";

describe("fileViewNavigationUtils", () => {
  it("builds Windows file URIs that round-trip to workspace-relative paths", () => {
    const fileUri = toFileUri("C:\\Repo\\src\\Main.ts");

    expect(fileUri).toBe("file:///C:/Repo/src/Main.ts");
    expect(relativePathFromFileUri(fileUri, "C:/Repo")).toBe("src/Main.ts");
  });

  it("builds UNC file URIs that preserve the network host", () => {
    const fileUri = toFileUri("\\\\server\\share\\Repo\\src\\Main.ts");

    expect(fileUri).toBe("file://server/share/Repo/src/Main.ts");
    expect(relativePathFromFileUri(fileUri, "//server/share/Repo")).toBe("src/Main.ts");
  });

  it("compares Windows file URIs case-insensitively when requested", () => {
    expect(
      areFileUrisEquivalent(
        "file:///C:/Repo/src/Main.ts",
        "file:///c:/repo/src/main.ts",
        true,
      ),
    ).toBe(true);
  });

  it("maps missing symbols to action-specific localized guidance", () => {
    const translate = (key: string) => `translated:${key}`;

    expect(
      resolveCodeNavigationErrorMessage(
        new Error("No symbol under cursor"),
        "implementation",
        translate,
      ),
    ).toBe("translated:files.navigationImplementationSymbolRequired");
  });

  it("maps unsupported and operational failures without exposing raw backend copy", () => {
    const translate = (key: string) => `translated:${key}`;

    expect(
      resolveCodeNavigationErrorMessage(
        "Implementation navigation currently supports Java, TS/JS, and Rust files",
        "implementation",
        translate,
      ),
    ).toBe("translated:files.navigationUnsupportedLanguage");
    expect(
      resolveCodeNavigationErrorMessage(
        new Error("Failed to read file: private backend detail"),
        "references",
        translate,
      ),
    ).toBe("translated:files.navigationReferencesError");
  });

  it("preserves the already-localized timeout message", () => {
    const translate = (key: string) => `translated:${key}`;
    const timeout = translate("files.navigationTimeout");

    expect(
      resolveCodeNavigationErrorMessage(new Error(timeout), "definition", translate),
    ).toBe(timeout);
  });
});
