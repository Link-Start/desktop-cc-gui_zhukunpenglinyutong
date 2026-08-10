import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const appShellPath = join(currentDir, "..", "app-shell.tsx");

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

describe("AppShell S4 host boundaries", () => {
  it("routes workspace list/home through useWorkspaceSessionHost", () => {
    const source = readSource(appShellPath);

    expect(source).toContain(
      'from "./app-shell-parts/useWorkspaceSessionHost"',
    );
    expect(source).toContain("useWorkspaceSessionHost({");
    // 不得绕过 host 直接挂 workspace controller / home state
    expect(source).not.toContain(
      'from "./features/app/hooks/useWorkspaceController"',
    );
    expect(source).not.toContain(
      'from "./app-shell-parts/useAppShellWorkspaceHomeState"',
    );
  });

  it("routes active session flags through useActiveSessionProjection", () => {
    const source = readSource(appShellPath);

    expect(source).toContain(
      'from "./app-shell-parts/activeSessionProjection"',
    );
    expect(source).toContain("useActiveSessionProjection({");
    // 根上不再手写 active thread find + processing 三元组
    expect(source).not.toMatch(
      /threadsByWorkspace\[activeWorkspaceId\]\?\.find\(/,
    );
    expect(source).not.toMatch(
      /threadStatusById\[activeThreadId\]\?\.isProcessing/,
    );
  });

  it("routes composer / conversation / kanban through domain hosts", () => {
    const source = readSource(appShellPath);

    expect(source).toContain('from "./app-shell-parts/useComposerDomainHost"');
    expect(source).toContain("useComposerDomainHost({");
    expect(source).toContain(
      'from "./app-shell-parts/useConversationDomainHost"',
    );
    expect(source).toContain("useConversationDomainHost({");
    expect(source).toContain('from "./app-shell-parts/useModeDomainHosts"');
    expect(source).toContain("useKanbanDomainHost({");

    // 根上不得再直接挂这些已下沉 hooks
    expect(source).not.toContain(
      'from "./app-shell-parts/useSelectedComposerSession"',
    );
    expect(source).not.toContain(
      'from "./app-shell-parts/useAppShellComposerModelSection"',
    );
    expect(source).not.toContain(
      'from "./app-shell-parts/useSelectedAgentSession"',
    );
    expect(source).not.toContain(
      'from "./features/kanban/hooks/useKanbanStore"',
    );
    expect(source).not.toContain(
      'from "./features/threads/hooks/useCopyThread"',
    );
  });

  it("builds clean domain contexts via slice builders", () => {
    const source = readSource(appShellPath);

    expect(source).toContain("buildRuntimeThreadDomainContextSlice");
    expect(source).toContain("buildModelSelectionDomainContextSlice");
    expect(source).toContain("buildCollaborationModeDomainContextSlice");
    expect(source).toContain("buildRuntimeDomainContextSlice");
  });
});

