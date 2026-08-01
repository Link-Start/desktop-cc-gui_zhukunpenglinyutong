import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loaderSource = readFileSync(
  new URL("./featureStyleLoaders.ts", import.meta.url),
  "utf8",
);

describe("feature style loader contracts", () => {
  it("loads shared diff styles before Git History is considered ready", () => {
    const gitHistoryLoader = loaderSource.slice(
      loaderSource.indexOf("export function loadGitHistoryStyles"),
      loaderSource.indexOf("export function loadKanbanStyles"),
    );

    expect(gitHistoryLoader).toContain("loadDiffStyles()");
    expect(gitHistoryLoader).toContain('import("./git-history.css")');
    expect(gitHistoryLoader).toContain("Promise.all");
  });

  it("loads the shared CodeMirror compare styles with the Git diff surface", () => {
    const diffLoader = loaderSource.slice(
      loaderSource.indexOf("export function loadDiffStyles"),
      loaderSource.indexOf("export function loadRuntimeConsoleStyles"),
    );

    expect(diffLoader).toContain('import("./file-view-panel.css")');
  });

  it("loads vendor model-manager dialog styles without the full settings bundle", () => {
    const vendorLoader = loaderSource.slice(
      loaderSource.indexOf("export function loadVendorModelManagerStyles"),
      loaderSource.indexOf("export function loadReleaseNotesStyles"),
    );

    expect(vendorLoader).toContain('import("./settings.vendor-dialog.css")');
    expect(vendorLoader).toContain('import("./settings.part2.vendor-models.css")');
    expect(vendorLoader).not.toContain('import("./settings.css")');
  });
});
