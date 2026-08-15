import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

function read(rel: string): string {
  return readFileSync(join(currentDir, rel), "utf8");
}

describe("AppShell host tree isolation", () => {
  it("keeps business hooks out of the AppShell entry fiber", () => {
    const entry = read("../assembly/AppShell.tsx");
    expect(entry).toContain("AppShellHostTree");
    expect(entry).not.toContain("useThreads(");
    expect(entry).not.toContain("useGitPanelController(");
    expect(entry).not.toContain("useComposerController(");
  });

  it("runs session/catalog/git/runtime/composer/flows as memoized host islands", () => {
    const tree = read("AppShellHostTree.tsx");
    expect(tree).toContain("SessionHost");
    expect(tree).toContain("CatalogHost");
    expect(tree).toContain("GitSurfaceHost");
    expect(tree).toContain("RuntimeThreadHost");
    expect(tree).toContain("ComposerHost");
    expect(tree).toContain("WorkspaceFlowsHost");
    expect(tree).toContain("AppShellHostBusProvider");
    expect(tree).toContain("memo(");
  });

  it("gates git IO off non-git surfaces", () => {
    const git = read("useAppShellGitSurfaceHost.ts");
    expect(git).toContain("isGitRemoteEnabled");
    expect(git).toContain("isMultiRepositoryStatusEnabled");
    expect(git).toContain("resolveAppShellFeatureActivation");
  });

  it("gates search radar query work through feature activation", () => {
    const flows = read("useAppShellWorkspaceFlowsHost.ts");
    expect(flows).toContain("isSearchQueryEnabled");
    expect(flows).toContain("resolveAppShellFeatureActivation");
  });

  it("reads persistComposerEnginePref from the session host, not catalog", () => {
    const composer = read("useAppShellComposerHost.ts");
    expect(composer).toContain('"persistComposerEnginePref"');
    expect(composer).toContain(
      "const persistComposerEnginePref = session.persistComposerEnginePref",
    );
    expect(composer).not.toContain(
      "const persistComposerEnginePref = catalog.persistComposerEnginePref",
    );
  });

  it("keeps runtime threads off the session host fiber", () => {
    const session = read("useAppShellSessionHost.ts");
    expect(session).not.toContain("useThreads(");
    const runtime = read("useAppShellRuntimeThreadHost.ts");
    expect(runtime).toContain("useThreads(");
  });

  it("assembles from field subscriptions, not the full host snapshot", () => {
    const assembly = read("useAppShellAssemblyHost.ts");
    expect(assembly).toContain("useHostFields(");
    expect(assembly).toContain("SESSION_FIELDS");
    expect(assembly).toContain("RUNTIME_FIELDS");
    expect(assembly).not.toMatch(/import\s*\{[^}]*useHostSnapshot/);
    expect(assembly).not.toMatch(/\buseHostSnapshot\s*\(/);
  });
});
