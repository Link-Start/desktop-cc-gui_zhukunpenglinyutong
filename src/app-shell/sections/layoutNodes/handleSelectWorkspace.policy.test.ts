import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "useAppShellLayoutNodesSection.tsx",
  ),
  "utf8",
);

function extractHandleSelectWorkspace(): string {
  const start = source.indexOf(
    "const handleSelectWorkspace = useEventCallback",
  );
  const end = source.indexOf("const handleConnectWorkspace", start);
  if (start < 0 || end < 0) {
    throw new Error("handleSelectWorkspace was not found");
  }
  return source.slice(start, end);
}

describe("handleSelectWorkspace policy", () => {
  it("does not wipe last thread or hydrate the list on the click frame", () => {
    const handler = extractHandleSelectWorkspace();
    expect(handler).toContain("selectWorkspace(workspaceId)");
    expect(handler).toContain("planWorkspaceNavigationThread");
    expect(handler).toContain("peekWorkspaceLastThreadId");
    expect(handler).not.toMatch(/setActiveThreadId\(\s*null/);
    expect(handler).not.toContain("ensureWorkspaceThreadListLoaded");
  });
});
